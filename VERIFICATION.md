# Verification record

Individual daily sales reporting uses the existing site-visit backend. The real-backend browser regression starts a Sales Executive visit with GPS, cancels the completion form, reloads and resumes the persisted visit, uploads a private photo without API authorization headers, submits the report and reads its saved discussion and evidence. Additional checks cover mobile navigation/layout and deny the sales reporting route to telecallers. AWS transfers are intercepted at the isolated fixture's test bucket; application credentials and live records are never used. The backend reporting integration suite verifies owner/assignment scope, photo ownership, submission rules, revision checks and review authorization.

BDO branch selection regression: the real-backend browser test starts with a company-wide BDO with no reports, selects an active branch from the role-dependent creation lookup, and creates the first MH without MD first provisioning a team. Backend tests cover minimal label projection, active branches only, search and pagination, role policy validation, unrelated-manager denial, retained employee read/transfer restrictions, and primary-branch BDO restrictions. No live branch assignments or role grants are changed.

Primary-branch validation follows the selected role's allowsNoBranch flag. Unit tests cover required branches, allowed company-wide placement, stale role metadata and unrelated forms. The real-backend branch-head scenario verifies that an empty required branch blocks the POST and that selecting an authorized branch permits employee creation. Desktop/mobile invitation checks cover switching between branch-based and company-wide roles. The live application database was inspected read-only and had no branches; no branch or employee was created there by these checks.

The employee role-dropdown permission fix passed a real-backend browser test using a branch head without role-administration access: `/roles` remains forbidden, approved subordinate role options load, and employee creation succeeds. Backend organization tests verify minimal role projections, authentication, creator/assignment authority, search/pagination, rejection of forged creator filters and exclusion of stale/inactive policies. Desktop and mobile employee-invitation browser checks also passed.

The attendance browser scenarios cover the immediate Turn on GPS modal before any location request, its reappearance when browser permission is already granted, the backend-authorized next action, daily completion, GPS before camera, denied permissions, repeated GPS failures, settings-return rechecks, location loss during confirmation, camera cleanup and status-loading retry. Desktop and 390px mobile popup screenshots were inspected; the GPS action is visible in both. All 27 frontend unit tests and the frontend production build passed. Backend attendance integration tests cover self-status isolation, completed attendance, open records outside the current month and expired open attendance.

Completed locally on 19 October 2026:

- ESLint with zero warnings, strict TypeScript, and the Vite production build passed.
- 22 unit tests passed across API transport/session, file-boundary, form-contract and administration-validation suites.
- 12 Playwright scenarios passed across desktop Chromium and mobile Chromium. They cover sign-in/out, safe text rendering, permission-based navigation/direct route denial, employee invitation payloads, invitation fragment handling, module search, dialogs, viewport containment and daily-report query filters.
- 12 additional browser tests passed against the actual backend source and a fresh temporary MongoDB replica set. These use real bearer authentication, cookie sessions, Express validation, scoped authorization, transactions and persistence. The tests verified creation-policy PUT/revisions, branch policy PATCH, working-calendar PUT, workflow versioning, duplicate-policy locking, proposal approval/history, daily/target/role reports, operations metrics, private-photo authorization, restricted identities, batch customer assignment/history and milestone capture. Attendance tests additionally verify live JPEG capture using Chromium's simulated camera, credential-free intercepted S3 POSTs, upload confirmation, current GPS coordinates persisted in MongoDB for check-in/check-out, denied location/camera permission handling and camera shutdown when the dialog closes.
- Prettier formatting checks passed.
- `npm audit` reported zero known vulnerabilities, including development dependencies.
- The actual running backend readiness endpoint returned HTTP 200, both directly and through the Vite API proxy.
- The actual proxied `/api/v1/auth/csrf` endpoint returned the expected HTTP 401 without a session cookie, confirming that the proxy's missing-Origin fallback reaches session validation rather than failing Origin validation.
- Desktop and mobile dashboard screenshots were inspected. Browser testing identified and resolved mobile table/dialog overflow and an icon-only search button missing an accessible name.

The standard browser suite uses mocked API fixtures. The separate integration suite runs the real sibling backend against its own loopback-only temporary database; it never reads the application's backend `.env` or connects to its database. Photo storage is injected and image delivery is intercepted for these tests. Live SMTP, AWS S3 uploads/CORS/IAM, real-device geolocation, scheduled worker execution, TLS and nginx deployment remain environment-specific acceptance checks. No backend source or application security settings were modified. No deployment was performed.

## Remaining UI completed

| Backend area                                        | UI entry point                                                                 |
| --------------------------------------------------- | ------------------------------------------------------------------------------ |
| Role-creation policy editing                        | Creation policies → record → Edit creation policy (PUT + revision)             |
| Customer assignment and history                     | Customers → select records → Assign; record → Assignments                      |
| Lead assignment proposals                           | Leads → record → Assignment proposals → Review                                 |
| Lead and customer assignment history                | Record details → Assignments; paginated even when the API returns a bare array |
| Versioned workflows and duplicate scope             | Commercial settings                                                            |
| Attendance policy, schedule and geofence            | Branches → record → Attendance settings → Attendance policy                    |
| Working weekdays and holidays                       | Branches → record → Attendance settings → Working calendar                     |
| Private evidence photos                             | Attendance or site visit record → Private photo evidence                       |
| Daily call and verified target reports              | Reports & insights → report selector                                           |
| Attendance summaries and employee/branch attendance | Reports & insights → report selector                                           |
| All scoped dashboard report kinds                   | Reports & insights → dashboard/performance selector; includes private exports  |
| Reporting downlines                                 | Reports & insights → Reporting downlines                                       |
| Target milestone capture                            | Leads → record → Capture target milestone                                      |
| Operations metrics and queues                       | Operations                                                                     |
| Custom CSV headers                                  | Customer imports → Upload CSV → CSV column mapping                             |
| Inactive and cancelled records                      | Active-status filters on organization/master data and status filter on targets |

Operational commands without HTTP endpoints, including invitation reissue, remain backend commands. Planned notification/audit-log browsing endpoints are not fabricated in the frontend.

Re-run the commands in [README.md](README.md) after changes. Dependency audit results describe known advisories at the time of execution and do not guarantee absence of vulnerabilities.
