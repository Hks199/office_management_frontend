# Deploy the frontend to Netlify

The backend remains at **https://sunvika.niakylie.com**. Netlify hosts the React
frontend and proxies its `/api/v1` requests to that backend. Database, AWS, SMTP
and JWT credentials stay on the backend server.

## 1. Import the frontend repository

Push this frontend project to your Git provider, then choose **Add new project →
Import an existing project** in Netlify and select that repository. Include
`netlify.toml` and `netlify/edge-functions/api-security.js` in the commit.

Build settings are supplied by `netlify.toml`:

| Setting           | Value                                                                                         |
| ----------------- | --------------------------------------------------------------------------------------------- |
| Base directory    | Repository root; use `office_management_frontend` if it is a subfolder of a larger repository |
| Build command     | `npm run build`                                                                               |
| Publish directory | `dist`                                                                                        |
| Node version      | `24`                                                                                          |

Use the Git-based deployment workflow so Netlify bundles and installs the Edge
middleware along with the static build. Uploading just the `dist` folder does
not include that middleware. No frontend environment variables are required for
the hosted API proxy; `API_PROXY_TARGET` is only for local Vite development.

## 2. Choose the primary frontend address

After the first deployment, open the primary HTTPS address Netlify assigns,
for example `https://your-project.netlify.app`. You can instead configure a
custom frontend domain in Netlify. This frontend address must differ from the
existing backend domain `sunvika.niakylie.com`.

The Edge middleware pins the canonical frontend origin to
`https://sunvikamanagement.netlify.app` in the `productionOrigin` constant in
`netlify/edge-functions/api-security.js`. Update that constant when changing the
primary frontend domain. Incoming Host headers and runtime site metadata cannot
grant access to the production API. API calls from deploy-preview URLs, branch
domains or non-primary aliases are rejected; use the primary frontend address.
Preview static pages can still render, but do not have production API access.

## 3. Configure the deployed backend

On the server hosting **sunvika.niakylie.com**, update these non-secret settings,
using your real primary frontend URL with no trailing slash:

```dotenv
NODE_ENV=production
CORS_ORIGINS=https://your-project.netlify.app
CREDENTIAL_UI_ORIGIN=https://your-project.netlify.app
```

Preserve other explicitly trusted frontend origins in `CORS_ORIGINS` as a
comma-separated list if required. Do not use `*` or allow every `netlify.app`
subdomain. `CREDENTIAL_UI_ORIGIN` controls invitation and password-reset links
and must be included in `CORS_ORIGINS`. Restart the deployed backend after this
change. Changing a local backend `.env` does not change the deployed API.

Keep production refresh cookies HttpOnly and Secure. The existing backend sets
no cookie Domain, so the proxied cookies belong to the frontend host; do not add
a backend-only cookie Domain. Keep cookie Path `/api/v1/auth`, because the proxy
preserves that path. Authorization, CSRF and employee-panel headers are passed
through. Configure trusted proxies/rate limits for the actual backend reverse
proxy chain rather than trusting arbitrary forwarded headers.

## 4. Configure private S3 uploads

Add the primary frontend HTTPS origin to the private bucket's existing CORS
`AllowedOrigins`, preserving the existing allowed methods and checksum/content
headers. The browser uploads attendance photos, site-visit photos and imports
directly to S3 using short-lived backend-authorized uploads. Do not make the
bucket public or put AWS credentials in Netlify frontend environment variables.

## 5. Verify the deployed application

1. Open `/login`, then sign in with an existing employee account.
2. Reload `/employees` or `/leads` directly; the React page should load.
3. Reload after sign-in; the refresh-cookie/CSRF exchange should restore the session.
4. Verify logout, an invitation/reset link and employee-panel switching.
5. Check GPS/camera attendance and one private S3 upload from the HTTPS site.

The API rewrite precedes the SPA fallback, so API failures remain API responses
instead of receiving `index.html`. API responses are not cached. The Edge
middleware supplies the primary site Origin only for the CSRF discovery GET
when missing; it preserves a supplied Origin so backend CORS checks still run.
It also rejects cross-site CSRF discovery and avoids returning internal errors.

The frontend CSP allows its own assets, its Excel worker and private AWS media
connections. Camera and location are allowed on the same HTTPS origin and still
require the user's browser permission.

Configuration and local checks do not publish a Netlify site or modify remote
backend/S3 settings. The real Netlify URL and those remote settings must be
confirmed after deployment.

References: [Netlify file configuration](https://docs.netlify.com/build/configure-builds/file-based-configuration/),
[rewrites and proxies](https://docs.netlify.com/manage/routing/redirects/rewrites-proxies/),
[Edge Functions API](https://docs.netlify.com/build/edge-functions/api/).
