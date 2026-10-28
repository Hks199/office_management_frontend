# Sunvika office workspace

A React 19, TypeScript, Vite, and Tailwind CSS frontend for the adjacent `office_management_backend` REST API. It uses real `/api/v1` endpoints; application screens do not substitute sample data when the API fails. Browser tests include mocked API scenarios and a separate real-backend integration suite.

## Run locally

Requires Node 24 (matching the backend) and npm.

```powershell
cd D:\sunvika\office_management_frontend
npm ci
Copy-Item .env.example .env
npm run dev
```

Open **http://localhost:5173**. The supplied `.env.example` forwards `/api` to **https://sunvika.niakylie.com**. Browser requests such as `/api/v1/auth/login` reach `https://sunvika.niakylie.com/api/v1/auth/login` through the Vite proxy. For a local backend instead, set `API_PROXY_TARGET=http://127.0.0.1:3000`. Restart Vite after changing `.env`. This variable is server-side Vite configuration; it is not exposed to browser code.

The API used by local development must include `http://localhost:5173` in its `CORS_ORIGINS`. For a fully local setup, use `CREDENTIAL_UI_ORIGIN=http://localhost:5173`. The proxy sends the API server's hostname in Host and preserves browser Origin headers. For the backend's CSRF discovery GET, which requires an Origin even when browsers omit it, the loopback development proxy supplies the fixed trusted development origin. Use the documented localhost URL consistently rather than switching between localhost and 127.0.0.1.

If the deployed API rejects local requests with HTTP 403 / `ORIGIN_FORBIDDEN`, apply the settings in [deploy/backend-api.env.example](deploy/backend-api.env.example) on that API server, preserving any other trusted frontend origins, and restart the API. Editing the adjacent local backend `.env` does not update the deployed server. `CREDENTIAL_UI_ORIGIN` must always be an allowed frontend origin; retain a hosted frontend origin for invitation links if that is where employees sign in.

Sign in with an existing invited employee account. There is no public registration or hardcoded administrator password. The initial administrator must accept the invitation delivered by the backend's credential worker. Invitation and recovery routes accept `#token=...` or a bare `#...` fragment, remove it from the address immediately, and send the token only in a JSON request body.

## Features

Employee details and reporting-hierarchy rows display role, branch and reporting-manager names. Authorized employee read responses include minimal relationship labels without replacing IDs used by forms and mutations. The backend resolves labels only for records in the authorized result page and does not expose related-role grants, branch configuration or manager contact details. No role-administration permission is needed just to display an employee's role name.

Sales Executives use **Daily sales reports** in the navigation or dashboard shortcut (`/daily-reports`). Each entry is an individual customer/site visit through the existing `/sales-reports/visits` APIs. Choose an assigned customer lead, start with GPS, then submit discussion notes, customer interest, installation readiness, outcome, required capacity, optional next follow-up and 1–5 photos. Starting a visit opens its completion form immediately; cancelling keeps the open visit so it can be resumed after navigation or sign-in. Open visits must be completed within the backend's 24-hour window. The date picker uses India Standard Time and shows the current employee's scoped reports, submission status and manager feedback. Managers continue reviewing under **Site visits**. Photo submission requires the existing private S3 backend configuration; no AWS credentials are exposed to the browser.

Employee creation and role changes load only approved role options through dedicated employee endpoints. Managers can select permitted subordinate roles without role-administration access. Inactive roles, stale creation policies, unapproved roles and templates requiring unavailable sensitive delegation are excluded.

The employee form makes Primary branch required when the selected role requires one, and permits None / company-wide only for a role explicitly allowing it. Missing branches are explained in the form; an MD or authorized administrator must create or assign a branch before branch-based employees can be added.

Employee creation uses `/employees/branch-options?roleId=...`, which returns active branch labels under the selected role's creation policy. MD, BDO and MH allow **None**, saved as `branchId:null`; BH, Sales Executive and Telecaller require a branch. Company-wide BDO and MH managers (no primary branch) with an approved cross-branch reporting policy can select an active branch to establish their first team. Employee reads and transfers retain their existing reporting scope. Managers with a primary branch stay restricted to that branch and existing team branches. MD can still assign a BDO's primary branch through **Branches → View branch → Assign BDO primary branch**; this revokes the BDO's sessions. Existing untouched MH default policies are updated by the backend's `npm run db:indexes:organization`; administrator-customized policies retain their approved settings.

The reporting-manager dropdown uses `/employees/manager-options?roleId=...` and shows active managers with their employee code and role. For MH creation, MD can select eligible MD/BDO managers; BDO can select themselves or their root MD. The creation-only MD option exposes a name label and does not grant general administrator-profile access or authorize transfers outside the existing hierarchy.

