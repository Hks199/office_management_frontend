function reject(status, code, message) {
  return Response.json(
    { success: false, message, error: { code, details: [] } },
    { status, headers: { 'Cache-Control': 'no-store', 'Netlify-CDN-Cache-Control': 'no-store' } },
  );
}

export default async function apiSecurity(request, context) {
  let site;
  try {
    // Netlify supplies this canonical production URL. Never trust incoming Host as a fallback.
    site = new URL(context.site.url);
    if (site.protocol !== 'https:' || site.username || site.password)
      throw new Error('Invalid site');
  } catch {
    return reject(503, 'SITE_NOT_CONFIGURED', 'The frontend site address is not configured.');
  }
  const url = new URL(request.url);
  // Preview and alias domains must not silently acquire access to production office data.
  if (url.origin !== site.origin) {
    return reject(
      403,
      'SITE_ORIGIN_FORBIDDEN',
      'Use the primary application address to access the API.',
    );
  }
  let forwarded = request;
  if (
    request.method === 'GET' &&
    url.pathname === '/api/v1/auth/csrf' &&
    !request.headers.has('Origin')
  ) {
    if (request.headers.get('Sec-Fetch-Site') === 'cross-site') {
      return reject(403, 'ORIGIN_FORBIDDEN', 'Cross-site authentication requests are not allowed.');
    }
    const headers = new Headers(request.headers);
    headers.set('Origin', site.origin);
    forwarded = new Request(request, { headers });
  }
  try {
    // Continue to netlify.toml's fixed HTTPS upstream. Cookies and auth headers stay intact.
    const response = await context.next(forwarded);
    const headers = new Headers(response.headers);
    headers.set('Cache-Control', 'private, no-store');
    headers.set('CDN-Cache-Control', 'no-store');
    headers.set('Netlify-CDN-Cache-Control', 'no-store');
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch {
    return reject(503, 'API_UNAVAILABLE', 'The API is temporarily unavailable. Please try again.');
  }
}
