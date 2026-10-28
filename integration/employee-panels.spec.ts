import { test, expect, type Page } from '@playwright/test';

async function login(page: Page, email = 'manager@frontend-test.invalid') {
  await page.goto('/login');
  await page.getByLabel('Work email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill('Frontend integration passphrase 2026!');
  await page.getByRole('button', { name: 'Sign in to workspace' }).click();
  await expect(page.getByRole('heading', { name: /Your team/ })).toBeVisible();
}

test('MD opens an employee panel, performs normal lead work, and returns to the manager account', async ({
  page,
}) => {
  test.setTimeout(90000);
  await login(page);
  await page.getByRole('link', { name: 'Employees', exact: true }).click();
  await page.getByRole('button', { name: 'View TEST-4', exact: true }).click();
  await page.getByRole('button', { name: 'Open employee panel', exact: true }).click();
  const banner = page.getByRole('region', { name: 'Employee panel session' });
  await expect(banner).toContainText('Sales Fixture 4 (TEST-4)');
  await expect(page.getByRole('link', { name: 'Roles & access', exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'Leads', exact: true }).click();
  await page.getByRole('button', { name: 'View Integration Lead', exact: true }).click();
  await page.getByRole('button', { name: 'Change status', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('combobox', { name: 'Status', exact: true })
    .selectOption('CONTACTED');
  await page
    .getByRole('textbox', { name: 'Reason', exact: true })
    .fill('Manager followed up through delegated employee panel');
  const updated = page.waitForResponse(
    (response) => response.request().method() === 'PATCH' && response.url().endsWith('/status'),
  );
  await page.getByRole('button', { name: 'Change status', exact: true }).click();
  expect((await updated).status()).toBe(200);
  await banner.getByRole('button', { name: 'Return to my account', exact: true }).click();
  await expect(banner).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Roles & access', exact: true })).toBeVisible();
  await expect(page.locator('.sidebar-user')).toContainText('TEST-MD');
});

test('a downline manager can open their employee panel and reload returns to their own account', async ({
  page,
}) => {
  await login(page, 'fixture8@frontend-test.invalid');
  await page.getByRole('link', { name: 'Employees', exact: true }).click();
  await page.getByRole('button', { name: 'View TEST-11', exact: true }).click();
  await page.getByRole('button', { name: 'Open employee panel', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Employee panel session' })).toContainText(
    'TEST-11',
  );
  await page.getByRole('link', { name: 'Profile & security', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Change password', exact: true })).toBeDisabled();
  await expect(
    page.getByRole('button', { name: 'Sign out all devices', exact: true }),
  ).toBeDisabled();
  await page.reload();
  await expect(page.getByRole('region', { name: 'Employee panel session' })).toHaveCount(0);
  await expect(page.locator('.sidebar-user')).toContainText('TEST-8');
});

test('expiry restores the manager account and discards an open employee work form', async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.clock.install();
  await login(page);
  await page.getByRole('link', { name: 'Employees', exact: true }).click();
  await page.getByRole('button', { name: 'View TEST-4', exact: true }).click();
  await page.getByRole('button', { name: 'Open employee panel', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Employee panel session' })).toBeVisible();
  await page.getByRole('link', { name: 'Leads', exact: true }).click();
  await page.getByRole('button', { name: 'View Integration Lead', exact: true }).click();
  await page.getByRole('button', { name: 'Change status', exact: true }).click();
  await expect(
    page.getByRole('dialog').getByRole('textbox', { name: 'Reason', exact: true }),
  ).toBeVisible();
  await page.clock.fastForward(31 * 60000);
  await expect(page.locator('.sidebar-user')).toContainText('TEST-MD');
  await expect(page.getByRole('region', { name: 'Employee panel session' })).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