Mark attendance shows only the next action allowed by the employee's current backend status. Check in or Check out immediately opens the Turn on GPS popup. Enable GPS and continue requests location; the camera opens after a successful fix. It includes device-permission guidance, retry controls, live capture/retake, private photo upload and current coordinates saved through the backend. See [ATTENDANCE_SETUP.md](ATTENDANCE_SETUP.md) for the workflow and backend S3 environment settings to configure later.

| Area           | Implemented workflows                                                                                                                                                           |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication | Login, cookie-backed session restoration, refresh coordination across tabs, logout, logout all devices, password changes, password recovery, invitation acceptance              |
| Overview       | Scoped live metrics, approved monthly activity chart, lead pipeline, date selection, employee/branch performance, private CSV export jobs                                       |
| Organization   | Employee invitation/create/edit, dedicated manager/branch/role/status changes, branch create/edit/head assignment, reporting hierarchy                                          |
| Commercial     | Searchable customer and lead lists, lead create/edit/status/assignment/proposal, customer conversion, bulk assignments, proposal review/history, private lead CSV export        |
| Attendance     | Check-in/out with photo checksum, private S3 upload and confirmation, explicit geolocation, monthly records, review/correction, private evidence, branch policies and calendars |
| Activity       | Call submission, site visit start, private visit-photo uploads and completion, report reviews and histories                                                                     |
| Targets        | Assignment, revision-aware updates, verified progress, revision history, evidence capture/review/history                                                                        |
| Imports        | CSV and Excel templates, worksheet selection, column mapping, private upload, validation preview, confirmation and assignment                                                          |
| Administration | Role creation/edit/archive, scoped grant picker, creation policy listing/creation/editing, state/district/block management, lead reference values                               |
| Usability      | Responsive navigation, module search, loading/error/empty states, paginated lists, accessible dialogs and form labels, reduced-motion support                                   |

Navigation and actions follow grants from `/auth/me`. The backend remains authoritative for scope, role-creation policy, assignments, hierarchy constraints, revisions, and permitted workflow transitions. A role may see a module but lack a related lookup permission; failed lookups are shown explicitly.

The remaining business interfaces are included: edit creation policies with PUT and revisions; inspect customer/lead assignment histories; review lead assignment proposals; view private attendance and visit photos; configure branch attendance policy and working calendars; edit versioned lead transitions and duplicate rules; inspect operational metrics; capture target milestones; and explore daily call summaries, target summaries/reports, attendance summaries and all scoped dashboard views. Customer assignment supports selecting multiple records. CSV and Excel imports support custom column mapping.

Open **Reports & insights** for aggregate reports, **Commercial settings** for workflows and duplicate policy, and **Operations** for observed server metrics. In a branch record, choose **Attendance settings**. In a lead record, choose **Assignment proposals** to review pending proposals. Creation policies can be edited from their detail dialog. Permissions control each action, and the backend checks scope and revision again when saving.

Invitation reissue and other operational scripts remain backend commands because they have no mounted HTTP endpoints. The app does not invent endpoints for planned notifications or audit-log browsing that the backend does not currently mount.

## Structure

```text
src/
  app/                   # Composition, routes, application shell, error boundary
  features/
    administration/      # Versioned workflows, duplicate rules, branch policy/calendar, operations
    auth/                # Identity provider, sign-in and invitation/recovery screens
    attendance/          # Location/photo check-in and check-out workflow
    dashboard/           # Scoped overview, performance, charts
    exports/             # Private asynchronous export lifecycle
    insights/            # Scoped report definitions, filters, aggregate report explorer
    reports/             # Site visit evidence and completion
    resources/           # Typed module definitions, CRUD/detail/history screens
    settings/            # Profile, password and session controls
    uploads/             # CSV and Excel import workflow
  shared/
    components/          # Accessible modal, feedback, forms and payload validation
    lib/                 # Fixed-origin API client, formatting, private file transport
    types/               # API envelope, pagination and identity types
  styles/                # Tailwind entry and responsive visual system
e2e/                     # Desktop and mobile browser scenarios
integration/             # Browser workflows against real backend routes and temporary MongoDB
tools/                   # Isolated integration fixture server (never reads backend .env)
deploy/                  # Same-origin HTTPS nginx configuration example
```

Module-specific fields, permissions, endpoints and actions live in `src/features/resources/config.ts`. Specialized multi-step flows remain separate feature components. Decimal financial and target values remain strings throughout submission to preserve precision. Forms submit an explicit field allowlist and include backend revisions on updates.

## Verification

```powershell
npm run check             # ESLint, unit tests, strict TypeScript, production build
npm audit                 # Includes development dependencies
npx playwright install chromium
npm run test:e2e          # Desktop Chromium + mobile Chromium, mocked API fixtures
npm run test:integration  # Real sibling backend, isolated temporary MongoDB replica set
npm run build            # Output: dist/
```

Browser tests cover sign-in/out, session restoration, permission-based navigation and direct-route denial, rendering hostile record content as text, invitation-token removal/submission, responsive overflow, dialogs and module search. Unit tests cover API credential boundaries, refresh deduplication, CSRF headers, session invalidation, failed-mutation behavior, private storage URL validation, image validation, exact decimals and form payloads.

