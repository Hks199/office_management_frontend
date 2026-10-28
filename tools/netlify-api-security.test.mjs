import { test } from 'node:test';
import assert from 'node:assert/strict';
import apiSecurity from '../netlify/edge-functions/api-security.js';

const origin = 'https://sunvikamanagement.netlify.app';
const context = (next) => ({ next });

test('CSRF discovery uses the canonical site origin and preserves the refresh cookie', async () => {
  const request = new Request(`${origin}/api/v1/auth/csrf`, {
    headers: { Cookie: 'sunvika_refresh=private-session' },
  });
  const response = await apiSecurity(
    request,
    context(async (forwarded) => {
      assert.equal(forwarded.headers.get('Origin'), origin);
      assert.equal(forwarded.headers.get('Cookie'), 'sunvika_refresh=private-session');
      return Response.json({ success: true, data: { csrfToken: 'test-token' } });
    }),
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  assert.equal(response.headers.get('Netlify-CDN-Cache-Control'), 'no-store');
});

test('a supplied hostile origin is preserved for the backend to reject', async () => {
  const response = await apiSecurity(
    new Request(`${origin}/api/v1/auth/csrf`, {
      headers: { Origin: 'https://untrusted.example' },
    }),
    context(async (forwarded) => {
      assert.equal(forwarded.headers.get('Origin'), 'https://untrusted.example');
      return Response.json({ success: false }, { status: 403 });
    }),
  );
  assert.equal(response.status, 403);
});

test('POST authentication, employee-panel headers, body and response cookies remain intact', async () => {
  const body = JSON.stringify({ reason: 'Authorized work' });
  const request = new Request(`${origin}/api/v1/auth/refresh`, {
    method: 'POST',
    body,
    headers: {
      Origin: origin,
      Authorization: 'Bearer test-access',
      'X-CSRF-Token': 'test-csrf',
      'X-Employee-Panel': 'test-panel',
      Cookie: 'sunvika_refresh=old-session',
    },
  });
  const cookie =
    'sunvika_refresh=new-session; Path=/api/v1/auth; Secure; HttpOnly; SameSite=Strict';
  const response = await apiSecurity(
    request,
    context(async (forwarded) => {
      assert.equal(await forwarded.text(), body);
      for (const header of [
        'Origin',
        'Authorization',
        'X-CSRF-Token',
        'X-Employee-Panel',
        'Cookie',
      ])
        assert.equal(forwarded.headers.get(header), request.headers.get(header));
      return Response.json({ success: true }, { headers: { 'Set-Cookie': cookie } });
    }),
  );
  assert.equal(response.headers.get('Set-Cookie'), cookie);
});

test('ordinary GET requests do not acquire a forged Origin header', async () => {
  await apiSecurity(
    new Request(`${origin}/api/v1/leads`),
    context(async (forwarded) => {
      assert.equal(forwarded.headers.has('Origin'), false);
      return Response.json({ data: [] });
    }),
  );
});

test('preview and hostile host URLs cannot inherit the production origin or reach the API', async () => {
  for (const host of [
    'https://deploy-preview-1--sunvikamanagement.netlify.app',
    'https://branch--sunvikamanagement.netlify.app',
    'https://untrusted.example',
    'https://sunvikamanagement.netlify.app.untrusted.example',
    'http://sunvikamanagement.netlify.app',
    'https://sunvikamanagement.netlify.app:8443',
  ]) {
    for (const site of [undefined, { url: origin }, { url: host }]) {
      const response = await apiSecurity(new Request(`${host}/api/v1/auth/csrf`), {
        site,
        next: () => assert.fail('The production API must not be contacted'),
      });
      assert.equal(response.status, 403);
      assert.equal((await response.json()).error.code, 'SITE_ORIGIN_FORBIDDEN');
    }
  }
});

test('cross-site requests without an Origin cannot use the CSRF fallback', async () => {
  const response = await apiSecurity(
    new Request(`${origin}/api/v1/auth/csrf`, {
      headers: { 'Sec-Fetch-Site': 'cross-site' },
    }),
    context(() => assert.fail('Cross-site CSRF discovery must stop at the edge')),
  );
  assert.equal(response.status, 403);
});

test('the production origin works despite missing, insecure or unrelated runtime site metadata', async () => {
  for (const site of [
    undefined,
    null,
    {},
    { url: 'not a URL' },
    { url: 'http://sunvikamanagement.netlify.app' },
    { url: 'https://untrusted.example' },
    { url: 'https://deploy-preview-1--sunvikamanagement.netlify.app' },
  ]) {
    for (const path of ['/api/v1/health/ready', '/api/v1/auth/csrf']) {
      let forwardedCount = 0;
      const response = await apiSecurity(new Request(`${origin}${path}`), {
        site,
        next: async (forwarded) => {
          forwardedCount++;
          assert.equal(
            forwarded.headers.get('Origin'),
            path.endsWith('/auth/csrf') ? origin : null,
          );
          return Response.json({ success: true });
        },
      });
      assert.equal(response.status, 200);
      assert.equal(forwardedCount, 1);
      assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
    }
  }
});

test('upstream failures never expose provider errors or credentials and are not cached', async () => {
  const response = await apiSecurity(
    new Request(`${origin}/api/v1/leads`),
    context(() => {
      throw new Error('sensitive-upstream-credential');
    }),
  );
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.doesNotMatch(await response.text(), /sensitive-upstream-credential/);
});
