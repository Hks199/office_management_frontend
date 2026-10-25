import { test, expect } from '@playwright/test';

for (const email of ['manager@frontend-test.invalid', 'fixture3@frontend-test.invalid']) {
  test(`contact assignment names appear for ${email}`, async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Work email').fill(email);
    await page
      .getByLabel('Password', { exact: true })
      .fill('Frontend integration passphrase 2026!');
    await page.getByRole('button', { name: 'Sign in to workspace' }).click();
    await page.getByRole('link', { name: 'Contacts', exact: true }).click();
    await expect(page).toHaveURL(/\/contacts$/);
    await page.goto('/customers');
    await expect(page).toHaveURL(/\/customers$/);
    await expect(page.getByRole('heading', { name: 'Customers', exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Contacts', exact: true }).click();
    const row = page.getByRole('row').filter({
      has: page.getByRole('button', { name: 'View Integration Contact', exact: true }),
    });
    await expect(
      row.getByRole('cell', { name: 'Caller Fixture 3 (TEST-3)', exact: true }),
    ).toBeVisible();
    await expect(row).not.toContainText('Assigned to unavailable');
    await row.getByRole('button', { name: 'View Integration Contact', exact: true }).click();
    const dialog = page.getByRole('dialog');
    const field = (title: string) =>
      dialog
        .locator('.record-details > div')
        .filter({ has: page.locator('dt', { hasText: new RegExp(`^${title}$`) }) })
        .locator('dd');
    await expect(field('Assigned to')).toHaveText('Caller Fixture 3 (TEST-3)');
    await expect(field('Assigned by')).toHaveText('Integration Manager (TEST-MD)');
    await expect(field('Created by')).toHaveText('Integration Manager (TEST-MD)');
    await expect(field('Branch')).toHaveText('Integration Branch');
    await dialog.getByRole('button', { name: 'Assignments', exact: true }).click();
    await expect(field('Assigned to')).toContainText(['Caller Fixture 3 (TEST-3)']);
    await expect(field('Assigned by')).toContainText(['Integration Manager (TEST-MD)']);
  });
}
