import { test, expect } from '@playwright/test';

test('MD can select all approved system employee roles', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Work email').fill('manager@frontend-test.invalid');
  await page.getByLabel('Password', { exact: true }).fill('Frontend integration passphrase 2026!');
  await page.getByRole('button', { name: 'Sign in to workspace' }).click();
  await page.getByRole('link', { name: 'Employees', exact: true }).click();
  const loaded = page.waitForResponse((response) =>
    response.url().includes('/employees/role-options?'),
  );
  await page.getByRole('button', { name: 'Add employee', exact: true }).click();
  const response = await loaded;
  expect(response.status()).toBe(200);
  const roles = (await response.json()) as { data: { _id: string; code: string }[] };
  expect(roles.data.map((role) => role.code).sort()).toEqual(['BDO', 'BH', 'MH', 'SEX', 'TC']);
  const role = page.getByRole('dialog').getByRole('combobox', { name: 'Role', exact: true });
  await expect(role).toBeEnabled();
  for (const option of roles.data) {
    await role.selectOption(option._id);
    await expect(role).toHaveValue(option._id);
  }
});

test('MD sees an actionable policy-review message when role revisions are stale', async ({
  page,
}) => {
  await page.route('**/employees/role-options?*', async (route) => {
    await route.fulfill({
      json: {
        success: true,
        message: 'Approved roles retrieved',
        data: [],
        meta: { page: 1, limit: 100, total: 0, totalPages: 0, policyReviewRequired: true },
      },
    });
  });
  await page.goto('/login');
  await page.getByLabel('Work email').fill('manager@frontend-test.invalid');
  await page.getByLabel('Password', { exact: true }).fill('Frontend integration passphrase 2026!');
  await page.getByRole('button', { name: 'Sign in to workspace' }).click();
  await page.getByRole('link', { name: 'Employees', exact: true }).click();
  await page.getByRole('button', { name: 'Add employee', exact: true }).click();
  await expect(page.getByText(/Role permissions have changed/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Review creation policies' })).toHaveAttribute(
    'href',
    '/policies',
  );
});

test('a branch head can select approved employee roles without role-administration access', async ({
  page,
}) => {
  let createRequests = 0;
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().endsWith('/employees')) createRequests++;
  });
  await page.goto('/login');
  await page.getByLabel('Work email').fill('fixture6@frontend-test.invalid');
  await page.getByLabel('Password', { exact: true }).fill('Frontend integration passphrase 2026!');
  const signingIn = page.waitForResponse((response) => response.url().endsWith('/auth/login'));
  await page.getByRole('button', { name: 'Sign in to workspace' }).click();
  const session = (await (await signingIn).json()) as { data: { accessToken: string } };
  expect(
    (
      await page.request.get('/api/v1/roles', {
        headers: { Authorization: 'Bearer ' + session.data.accessToken },
      })
    ).status(),
  ).toBe(403);
  await page.getByRole('link', { name: 'Employees', exact: true }).click();
  const optionsResponse = page.waitForResponse((response) =>
    response.url().includes('/employees/role-options?'),
  );
  await page.getByRole('button', { name: 'Add employee', exact: true }).click();
  const response = await optionsResponse;
  expect(response.status()).toBe(200);
  const roles = (await response.json()) as { data: { _id: string; code: string }[] };
  expect(roles.data.map((role) => role.code).sort()).toEqual(['SEX', 'TC']);
  const modal = page.getByRole('dialog');
  const role = modal.getByRole('combobox', { name: 'Role', exact: true });
  await expect(role).toBeEnabled();
  await role.selectOption(roles.data.find((role) => role.code === 'TC')!._id);
  await expect(modal.getByText('Access denied', { exact: true })).toHaveCount(0);
  await modal.getByLabel('Employee Code').fill('LOOKUP-TC');
  await modal.getByLabel('First Name').fill('Lookup');
  await modal.getByLabel('Last Name').fill('Employee');
  await modal
    .getByRole('textbox', { name: 'Email', exact: true })
    .fill('lookup-created@frontend-test.invalid');
  await modal.getByLabel('Mobile Number').fill('9999999991');
  await modal.getByLabel('Date Of Joining').fill(new Date().toISOString().slice(0, 10));
  const branch = modal.getByRole('combobox', { name: 'Primary branch', exact: true });
  await expect(branch).toHaveAttribute('required', '');
  await expect(branch.getByRole('option', { name: 'None', exact: true })).toHaveCount(0);
  await expect(branch.locator('option').filter({ hasText: 'Integration Branch' })).toHaveCount(1);
  const manager = modal.getByRole('group', { name: 'Reporting managers', exact: true });
  const self = manager.getByRole('checkbox', { name: /TEST-6/ });
  await expect(self).toHaveCount(1);
  await self.check();
  await modal.getByRole('button', { name: 'Create employee', exact: true }).click();
  expect(await branch.evaluate((select: HTMLSelectElement) => select.validity.valueMissing)).toBe(
    true,
  );
  expect(createRequests).toBe(0);
  await branch.selectOption(
    (await branch
      .locator('option')
      .filter({ hasText: 'Integration Branch' })
      .getAttribute('value'))!,
  );
  const created = page.waitForResponse(
    (response) => response.request().method() === 'POST' && response.url().endsWith('/employees'),
  );
  await modal.getByRole('button', { name: 'Create employee', exact: true }).click();
  expect((await created).status()).toBe(201);
  expect(await (await created).json()).toHaveProperty('data.mobileNumber', '+919999999991');
  await expect(modal).not.toBeVisible();
});
