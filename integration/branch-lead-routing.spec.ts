import { test, expect } from '@playwright/test';

test('telecaller routes by address, receiving head assigns a local executive, and only that executive progresses the lead', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const login = async (email: string) => {
    await page.context().clearCookies();
    await page.goto('/login');
    await page.getByLabel('Work email').fill(email);
    await page
      .getByLabel('Password', { exact: true })
      .fill('Frontend integration passphrase 2026!');
    const response = page.waitForResponse((response) => response.url().endsWith('/auth/login'));
    await page.getByRole('button', { name: 'Sign in to workspace' }).click();
    const result = await response;
    expect(result.status()).toBe(200);
    return ((await result.json()).data as { accessToken: string }).accessToken;
  };
  const callerToken = await login('fixture3@frontend-test.invalid');
  await page.getByRole('link', { name: 'Contacts', exact: true }).click();
  await page.getByRole('button', { name: 'View Branch Routing Contact', exact: true }).click();
  await page.getByRole('button', { name: 'Update status', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByRole('combobox', { name: 'Status', exact: true }).selectOption('INTERESTED');
  await dialog.getByLabel('Reason').fill('Interested caller in destination service area');
  await dialog.getByRole('button', { name: 'Update status', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole('button', { name: 'View Branch Routing Contact', exact: true }).click();
  await page.getByRole('button', { name: 'Convert to lead', exact: true }).click();
  dialog = page.getByRole('dialog');
  await expect(dialog.getByText(/Site served by Destination Branch/)).toBeVisible();
  const branch = dialog.getByRole('combobox', { name: 'Receiving branch', exact: true });
  const option = branch.getByRole('option').filter({ hasText: 'Destination Branch (DEST)' });
  await expect(option).toHaveCount(1);
  await expect(option).toHaveText(/Destination District/);
  await branch.selectOption((await option.getAttribute('value'))!);
  await dialog.getByRole('textbox', { name: 'Required capacity (kW)', exact: true }).fill('5');
  await dialog.getByRole('textbox', { name: /^Rate per kW/ }).fill('45000');
  for (const [name, value] of [
    ['Payment Mode', 'Integration bank transfer'],
    ['Panel Brand', 'Integration panel brand'],
    ['Panel Technology', 'Integration panel technology'],
    ['Lead Source', 'Integration website enquiry'],
  ]) {
    await dialog.getByRole('combobox', { name, exact: true }).selectOption({ label: value });
  }
  const response = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      /\/customers\/[a-f0-9]{24}\/convert$/.test(response.url()),
  );
  await dialog.getByRole('button', { name: 'Convert to lead', exact: true }).click();
  const converted = await response;
  expect(converted.status()).toBe(200);
  const lead = (await converted.json()).data as { _id: string; assignedTo: null; branchId: string };
  expect(lead.assignedTo).toBeNull();
  await page.getByRole('link', { name: 'Leads', exact: true }).click();
  await page.getByRole('button', { name: 'View Branch Routing Contact', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Assign lead', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Change status', exact: true })).toHaveCount(0);
  const forbidden = await page.request.patch(`/api/v1/leads/${lead._id}/status`, {
    headers: { Authorization: `Bearer ${callerToken}` },
    data: { revision: 0, status: 'CONVERTED', reason: 'Caller may not confirm a sale' },
  });
  expect(forbidden.status()).toBe(403);
  await login('fixture10@frontend-test.invalid');
  await page.getByRole('link', { name: 'Leads', exact: true }).click();
  await page.getByRole('combobox', { name: 'Assignment', exact: true }).selectOption('UNASSIGNED');
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'Awaiting assignment', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'View Branch Routing Contact', exact: true }).click();
  await page.getByRole('button', { name: 'Assign lead', exact: true }).click();
  dialog = page.getByRole('dialog');
  const executive = dialog.getByRole('combobox', { name: 'Sales executive', exact: true });
  await expect(
    executive.getByRole('option', { name: 'Sales Fixture 11 TEST-11', exact: true }),
  ).toHaveCount(1);
  await expect(
    executive.getByRole('option', { name: 'Sales Fixture 4 TEST-4', exact: true }),
  ).toHaveCount(0);
  await executive.selectOption({ label: 'Sales Fixture 11 TEST-11' });
  await dialog.getByLabel('Reason').fill('Branch head delegates local site follow-up');
  await dialog.getByRole('button', { name: 'Assign lead', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  const salesToken = await login('fixture11@frontend-test.invalid');
  await page.getByRole('link', { name: 'Leads', exact: true }).click();
  await page.getByRole('button', { name: 'View Branch Routing Contact', exact: true }).click();
  await expect(
    page
      .getByRole('dialog')
      .locator('.record-details > div')
      .filter({ has: page.locator('dt', { hasText: /^Assigned by$/ }) })
      .locator('dd'),
  ).toHaveText('Sales Fixture 10 (TEST-10)');
  await page.getByRole('button', { name: 'Change status', exact: true }).click();
  dialog = page.getByRole('dialog');
  const statuses = dialog.getByRole('combobox', { name: 'Status', exact: true });
  await expect(statuses.getByRole('option', { name: 'CONVERTED', exact: true })).toBeEnabled();
  await expect(statuses.getByRole('option', { name: 'NEW', exact: true })).toBeDisabled();
  await expect(statuses.getByRole('option', { name: 'CONTACTED', exact: true })).toHaveCount(1);
  await statuses.selectOption('QUALIFIED');
  await dialog.getByLabel('Reason').fill('Assigned sales executive qualifies the lead directly');
  await dialog.getByRole('button', { name: 'Change status', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  let revision = 2;
  for (const status of [
    'INTERESTED',
    'QUALIFIED',
    'SITE_VISIT_SCHEDULED',
    'SITE_VISITED',
    'QUOTATION_SENT',
    'CONVERTED',
  ]) {
    const result = await page.request.patch(`/api/v1/leads/${lead._id}/status`, {
      headers: { Authorization: `Bearer ${salesToken}` },
      data: { revision, status, reason: 'Assigned executive verifies sales progress' },
    });
    expect(result.status()).toBe(200);
    revision = (await result.json()).data.revision as number;
  }
  await page.getByRole('link', { name: 'Customers', exact: true }).click();
  await expect(
    page.getByRole('cell', { name: 'Branch Routing Contact', exact: true }),
  ).toBeVisible();
});
