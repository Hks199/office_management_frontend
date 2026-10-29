# Attendance supervision

Open **Attendance**. The default is today's India business date. Choose Today,
Yesterday, This week (Monday onward), This month, or enter a custom range of up
to 366 days. Select filters and click **Apply filters**. **Reset to today** clears
all team and status filters.

- Branch, employee, reporting manager and role lookups appear when the account
  has the corresponding directory permission. Employee options support searching
  by name/code. Reporting manager includes that employee's descendants at every
  reporting level, including multiple-manager relationships; it excludes the manager.
- Attendance status distinguishes **Awaiting checkout** and **Checked out**.
- Punctuality filters late arrivals or early exits using the saved attendance policy.
- Review filters Pending, Approved or Rejected attendance records.
- Location evidence can select records flagged outside the configured geofence.
  An unflagged record is not proof of an approved location: a geofence may not
  have been configured when the record was created.

Summary cards count employee-day records across the applied dates and team,
before status, review, punctuality and location filters. Clicking a card replaces
those status filters while retaining date and team selections. For multi-day
ranges, these counts are attendance records, not unique employees. All counts
come from the server, including records beyond the currently displayed page.

The table displays effective (corrected, when applicable) times and working
hours. Open records remain In progress. Use the existing row details to inspect
photo evidence and GPS coordinates and perform permitted reviews/corrections.

**Export filtered CSV** exports every matching page, not just the visible page,
up to 10,000 records. Narrow the filters for larger exports. Files use readable
employee/branch labels, IST times and spreadsheet formula protection. If records
are inserted or deleted during export, retry rather than accepting partial results.

Attendance scope is enforced by the backend for lists, summaries and export
requests. Choosing a manager, role, employee or branch never grants more access.
Filters for role and reporting manager use current organization assignments;
date, branch, punctuality, location and review filters use attendance records.

No absence or payroll inference is made from missing records. Correct absence
calculation requires working schedules, approved leave and holiday handling.

## Deployment

Deploy **both** backend and frontend changes. The attendance API now accepts
paired inclusive `from`/`to` business dates, `managerId`, `roleId` and
`outsideGeofence`, alongside existing employee, branch and status filters.
Existing monthly reports continue to work when no explicit date range is supplied.
The hosted application cannot use the new filters until the backend is deployed.

Backend tests: `npx vitest run tests/unit/attendance-filters.test.ts tests/unit/attendance-policy.test.ts`.
Frontend tests: `npx vitest run src/features/attendance/supervision.test.ts src/features/attendance/AttendanceFilters.test.tsx`.
