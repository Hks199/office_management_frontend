import { expect, test, type Page } from '@playwright/test';
const employeeId = 'a'.repeat(24);
const roleId = 'b'.repeat(24);
const branchRoleId = 'd'.repeat(24);
const grants = [
  'users:read',
  'users:create',
  'roles:read',
  'branches:read',
  'dashboard:read',
  'leads:read',
  'reports:read',
].map((permission) => ({ permission, scope: 'ALL' }));
async function mockApi(page: Page) {
  let authenticated = false;
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace('/api/v1', '');
    const data = (value: unknown, meta?: unknown) =>
      route.fulfill({
        json: {
          success: true,
          message: 'Operation completed',
          data: value,
          ...(meta ? { meta } : {}),
        },
      });
    if (path === '/auth/csrf')
      return authenticated
        ? data({ csrfToken: 'c'.repeat(43) })
        : route.fulfill({
            status: 401,
            json: { success: false, message: 'No session', error: { code: 'UNAUTHENTICATED' } },
          });
    if (path === '/auth/login' || path === '/auth/refresh') {
      authenticated = true;
      return data({ accessToken: 'test-access-token', csrfToken: 'c'.repeat(43), expiresIn: 900 });
    }
    if (path === '/auth/logout') {
      authenticated = false;
      return data({});
    }
    if (path === '/auth/me')
      return data({
        id: employeeId,
        firstName: 'Asha',
        lastName: 'Rao',
        employeeCode: 'SV-001',
        email: 'asha@example.com',
        mobileNumber: '+919999999999',
        roleId,
        branchId: null,
        reportingManagerId: null,
        grants,
      });
    if (path === '/auth/accept-invitation') return data({});
    if (path === '/dashboard/trends')
      return data({
        data: {
          rows: [
            { month: '2026-10', metric: 'approvedCalls', value: '6' },
            { month: '2026-10', metric: 'approvedVisits', value: '2' },
          ],
        },
      });
    if (path === '/dashboard/overview')
      return data({
        asOf: '2026-10-19T09:00:00Z',
        data: {
          employees: { available: true, total: 4, active: 4 },
          branches: { available: true, total: 2 },
          leads: {
            available: true,
            pendingLeads: 3,
            currentStatusFunnel: [{ _id: 'NEW', count: 3 }],
          },
          activities: { available: true, approvedCalls: 6 },
        },
      });
    if (path === '/employees' && route.request().method() === 'POST')
      return data({ _id: employeeId });
    if (
      path === '/roles' ||
      path === '/employees/role-options' ||
      path === '/employees/role-options/assignment'
    )
      return data([
        { _id: roleId, name: 'Company manager', allowsNoBranch: true },
        { _id: branchRoleId, name: 'Branch employee', allowsNoBranch: false },
      ]);
    if (path === '/employees/branch-options')
      return data([], { page: 1, limit: 20, total: 0, totalPages: 0 });
    if (path === '/employees/manager-options')
      return data([{ _id: employeeId, label: 'Asha Rao (SV-001)' }]);
    if (path.startsWith('/employees'))
      return data(
        [
          {
            _id: employeeId,
            employeeCode: 'SV-001',
            firstName: '<img src=x onerror=alert(1)>',
            lastName: 'Rao',
            email: 'asha@example.com',
            designation: 'Team lead',
            employmentStatus: 'ACTIVE',
            revision: 0,
            roleId,
          },
        ],
        { page: 1, limit: 20, total: 1, totalPages: 1 },
      );
    return data([], { page: 1, limit: 20, total: 0, totalPages: 0 });
  });
}
async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Work email').fill('asha@example.com');
  await page.getByLabel('Password', { exact: true }).fill('correct-horse-passphrase');
  await page.getByRole('button', { name: 'Sign in to workspace' }).click();
  await expect(page.getByRole('heading', { name: 'Your team. A bigger picture.' })).toBeVisible();
}
test.beforeEach(async ({ page }) => {
  await mockApi(page);
});
test('sign in, navigate, escape untrusted record content, and sign out', async ({
  page,
}, testInfo) => {
  await login(page);
  expect(
    await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } })),
  ).toEqual({ local: {}, session: {} });
  if (testInfo.project.name === 'mobile')
    await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('link', { name: 'Employees', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Employees', exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await expect(
    page.getByRole('cell', { name: '<img src=x onerror=alert(1)>', exact: true }),
  ).toBeVisible();
  expect(await page.locator('td img').count()).toBe(0);
  await page.getByRole('button', { name: 'Add employee', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByLabel('Employee Code')).toBeVisible();

  await page.getByRole('button', { name: 'Cancel', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'artifacts/modal-' + testInfo.project.name + '.png' });
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  if (testInfo.project.name === 'mobile')
    await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
});
test('hides unauthorized modules and denies direct route access', async ({ page }) => {
  await login(page);
  await page.goto('/policies');
  await expect(page.getByRole('heading', { name: 'Access restricted' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Creation policies', exact: true })).toHaveCount(0);
});

test('submits an employee invitation with the backend field contract', async ({
  page,
}, testInfo) => {
  await login(page);
  if (testInfo.project.name === 'mobile')
    await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('link', { name: 'Employees', exact: true }).click();
  await page.getByRole('button', { name: 'Add employee', exact: true }).click();
  const form = page.getByRole('dialog');
  await form.getByLabel('Employee Code').fill('SV-002');
  await form.getByLabel('First Name').fill('Kiran');
  await form.getByLabel('Last Name').fill('Shah');
  await form.getByRole('textbox', { name: 'Email', exact: true }).fill('kiran@example.com');
  await form.getByLabel('Mobile Number').fill('+919876543210');
  await form.getByLabel('Date Of Joining').fill('2026-10-19');
  await form.getByRole('combobox', { name: 'Role', exact: true }).selectOption(roleId);
  const primaryBranch = form.getByRole('combobox', { name: 'Primary branch', exact: true });
  await expect(primaryBranch).not.toHaveAttribute('required');
  await form.getByRole('combobox', { name: 'Role', exact: true }).selectOption(branchRoleId);
  await expect(primaryBranch).toHaveAttribute('required', '');
  await expect(
    form.getByText('No primary branches are available to your account for this role.', {
      exact: false,
    }),
  ).toBeVisible();
  await expect(primaryBranch.getByRole('option', { name: 'None', exact: true })).toHaveCount(0);
  await form.getByRole('combobox', { name: 'Role', exact: true }).selectOption(roleId);
  await expect(primaryBranch).not.toHaveAttribute('required');
  await expect(primaryBranch.getByRole('option', { name: 'None', exact: true })).toHaveCount(1);
  await form
    .getByRole('group', { name: 'Reporting managers', exact: true })
    .getByRole('checkbox', { name: 'Asha Rao (SV-001)', exact: true })
    .check();
  const sent = page.waitForRequest(
    (request) => request.url().endsWith('/api/v1/employees') && request.method() === 'POST',
  );
  await form.getByRole('button', { name: 'Create employee', exact: true }).click();
  expect((await sent).postDataJSON()).toEqual({
    employeeCode: 'SV-002',
    firstName: 'Kiran',
    lastName: 'Shah',
    email: 'kiran@example.com',
    mobileNumber: '+919876543210',
    dateOfJoining: '2026-10-19',
    roleId,
    branchId: null,
    reportingManagerIds: [employeeId],
  });
  await expect(
    page.getByRole('status').filter({ hasText: 'Employee created successfully.' }),
  ).toBeVisible();
});
test('captures invitation token from fragment and removes it from the URL', async ({ page }) => {
  await page.goto(`/accept-invitation#token=${'t'.repeat(43)}`);
  await expect(page).toHaveURL(/\/accept-invitation$/);
  await page.getByLabel('New password', { exact: true }).fill('a-unique-long-passphrase');
  await page.getByLabel('Confirm password').fill('a-unique-long-passphrase');
  const sent = page.waitForRequest((request) =>
    request.url().endsWith('/api/v1/auth/accept-invitation'),
  );
  await page.getByRole('button', { name: 'Set password' }).click();
  expect((await sent).postDataJSON()).toEqual({
    token: 't'.repeat(43),
    newPassword: 'a-unique-long-passphrase',
  });
  await expect(page.getByRole('link', { name: 'Back to sign in' })).toBeVisible();
});
test('keeps the page within the device viewport', async ({ page }, testInfo) => {
  await login(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({
    path: `artifacts/dashboard-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await expect(page.getByRole('button', { name: 'Find a module' })).toBeVisible();
  await page.getByRole('button', { name: 'Find a module' }).click();
  await page.getByLabel('Module name').fill('employees');
  await page
    .getByRole('dialog')
    .getByRole('link', { name: /Employees/ })
    .click();
  await expect(page.getByRole('heading', { name: 'Employees', exact: true })).toBeVisible();
});

test('loads daily call summaries with backend-compatible filters', async ({ page }, testInfo) => {
  await page.route('**/api/v1/telecaller-reports/daily*', (route) =>
    route.fulfill({
      json: {
        success: true,
        message: 'Daily calls retrieved',
        data: {
          timezone: 'Asia/Kolkata',
          days: [
            {
              _id: { date: '2026-10-19', employeeId },
              totalCalls: 4,
              approvedCalls: 2,
              outcomeCounts: { CONNECTED: 3, BUSY: 1 },
            },
          ],
        },
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      },
    }),
  );
  await login(page);
  if (testInfo.project.name === 'mobile')
    await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('link', { name: 'Reports & insights', exact: true }).click();
  await expect(page.getByRole('columnheader', { name: 'Total Calls', exact: true })).toBeVisible();
  await page.getByLabel('From date', { exact: true }).fill('2026-10-01');
  await page.getByLabel('To date', { exact: true }).fill('2026-10-31');
  const sent = page.waitForRequest(
    (request) =>
      request.url().includes('/telecaller-reports/daily?') &&
      request.url().includes('from=2026-10-01'),
  );
  await page.getByRole('button', { name: 'Run report', exact: true }).click();
  const url = new URL((await sent).url());
  expect(url.searchParams.get('to')).toBe('2026-10-31');
  expect(url.searchParams.has('startDate')).toBe(false);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
});
