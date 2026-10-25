import { test, expect } from '@playwright/test';

test('a branch-less MH selects an active branch and creates their first branch head', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByLabel('Work email').fill('fixture8@frontend-test.invalid');
  await page.getByLabel('Password', { exact: true }).fill('Frontend integration passphrase 2026!');
  await page.getByRole('button', { name: 'Sign in to workspace' }).click();
  await page.getByRole('link', { name: 'Employees', exact: true }).click();
  await page.getByRole('button', { name: 'Add employee', exact: true }).click();
  const modal = page.getByRole('dialog');
  const role = modal.getByRole('combobox', { name: 'Role', exact: true });
  const head = role.getByRole('option', { name: 'Branch Head', exact: true });
  await expect(head).toHaveCount(1);
  await role.selectOption((await head.getAttribute('value'))!);
  const branch = modal.getByRole('combobox', { name: 'Primary branch', exact: true });
  await expect(branch).toBeEnabled();
  await expect(branch).toHaveAttribute('required', '');
  await expect(branch.getByRole('option', { name: 'None', exact: true })).toHaveCount(0);
  const option = branch.getByRole('option', { name: 'Integration Branch', exact: true });
  await expect(option).toHaveCount(1);
  const branchId = (await option.getAttribute('value'))!;
  await branch.selectOption(branchId);
  await expect(modal.getByText('No primary branches are available', { exact: false })).toHaveCount(
    0,
  );
  const manager = modal.getByRole('group', { name: 'Reporting managers', exact: true });
  const self = manager.getByRole('checkbox', { name: /TEST-8/ });
  await expect(self).toHaveCount(1);
  await self.check();
  await modal.getByLabel('Employee Code').fill('MH-FIRST-BH');
  await modal.getByLabel('First Name').fill('First');
  await modal.getByLabel('Last Name').fill('Head');
  await modal
    .getByRole('textbox', { name: 'Email', exact: true })
    .fill('mh-first-head@frontend-test.invalid');
  await modal.getByLabel('Mobile Number').fill('+919999999984');
  await modal.getByLabel('Date Of Joining').fill(new Date().toISOString().slice(0, 10));
  const created = page.waitForResponse(
    (response) => response.request().method() === 'POST' && response.url().endsWith('/employees'),
  );
  await modal.getByRole('button', { name: 'Create employee', exact: true }).click();
  const response = await created;
  expect(response.status()).toBe(201);
  expect((await response.json()).data.branchId).toBe(branchId);
  await expect(modal).not.toBeVisible();
});
