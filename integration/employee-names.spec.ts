import { test, expect } from '@playwright/test';

test('a sales executive sees role, branch and manager names without role-administration access', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByLabel('Work email').fill('fixture4@frontend-test.invalid');
  await page.getByLabel('Password', { exact: true }).fill('Frontend integration passphrase 2026!');
  await page.getByRole('button', { name: 'Sign in to workspace' }).click();
  await page.getByRole('link', { name: 'Employees', exact: true }).click();
  await page.getByRole('button', { name: 'View TEST-4', exact: true }).click();
  const dialog = page.getByRole('dialog');
  const field = (title: string) =>
    dialog
      .locator('.record-details > div')
      .filter({ has: page.locator('dt', { hasText: new RegExp(`^${title}$`) }) })
      .locator('dd');
  await expect(field('Role')).toHaveText('Sales Executive');
  await expect(field('Branch')).toHaveText('Integration Branch');
  await expect(field('Reporting managers')).toHaveText('Integration Manager (TEST-MD)');
  await expect(
    dialog.locator('dt').filter({ hasText: /^(Role Id|Branch Id|Reporting Manager Id)$/ }),
  ).toHaveCount(0);
  const values = await dialog.locator('dd').allTextContents();
  expect(values.some((value) => /^[a-f0-9]{24}$/.test(value))).toBe(false);
});
