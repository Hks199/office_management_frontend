import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ApiError,
  clearSession,
  hasAccessToken,
  onSessionExpired,
  refreshSession,
  request,
  setCredentials,
} from './api';
const csrf = 'c'.repeat(43);
const credentials = { accessToken: 'access-token', csrfToken: csrf, expiresIn: 900 };
function response(data: unknown, status = 200) {
  return new Response(
    JSON.stringify(
      status < 400
        ? { success: true, message: 'OK', data }
        : { success: false, message: 'Denied', error: { code: 'UNAUTHENTICATED' } },
    ),
    { status, headers: { 'Content-Type': 'application/json' } },
  );
}
beforeEach(() => {
  clearSession();
  vi.stubGlobal('fetch', vi.fn());
});
afterEach(() => {
  clearSession();
  vi.unstubAllGlobals();
});
describe('secure API transport', () => {
  it('explains denied S3 access during contact upload without exposing provider details', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          success: false,
          message: 'private-provider-secret',
          error: { code: 'STORAGE_ACCESS_DENIED' },
        }),
        { status: 503 },
      ),
    );
    await expect(
      request('/csv-imports/upload-intents', { method: 'POST', body: {} }),
    ).rejects.toThrow('AWS denied access to private file storage');
  });
  it('explains an uninitialized lead workflow without exposing server internals', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          success: false,
          message: 'private-internal-configuration',
          error: { code: 'COMMERCIAL_NOT_INITIALIZED' },
        }),
        { status: 503 },
      ),
    );
    await expect(request('/leads', { method: 'POST', body: {} })).rejects.toThrow(
      'Lead workflow setup is incomplete',
    );
  });
  it('explains missing S3 configuration without exposing arbitrary server error text', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          success: false,
          message: 'private-provider-secret',
          error: { code: 'STORAGE_UNAVAILABLE' },
        }),
        { status: 503 },
      ),
    );
    await expect(request('/files/upload-intents', { method: 'POST', body: {} })).rejects.toThrow(
      'set AWS_REGION and S3_BUCKET in the backend environment',
    );
  });
  it.each([
    ['INTERNAL_ERROR', 500],
    ['UNKNOWN_PROVIDER_ERROR', 503],
    ['toString', 503],
    ['STORAGE_UNAVAILABLE', 500],
  ])(
    'keeps unrecognized or inconsistent service failures generic: %s / %i',
    async (code, status) => {
      vi.mocked(fetch).mockResolvedValue(
        new Response(
          JSON.stringify({ success: false, message: 'private-provider-secret', error: { code } }),
          { status },
        ),
      );
      await expect(request('/attendance/me/status')).rejects.toThrow(
        'The server could not complete your request. Please try again.',
      );
    },
  );
  it('preserves backend business-rule conflicts instead of describing all conflicts as stale revisions', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          success: false,
          message: 'Duplicate policy cannot change after contact data exists',
          error: { code: 'DEDUPE_POLICY_LOCKED' },
        }),
        { status: 409 },
      ),
    );
    await expect(
      request('/commercial-settings', {
        method: 'PATCH',
        body: { revision: 0, duplicateScope: 'COMPANY' },
      }),
    ).rejects.toThrow('Duplicate policy cannot change after contact data exists');
  });
  it('sends bearer tokens only to the fixed API prefix and never persists credentials', async () => {
    const local = vi.spyOn(Storage.prototype, 'setItem');
    setCredentials(credentials);
    vi.mocked(fetch).mockResolvedValue(response([]));
    await request('/employees');
    const [url, options] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe('/api/v1/employees');
    expect(new Headers(options?.headers).get('Authorization')).toBe('Bearer access-token');
    expect(options).toMatchObject({
      credentials: 'same-origin',
      cache: 'no-store',
      redirect: 'error',
      referrerPolicy: 'no-referrer',
    });
    expect(local).not.toHaveBeenCalled();
  });
  it.each(['https://attacker.example', '//attacker.example', '/../../secret'])(
    'rejects an untrusted request path: %s',
    async (path) => {
      await expect(request(path)).rejects.toThrow('Invalid API path');
      expect(fetch).not.toHaveBeenCalled();
    },
  );
  it('does not send a bearer token for anonymous auth exchanges', async () => {
    setCredentials(credentials);
    vi.mocked(fetch).mockResolvedValue(response({}));
    await request('/auth/login', {
      method: 'POST',
      anonymous: true,
      body: { email: 'person@example.com', password: 'secret' },
    });
    expect(new Headers(vi.mocked(fetch).mock.calls[0][1]?.headers).has('Authorization')).toBe(
      false,
    );
  });
  it('deduplicates concurrent refreshes and binds the mutation to the CSRF token', async () => {
    vi.mocked(fetch).mockImplementation(async (url) =>
      response(String(url).endsWith('/csrf') ? { csrfToken: csrf } : credentials),
    );
    await Promise.all([refreshSession(), refreshSession(), refreshSession()]);
    expect(fetch).toHaveBeenCalledTimes(2);
    const options = vi.mocked(fetch).mock.calls[1][1];
    expect(options?.method).toBe('POST');
    expect(new Headers(options?.headers).get('X-CSRF-Token')).toBe(csrf);
    expect(hasAccessToken()).toBe(true);
  });
  it('refreshes once before retrying an expired authenticated request', async () => {
    setCredentials(credentials);
    vi.mocked(fetch)
      .mockResolvedValueOnce(response(null, 401))
      .mockResolvedValueOnce(response({ csrfToken: csrf }))
      .mockResolvedValueOnce(response({ ...credentials, accessToken: 'new-token' }))
      .mockResolvedValueOnce(response([{ name: 'Person' }]));
    const result = await request('/employees');
    expect(result.data).toEqual([{ name: 'Person' }]);
    expect(fetch).toHaveBeenCalledTimes(4);
    expect(new Headers(vi.mocked(fetch).mock.calls[3][1]?.headers).get('Authorization')).toBe(
      'Bearer new-token',
    );
  });
  it('clears the session on failed refresh without retry loops', async () => {
    setCredentials(credentials);
    const expired = vi.fn();
    const unsubscribe = onSessionExpired(expired);
    vi.mocked(fetch).mockResolvedValue(response(null, 401));
    await expect(request('/employees')).rejects.toBeInstanceOf(ApiError);
    expect(hasAccessToken()).toBe(false);
    expect(expired).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledTimes(2);
    unsubscribe();
  });
  it('never automatically retries network-failed mutations', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(request('/leads', { method: 'POST', body: {} })).rejects.toMatchObject({
      status: 0,
      code: 'NETWORK_ERROR',
    });
    expect(fetch).toHaveBeenCalledOnce();
  });
  it('does not expose backend internal error messages', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ success: false, message: 'Internal credential detail' }), {
        status: 500,
      }),
    );
    await expect(request('/employees')).rejects.toThrow(
      'The server could not complete your request.',
    );
  });
});
