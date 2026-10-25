import { test, expect, type Page } from '@playwright/test';

async function login(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Work email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill('Frontend integration passphrase 2026!');
  const response = page.waitForResponse((response) => response.url().endsWith('/auth/login'));
  await page.getByRole('button', { name: 'Sign in to workspace' }).click();
  const result = (await (await response).json()) as { data: { accessToken: string } };
  await expect(page.getByRole('link', { name: 'Employees', exact: true })).toBeVisible();
  return result.data.accessToken;
}
test('a company-wide BDO with no reports selects an active branch and creates their first employee', async ({
  page,
}) => {
  const token = await login(page, 'fixture7@frontend-test.invalid');
  await page.getByRole('link', { name: 'Employees', exact: true }).click();
  await page.getByRole('button', { name: 'Add employee', exact: true }).click();
  const modal = page.getByRole('dialog');
  const role = modal.getByRole('combobox', { name: 'Role', exact: true });
  const mh = role.locator('option').filter({ hasText: 'Marketing Head' });
  await expect(mh).toHaveCount(1);
  await role.selectOption((await mh.getAttribute('value'))!);
  const directory = await page.request.get('/api/v1/branches', {
    headers: { Authorization: 'Bearer ' + token },
  });
  expect(directory.status()).toBe(200);
  expect((await directory.json()).data).toEqual([]);
  const branch = modal.getByRole('combobox', { name: 'Primary branch', exact: true });
  const branchOption = branch.locator('option').filter({ hasText: 'Integration Branch' });
  await expect(branchOption).toHaveCount(1);
  await branch.selectOption((await branchOption.getAttribute('value'))!);
  await role.selectOption(
    (await role.locator('option').filter({ hasText: 'Branch Head' }).getAttribute('value'))!,
  );
  await expect(branch).toHaveValue('');
  await role.selectOption((await mh.getAttribute('value'))!);
  await expect(branch).toHaveValue('');
  await expect(branchOption).toHaveCount(1);
  await branch.selectOption((await branchOption.getAttribute('value'))!);
  await modal.getByLabel('Employee Code').fill('BDO-FIRST-MH');
  await modal.getByLabel('First Name').fill('Initial');
  await modal.getByLabel('Last Name').fill('Manager');
  await modal
    .getByRole('textbox', { name: 'Email', exact: true })
    .fill('bdo-first@frontend-test.invalid');
  await modal.getByLabel('Mobile Number').fill('+919999999992');
  await modal.getByLabel('Date Of Joining').fill(new Date().toISOString().slice(0, 10));
  const manager = modal.getByRole('group', { name: 'Reporting managers', exact: true });
  const self = manager.getByRole('checkbox', { name: /TEST-7/ });
  await expect(self).toHaveCount(1);
  await self.check();
  const created = page.waitForResponse(
    (response) => response.request().method() === 'POST' && response.url().endsWith('/employees'),
  );
  await modal.getByRole('button', { name: 'Create employee', exact: true }).click();
  expect((await created).status()).toBe(201);
});
