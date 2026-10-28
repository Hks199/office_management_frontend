# Frontend security boundaries

The frontend implements defensive controls; it cannot guarantee security or replace API authorization, secure infrastructure, or an application security review.

## Identity and session handling

- Access and CSRF tokens live in module memory only, never localStorage, sessionStorage, URLs or persisted query caches. Refresh cookies remain HttpOnly and are issued by the backend.
- API requests use the fixed `/api/v1` origin, same-origin credentials, no-store caching, a no-referrer policy, timeouts, and redirect rejection. Anonymous authentication exchanges omit bearer credentials.
- Cookie refresh/logout mutations use `X-CSRF-Token`. Refresh first retrieves a current session-bound CSRF token and is deduplicated in a tab. Web Locks serialize refresh rotation across supported same-origin tabs. Unsupported browsers retain in-tab deduplication; concurrent cross-tab rotation may require reauthentication.
- Failed authentication clears in-memory credentials and private query caches. Logout broadcasts a non-secret sign-out event to other tabs. Server logout failures remain visible instead of claiming the cookie was revoked.
- Password updates and logout-all revoke sessions through the backend. Invitation/reset secrets are captured from URL fragments, removed with `history.replaceState`, and submitted in JSON. Recovery responses preserve the backend's account-enumeration protection.
- `/auth/me` supplies grants; profile visibility refreshes on tab focus. Server-side permission changes take effect immediately at the API. UI visibility alone is not an authorization boundary.

## Rendering, forms and files

- React escapes data; the app does not use `dangerouslySetInnerHTML`, evaluate remote code, load third-party analytics/scripts/fonts, or create user-controlled HTML.
- Strict TypeScript, authentication response schemas, native form constraints and Zod payload validation reduce accidental contract errors. The API must validate every input independently.
- Forms construct payloads from explicitly configured fields. Updates use the backend's current revision and surface conflicts. Financial/target decimals remain strings.
- Network-failed mutations are not automatically retried. Calls, conversions and visit creation supply idempotency keys; confirmed unauthorized requests can refresh once before replay. A manually resubmitted ambiguous request may still require record reconciliation.
- Photo inputs allow JPEG, PNG or WebP with matching extensions and a 5 MB limit; imports accept CSV, XLSX or XLS up to 20 MB; Excel signature checks, cell/range limits, formula rejection and a worker timeout apply before conversion to CSV. These checks improve UX; backend byte/signature/checksum validation is authoritative.
- File transfers use SHA-256 checksums, short-lived signed POST fields and upload confirmation. Attendance explicitly requests GPS access, refreshes location at submission and captures JPEGs from the live camera without microphone access. Camera tracks stop after capture or dialog closure; temporary preview URLs are revoked. The frontend sends no API token or cookie to S3.
- Signed URLs are restricted to HTTPS AWS storage hosts without embedded credentials. Only private S3 storage supported by this backend is accepted. Custom storage domains require a reviewed change to the URL allowlist and CSP.
- Records and query caches are not persisted to disk by application code. Sensitive screens must also be protected by host response headers. Downloads remain files on the user's device and require normal device policy.

## Deployment requirements

Netlify deployments use [netlify.toml](netlify.toml) and
[api-security.js](netlify/edge-functions/api-security.js). The API proxy keeps
browser authentication on the frontend origin. Edge middleware supplies a
missing CSRF discovery Origin from Netlify's canonical site metadata, preserves
supplied Origins, rejects production API use from non-primary deploy URLs, and
sets no-store response headers. Configure the exact primary frontend origin in
the deployed backend and private S3 bucket as described in
[deploy/NETLIFY.md](deploy/NETLIFY.md). Publishing only `dist` skips Edge middleware;
use a Netlify build from the repository.

Use the supplied nginx example as a starting point and adapt the domain, certificates, upstream and root. It includes CSP, frame denial, HSTS, no-sniff, no-referrer, no-store, and a permissions policy. Those headers take effect only when installed at the serving host; a Vite build cannot enforce response headers.

The CSP uses only same-origin scripts/styles and AWS storage connections. It permits same-origin workers for local Excel parsing and does not enable unsafe-inline or unsafe-eval. Restrict the AWS wildcard to your actual regional bucket host(s) in production. HSTS is appropriate only for a correctly configured HTTPS domain.

The backend requires Origin for `/auth/csrf`. Browsers commonly omit Origin on same-origin GET requests. A trusted reverse proxy therefore supplies the **fixed public frontend origin only when the header is absent**, preserving any supplied Origin so backend checks still reject an untrusted caller. Configure that literal origin consistently in nginx, `CORS_ORIGINS`, and `CREDENTIAL_UI_ORIGIN`. Do not derive this fallback from an arbitrary incoming Host header. Reject unrecognized hosts at the edge. The local Vite proxy provides the equivalent fixed localhost origin for this endpoint.

Backend production requirements still include HTTPS secure cookies, appropriate cookie lifetime, MongoDB transaction support, least-privilege IAM, encrypted private S3, exact bucket CORS, rate limits, trusted proxy settings, worker schedules, secrets management, monitoring and backups. No backend security setting was changed by the frontend implementation.

## Validation limits

The standard browser suite mocks the API. The optional integration browser suite starts the real backend source against a fresh, loopback-only MongoDB replica set and exercises authenticated routes, revisions, scopes and business rules. It never reads the application's backend `.env` or connects to its database. Photo and import storage are injected into that test backend; import tests verify uploaded checksums and exercise the real preview/commit worker without live AWS. Dependency audits describe known advisories at the time of execution and are not a guarantee against undisclosed vulnerabilities. Review and test deployment configuration in its actual environment before release.

The token storage approach follows the [OWASP HTML5 Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html), which advises against keeping session identifiers in local storage.
