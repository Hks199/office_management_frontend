import { test, expect, type Page } from '@playwright/test';
const password = 'Frontend integration passphrase 2026!';
async function login(page: Page, email = 'manager@frontend-test.invalid') {
  await page.goto('/login');
  await page.getByLabel('Work email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  const response = page.waitForResponse((response) =>
    response.url().endsWith('/api/v1/auth/login'),
  );
  await page.getByRole('button', { name: 'Sign in to workspace' }).click();
  const payload = (await (await response).json()) as { data: { accessToken: string } };
  await expect(page.getByRole('heading', { name: /Your team/ })).toBeVisible();
  return payload.data.accessToken;
}
async function openModule(page: Page, name: string) {
  await page.getByRole('link', { name, exact: true }).click();
}
test('real policy PUT preserves revision and selected manager roles', async ({ page }) => {
  const token = await login(page);
  const roles = (await (
    await page.request.get('/api/v1/roles?limit=100', {
      headers: { Authorization: `Bearer ${token}` },
    })
  ).json()) as { data: { _id: string; code: string }[] };
  const creator = roles.data.find((role) => role.code === 'TEST_CREATOR')!;
  const policies = (await (
    await page.request.get('/api/v1/role-creation-policies?limit=100', {
      headers: { Authorization: `Bearer ${token}` },
    })
  ).json()) as { data: { _id: string; creatorRoleId: string; revision: number }[] };
  const policy = policies.data.find((policy) => policy.creatorRoleId === creator._id)!;
  await openModule(page, 'Creation policies');
  await page
    .getByRole('row')
    .filter({ has: page.getByRole('cell', { name: 'Integration Creator', exact: true }) })
    .getByRole('button', { name: 'View Integration Creator', exact: true })
    .click();
  await page.getByRole('button', { name: 'Edit creation policy', exact: true }).click();
  await page.getByRole('combobox', { name: 'Branch Rule' }).selectOption('EXPLICIT_SCOPE');
  const sent = page.waitForResponse(
    (response) =>
      response.request().method() === 'PUT' &&
      response.url().endsWith(`/role-creation-policies/${policy._id}`),
  );
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  expect((await sent).status()).toBe(200);
  const changed = (await (await sent).json()) as {
    data: { revision: number; allowedManagerRoleIds: string[] };
  };
  expect(changed.data.revision).toBe(policy.revision + 1);
  expect(changed.data.allowedManagerRoleIds).toContain(creator._id);
});
test('saves a real branch policy and independent working calendar', async ({ page }) => {
  await login(page);
  await openModule(page, 'Branches');
  await page.getByRole('button', { name: 'View TEST', exact: true }).click();
  await page.getByRole('button', { name: 'Attendance settings', exact: true }).click();
  const modal = page.getByRole('dialog', { name: 'Branch attendance settings', exact: true });
  await modal.getByLabel('Work starts').fill('09:00');
  await modal.getByLabel('Work ends').fill('18:00');
  await modal.getByLabel('Grace period (minutes)', { exact: true }).fill('15');
  const policyResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'PATCH' && /\/branches\/[a-f0-9]{24}$/.test(response.url()),
  );
  await modal.getByRole('button', { name: 'Save attendance policy' }).click();
  expect((await policyResponse).status()).toBe(200);
  await expect(modal.getByRole('status')).toHaveText('Branch configuration saved.');
  await modal.getByRole('button', { name: 'Working calendar', exact: true }).click();
  await modal.getByLabel('Monday', { exact: true }).check();
  await modal.getByLabel('Tuesday', { exact: true }).check();
  await modal.getByLabel('Holidays', { exact: true }).fill('2026-12-25');
  const calendarResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'PUT' &&
      response.url().includes('/dashboard/attendance-calendars/'),
  );
  await modal.getByRole('button', { name: 'Save working calendar' }).click();
  expect((await calendarResponse).status()).toBe(200);
  const body = (await (await calendarResponse).json()) as {
    data: { workingWeekdays: number[]; revision: number };
  };
  expect(body.data.workingWeekdays).toEqual([1, 2]);
  expect(body.data.revision).toBe(1);
});
test('creates a real workflow version and displays locked duplicate rules', async ({ page }) => {
  await login(page);
  await openModule(page, 'Commercial settings');
  await page.getByRole('button', { name: 'Edit transitions', exact: true }).click();
  await page
    .getByRole('combobox', { name: 'Transition 1 to', exact: true })
    .selectOption('CONTACTED');
  await page.getByRole('button', { name: 'Remove transition 2', exact: true }).click();
  const response = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' && response.url().endsWith('/lead-workflows'),
  );
  await page.getByRole('button', { name: 'Save new workflow version', exact: true }).click();
  expect((await response).status()).toBe(201);
  await expect(page.getByRole('status')).toContainText('A new workflow version was saved.');
  await page
    .getByRole('combobox', { name: 'Duplicate scope', exact: true })
    .selectOption('COMPANY');
  await page.getByRole('button', { name: 'Save duplicate rules' }).click();
  await expect(page.getByRole('alert')).toContainText(
    'Duplicate policy cannot change after contact data exists',
  );
});
test('approves a real assignment proposal and reads assignment history', async ({ page }) => {
  await login(page);
  await openModule(page, 'Leads');
  await page.getByRole('button', { name: 'View Integration Lead', exact: true }).click();
  await page.getByRole('button', { name: 'Assignment proposals', exact: true }).click();
  await page.getByRole('button', { name: /Review proposal to/ }).click();
  const modal = page.getByRole('dialog', { name: 'Review assignment proposal', exact: true });
  await modal.getByRole('combobox', { name: 'Decision' }).selectOption('APPROVED');
  await modal.getByRole('textbox', { name: 'Reason' }).fill('Approve integration recipient');
  const response = page.waitForResponse(
    (response) =>
      response.request().method() === 'PATCH' &&
      response.url().includes('/lead-assignment-proposals/'),
  );
  await modal.getByRole('button', { name: 'Submit decision' }).click();
  expect((await response).status()).toBe(200);
  await expect(page.getByRole('status')).toContainText('Proposal decision saved.');
  await page.getByRole('button', { name: 'Assignments', exact: true }).click();
  await expect(
    page.getByRole('definition').filter({ hasText: 'Approve integration recipient' }),
  ).toBeVisible();
});
test('reads actual daily summaries, target reports and operations metrics', async ({ page }) => {
  await login(page);
  await openModule(page, 'Reports & insights');
  await expect(
    page.getByRole('heading', { name: 'Daily call summary', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Total Calls', exact: true })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Date', exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'Report', exact: true }).selectOption('target-reports');
  await expect(
    page.getByRole('columnheader', { name: 'Achievement Percentage', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('combobox', { name: 'Report', exact: true })
    .selectOption('role-performance');
  await expect(page.getByRole('heading', { name: 'Role performance', exact: true })).toBeVisible();
  await expect(
    page.getByRole('columnheader', { name: 'Approved Calls', exact: true }),
  ).toBeVisible();
  await openModule(page, 'Operations');
  await expect(page.getByRole('heading', { name: 'Queues', exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});
test('gets private attendance evidence through real API authorization', async ({ page }) => {
  await login(page);
  await openModule(page, 'Attendance');
  const row = page.locator('tbody tr').first();
  await row.getByRole('button', { name: /View/ }).click();
  await page.route('https://frontend-fixture.s3.ap-south-1.amazonaws.com/evidence.png', (route) =>
    route.fulfill({
      contentType: 'image/png',
      body: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jhWQAAAAASUVORK5CYII=',
        'base64',
      ),
    }),
  );
  const response = page.waitForResponse((response) => response.url().includes('/photos/check-in'));
  await page.getByRole('button', { name: 'Check-in photo', exact: true }).click();
  expect((await response).status()).toBe(200);
  await expect(
    page.getByRole('img', { name: 'Submitted attendance or site visit evidence' }),
  ).toBeVisible();
});
test('real restricted identity cannot access administration screens', async ({ page }) => {
  await login(page, 'fixture3@frontend-test.invalid');
  await expect(page.getByRole('link', { name: 'Commercial settings', exact: true })).toHaveCount(0);
  await page.evaluate(() => {
    history.pushState(null, '', '/commercial');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(page.getByRole('heading', { name: 'Access restricted' })).toBeVisible();
});

test('reassigns selected contacts and reads their real assignment history', async ({ page }) => {
  await login(page);
  await openModule(page, 'Contacts');
  await expect(
    page.getByText('Contacts are assigned to a telecaller during import.', { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /^Reassign \d+ contacts?$/ })).toHaveCount(0);
  await page
    .getByRole('checkbox', { name: 'Select contact Integration Contact', exact: true })
    .check();
  await expect(page.getByRole('button', { name: /^Assign \d+ contacts?$/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Reassign 1 contact', exact: true }).click();
  const modal = page.getByRole('dialog', { name: 'Reassign selected contacts', exact: true });
  const recipientSelect = modal.getByRole('combobox', { name: 'New telecaller', exact: true });
  const recipient = recipientSelect.locator('option').filter({ hasText: 'TEST-3' });
  await expect(recipient).toHaveCount(1);
  await recipientSelect.selectOption((await recipient.getAttribute('value'))!);
  await modal
    .getByRole('textbox', { name: 'Reason', exact: true })
    .fill('Integration bulk assignment');
  const response = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' && response.url().endsWith('/customers/assignments'),
  );
  await modal.getByRole('button', { name: 'Reassign contacts', exact: true }).click();
  expect((await response).status()).toBe(200);
  await page.getByRole('button', { name: 'View Integration Contact', exact: true }).click();
  await page.getByRole('button', { name: 'Assignments', exact: true }).click();
  await expect(
    page.getByRole('definition').filter({ hasText: 'Integration bulk assignment' }),
  ).toBeVisible();
});
test('captures missing target evidence through the dedicated milestone endpoint', async ({
  page,
}) => {
  await login(page);
  await openModule(page, 'Leads');
  await page.getByRole('button', { name: 'View Integration Lead', exact: true }).click();
  await page.getByRole('button', { name: 'Capture target milestone', exact: true }).click();
  await page.getByRole('combobox', { name: 'Milestone', exact: true }).selectOption('CREATED');
  const response = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response.url().includes('/target-evidence/leads/') &&
      response.url().endsWith('/capture'),
  );
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Capture target milestone', exact: true })
    .click();
  expect((await response).status()).toBe(200);
  expect((await response).request().postDataJSON()).toEqual({ milestone: 'CREATED' });
});