The optional real-backend browser suite requires the sibling backend and its installed development dependencies. It boots the backend source with a new temporary MongoDB replica set, seeds test-only identities, and runs actual authenticated HTTP requests through a separate Vite proxy on port 5183. It does not read the backend's `.env`, connect to the application database, run email workers, or send mail. Set `SUNVIKA_BACKEND_PATH` if the backend is elsewhere. The default test MongoDB version is 8.2.3; `FRONTEND_TEST_MONGO_VERSION` overrides it. The MongoDB test binary may download on the first run. The fixture backend uses port 3101; keep these two test ports available.

The real-backend suite checks policies, branch policy/calendar updates, workflow versions, locked duplicate rules, proposal approval/history, reporting, private photo authorization and restricted identities. Photo storage is injected and image delivery is intercepted in the test; real AWS/IAM/CORS, SMTP, background workers and production hosting still require environment acceptance checks. No test identity or test storage is included in the app bundle.

`npm run preview` serves the production build locally on localhost:5173 and inherits the API proxy. Stop the development server first. Preview is not a production server; use the production reverse proxy to validate deployment behavior.

## Production security

For Netlify, the repository includes `netlify.toml` with the build settings,
backend proxy, React Router fallback, security headers and CSRF Edge middleware.
Follow [deploy/NETLIFY.md](deploy/NETLIFY.md) for the exact deployment and backend/S3
origin settings. The backend stays at `https://sunvika.niakylie.com`.

See [SECURITY.md](SECURITY.md) and [deploy/nginx.conf.example](deploy/nginx.conf.example). Serve `dist/` over HTTPS and proxy `/api` on the **same origin**. Configure the backend with the exact public origin, secure production cookies, and the correct trusted-proxy count. The nginx example requires adaptation and deployment validation; it has not been deployed by this task.

**https://sunvika.niakylie.com is the backend API address**, not the frontend address. Its `CORS_ORIGINS` must include the actual frontend origin (`http://localhost:5173` for local development), and `CREDENTIAL_UI_ORIGIN` must point to that frontend so invitation and reset links open the React app. For production hosting, adapt the nginx example to the actual frontend domain and configure its `/api/` upstream for the deployed backend; an external HTTPS upstream must use the backend hostname for Host and TLS SNI. Production builds use the hosting reverse proxy; `API_PROXY_TARGET` only configures Vite development/preview.

Never put SMTP, database, JWT, S3 or other secrets in frontend environment variables. Anything shipped to a browser is public. Keep dependencies updated and run the checks before release.

## Import customers from CSV or Excel

Open **Customer imports ? Upload CSV / Excel**, download a template, and select a branch and file. Supported files are UTF-8 `.csv`, `.xlsx`, and `.xls`, up to 20 MB and 50,000 customers. Excel imports use one selected worksheet at a time; put headers in row 1 starting at A1. Indian phone numbers can be entered directly as 10 digits (for example `9876543210`); the backend stores them as `+919876543210`. For other countries, include the country code. Local and +91 forms of the same number are treated as duplicates. State and district names/codes must already exist in the application. Remove formulas and merged cells. Encrypted and macro-enabled workbooks are not supported.

The template columns are Customer Name, Mobile Number, Alternate Number, State, District, Block/Tehsil, Site Address, and Remarks. Alternate Number, Block/Tehsil, and Remarks may be blank. If columns are omitted entirely, clear their optional column mappings. Custom headings can be matched under **Column mapping**.

Excel parsing runs in a local worker with a timeout, format signature checks and row/cell/column limits. Only the selected worksheet is converted to UTF-8 CSV and uploaded to the existing private storage pipeline. The backend independently validates locations, contacts, duplicates, checksums, permissions and branch scope. It never executes spreadsheet formulas. The original Excel workbook is not stored.

After upload, the job opens and updates automatically while validation runs. Row preview stays disabled until a complete validated preview exists; failed jobs show an explanation instead of opening an unavailable preview. Check valid/rejected/duplicate rows in **Row preview**, choose a named **Telecaller**, then click **Assign Telecaller & import**. Existing previews can be opened with **Review & assign Telecaller** in the import list. The selector lists active Telecallers in the import branch and current assignment scope, without granting employee-directory access. Only valid, nonduplicate customers are imported and assigned. Uploading does not publish customers before confirmation.

Both formats require backend private S3 configuration (`AWS_REGION`, `S3_BUCKET`, server-side AWS access, bucket security/CORS) and a commercial job processor. Enable `COMMERCIAL_JOBS_ENABLED=true` in the backend to process customer validation, confirmation and lead exports automatically while the API is running, or schedule `npm run jobs:commercial` separately. Do not add AWS credentials to the frontend. Automated import browser tests use isolated MongoDB and simulated private storage, not live AWS.
