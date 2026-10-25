import { test, expect } from '@playwright/test';

test('converts an interested contact into a lead and creates a linked customer when business is confirmed', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.goto('/login');
  await page.getByLabel('Work email').fill('manager@frontend-test.invalid');
  await page.getByLabel('Password', { exact: true }).fill('Frontend integration passphrase 2026!');
  const login = page.waitForResponse((response) => response.url().endsWith('/auth/login'));
  await page.getByRole('button', { name: 'Sign in to workspace' }).click();
  const token = (await (await login).json()).data.accessToken as string;
  const headers = { Authorization: `Bearer ${token}` };
  await page.getByRole('link', { name: 'Contacts', exact: true }).click();
  await page.getByRole('button', { name: 'View Integration Contact', exact: true }).click();
  await page.getByRole('button', { name: 'Update status', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByRole('combobox', { name: 'Status', exact: true }).selectOption('INTERESTED');
  await dialog.getByLabel('Reason').fill('Contact requested a solar proposal');
  await dialog.getByRole('button', { name: 'Update status', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole('button', { name: 'View Integration Contact', exact: true }).click();
  await page.getByRole('button', { name: 'Convert to lead', exact: true }).click();
  dialog = page.getByRole('dialog');
  const receivingBranch = dialog.getByRole('combobox', { name: 'Receiving branch', exact: true });
  const receivingOption = receivingBranch
    .getByRole('option')
    .filter({ hasText: 'Integration Branch (TEST)' });
  await expect(receivingOption).toHaveCount(1);
  await receivingBranch.selectOption((await receivingOption.getAttribute('value'))!);
  await dialog.getByRole('textbox', { name: 'Required capacity (kW)', exact: true }).fill('5.00');
  await dialog.getByRole('textbox', { name: /^Rate per kW/ }).fill('45000.00');
  for (const [name, value] of [
    ['Payment Mode', 'Integration bank transfer'],
    ['Panel Brand', 'Integration panel brand'],
    ['Panel Technology', 'Integration panel technology'],
    ['Lead Source', 'Integration website enquiry'],
  ]) {
    await dialog.getByRole('combobox', { name, exact: true }).selectOption({ label: value });
  }
  const converted = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      /\/customers\/[a-f0-9]{24}\/convert$/.test(response.url()),
  );
  await dialog.getByRole('button', { name: 'Convert to lead', exact: true }).click();
  const conversion = await converted;
  expect(conversion.status()).toBe(200);
  let lead = (await conversion.json()).data as { _id: string; revision: number };
  const candidates = await page.request.get(`/api/v1/leads/${lead._id}/assignees`, { headers });
  const executive = (
    (await candidates.json()).data as { _id: string; employeeCode: string }[]
  ).find((person) => person.employeeCode === 'TEST-4')!;
  const assigned = await page.request.post(`/api/v1/leads/${lead._id}/assignments`, {
    headers,
    data: {
      revision: lead.revision,
      assignedTo: executive._id,
      reason: 'Manager delegates the lead to a local sales executive',
    },
  });
  expect(assigned.status()).toBe(200);
  lead = (await assigned.json()).data as typeof lead;
  const before = await page.request.get('/api/v1/sales-customers?search=Integration', { headers });
  expect((await before.json()).data).toEqual([]);
  for (const status of [
    'CONTACTED',
    'INTERESTED',
    'QUALIFIED',
    'SITE_VISIT_SCHEDULED',
    'SITE_VISITED',
    'QUOTATION_SENT',
  ]) {
    const response = await page.request.patch(`/api/v1/leads/${lead._id}/status`, {
      headers,
      data: { revision: lead.revision, status, reason: 'Verified sales progress' },
    });
    expect(response.status()).toBe(200);
    lead = (await response.json()).data as typeof lead;
  }
  await page.getByRole('link', { name: 'Leads', exact: true }).click();
  await page.getByRole('button', { name: 'View Integration Contact', exact: true }).click();
  await page.getByRole('button', { name: 'Change status', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByRole('combobox', { name: 'Status', exact: true }).selectOption('CONVERTED');
  await dialog.getByLabel('Reason').fill('Customer confirmed the project');
  const confirmed = page.waitForResponse(
    (response) =>
      response.request().method() === 'PATCH' &&
      response.url().endsWith(`/leads/${lead._id}/status`),
  );
  await dialog.getByRole('button', { name: 'Change status', exact: true }).click();
  expect((await confirmed).status()).toBe(200);
  await expect(dialog).not.toBeVisible();
  await page.getByRole('link', { name: 'Customers', exact: true }).click();
  await expect(page).toHaveURL(/\/customers$/);
  await expect(page.getByRole('heading', { name: 'Customers', exact: true })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Integration Contact', exact: true })).toBeVisible();
  await expect(
    page
      .getByRole('row')
      .filter({ has: page.getByRole('button', { name: 'View Integration Contact', exact: true }) })
      .getByRole('cell', { name: 'CONFIRMED', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'View Integration Contact', exact: true }).click();
  dialog = page.getByRole('dialog');
  await expect(dialog.getByText('225000.00', { exact: true })).toBeVisible();
  await dialog.getByRole('link', { name: 'View source lead', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/leads\\?record=${lead._id}$`));
  await expect(
    page.getByRole('dialog').getByRole('link', { name: 'View customer', exact: true }),
  ).toBeVisible();
  await page.getByRole('dialog').getByRole('link', { name: 'View customer', exact: true }).click();
  await expect(page).toHaveURL(/\/customers\?record=[a-f0-9]{24}$/);
  await expect(
    page.getByRole('dialog').getByRole('link', { name: 'View source lead', exact: true }),
  ).toBeVisible();
});
