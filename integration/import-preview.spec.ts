import { test, expect } from '@playwright/test';

test('waits for validation before requesting preview rows and explains failed imports', async ({
  page,
}) => {
  const id = '123456789012345678901234';
  let status = 'QUEUED_VALIDATION';
  let rowRequests = 0;
  const job = () => ({
    _id: id,
    status,
    createdAt: '2026-10-23T05:00:00.000Z',
    revision: 0,
    totalRows: status === 'PREVIEW_READY' ? 1 : 0,
    acceptedRows: status === 'PREVIEW_READY' ? 1 : 0,
    rejectedRows: 0,
    importedRows: 0,
    errorCode: status === 'FAILED' ? 'STORAGE_ACCESS_DENIED' : '',
  });
  await page.route('**/api/v1/csv-imports**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    let data: unknown = path.endsWith('/csv-imports') ? [job()] : job();
    if (path.endsWith('/rows')) {
      rowRequests++;
      expect(status).toBe('PREVIEW_READY');
      data = [
        { rowNumber: 2, status: 'VALID', normalizedData: { customerName: 'Preview contact' } },
      ];
    }
    if (path.endsWith('/assignees')) data = [];
    await route.fulfill({
      json: {
        success: true,
        message: 'Retrieved',
        data,
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      },
    });
  });
  await page.goto('/login');
  await page.getByLabel('Work email').fill('manager@frontend-test.invalid');
  await page.getByLabel('Password', { exact: true }).fill('Frontend integration passphrase 2026!');
  await page.getByRole('button', { name: 'Sign in to workspace' }).click();
  await page.getByRole('link', { name: 'Contact imports', exact: true }).click();
  await page.getByRole('button', { name: 'View import progress', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: 'Row preview', exact: true })).toBeDisabled();
  expect(rowRequests).toBe(0);
  status = 'FAILED';
  await expect(dialog.getByRole('alert')).toContainText('Private storage access was denied', {
    timeout: 10000,
  });
  await expect(dialog.getByRole('button', { name: 'Row preview', exact: true })).toBeDisabled();
  expect(rowRequests).toBe(0);
  status = 'PREVIEW_READY';
  await dialog.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: 'Refresh records' }).click();
  await page.getByRole('button', { name: 'Review & assign Telecaller', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Row preview', exact: true })).toBeEnabled();
  await dialog.getByRole('button', { name: 'Row preview', exact: true }).click();
  await expect(dialog.getByText(/Preview contact/)).toBeVisible();
  expect(rowRequests).toBe(1);
  await expect(dialog.getByText('A complete validated preview is required')).toHaveCount(0);
});
