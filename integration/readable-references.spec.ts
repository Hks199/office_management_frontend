import { expect, test } from '@playwright/test';

test('shared tables and details show readable role, geography and call references without database IDs', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByLabel('Work email').fill('manager@frontend-test.invalid');
  await page.getByLabel('Password', { exact: true }).fill('Frontend integration passphrase 2026!');
  await page.getByRole('button', { name: 'Sign in to workspace' }).click();
  await page.getByRole('link', { name: 'Creation policies', exact: true }).click();
  const policy = page
    .getByRole('row')
    .filter({ has: page.getByRole('cell', { name: 'Integration Creator', exact: true }) });
  await expect(policy.getByRole('cell', { name: 'Integration Target', exact: true })).toBeVisible();
  await policy.getByRole('button', { name: 'View Integration Creator', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await expect(dialog.locator('dd').filter({ hasText: /^Integration Creator$/ })).toHaveCount(2);
  expect(await dialog.innerText()).not.toMatch(/\b[a-f\d]{24}\b/i);
  await dialog.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await page.getByRole('link', { name: 'Branches', exact: true }).click();
  const branch = page
    .getByRole('row')
    .filter({ has: page.getByRole('cell', { name: 'Integration Branch', exact: true }) });
  await branch.getByRole('button', { name: 'View TEST', exact: true }).click();
  dialog = page.getByRole('dialog');
  await expect(dialog.locator('dd').filter({ hasText: /^Integration State$/ })).toBeVisible();
  await expect(dialog.locator('dd').filter({ hasText: /^Integration District$/ })).toBeVisible();
  expect(await dialog.innerText()).not.toMatch(/\b[a-f\d]{24}\b/i);
  await dialog.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await page.getByRole('link', { name: 'Call reports', exact: true }).click();
  await page
    .getByRole('row')
    .filter({ has: page.getByRole('cell', { name: 'Integration Contact', exact: true }) })
    .getByRole('button', { name: /^View / })
    .click();
  dialog = page.getByRole('dialog');
  await expect(dialog.locator('dd').filter({ hasText: /^Caller Fixture 3$/ })).toBeVisible();
  await expect(dialog.locator('dd').filter({ hasText: /^Integration Branch$/ })).toBeVisible();
  expect(await dialog.innerText()).not.toMatch(/\b[a-f\d]{24}\b/i);
});
