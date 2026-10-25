import { test, expect } from '@playwright/test';

test('creates a lead through the UI using configured references and an initialized workflow', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByLabel('Work email').fill('manager@frontend-test.invalid');
  await page.getByLabel('Password', { exact: true }).fill('Frontend integration passphrase 2026!');
  await page.getByRole('button', { name: 'Sign in to workspace' }).click();
  await page.getByRole('link', { name: 'Leads', exact: true }).click();
  await page.getByRole('button', { name: 'Add lead', exact: true }).click();
  const form = page.getByRole('dialog');
  await form
    .getByRole('textbox', { name: 'Contact Name', exact: true })
    .fill('Lead creation regression contact');
  await form.getByRole('textbox', { name: 'Mobile Number', exact: true }).fill('9999999985');
  const state = form.getByRole('combobox', { name: 'State Id', exact: true });
  const stateOption = state.getByRole('option', { name: 'Integration State', exact: true });
  await expect(stateOption).toHaveCount(1);
  await state.selectOption((await stateOption.getAttribute('value'))!);
  const district = form.getByRole('combobox', { name: 'District Id', exact: true });
  const districtOption = district.getByRole('option', {
    name: 'Integration District',
    exact: true,
  });
  await expect(districtOption).toHaveCount(1);
  await district.selectOption((await districtOption.getAttribute('value'))!);
  await form
    .getByRole('textbox', { name: 'Site Address', exact: true })
    .fill('Regression contact rooftop site');
  await form.getByRole('textbox', { name: 'Required capacity (kW)', exact: true }).fill('5.50');
  await form.getByRole('textbox', { name: /^Rate per kW/ }).fill('45000.00');
  await form
    .getByRole('combobox', { name: 'Payment Mode', exact: true })
    .selectOption({ label: 'Integration bank transfer' });
  await form
    .getByRole('combobox', { name: 'Panel Brand', exact: true })
    .selectOption({ label: 'Integration panel brand' });
  await form
    .getByRole('combobox', { name: 'Panel Technology', exact: true })
    .selectOption({ label: 'Integration panel technology' });
  await form
    .getByRole('combobox', { name: 'Lead Source', exact: true })
    .selectOption({ label: 'Integration website enquiry' });
  const branch = form.getByRole('combobox', { name: 'Receiving branch', exact: true });
  const option = branch.getByRole('option').filter({ hasText: 'Integration Branch (TEST)' });
  await expect(option).toHaveCount(1);
  await branch.selectOption((await option.getAttribute('value'))!);
  const submitted = page.waitForResponse(
    (response) => response.request().method() === 'POST' && response.url().endsWith('/leads'),
  );
  await form.getByRole('button', { name: 'Create lead', exact: true }).click();
  const response = await submitted;
  expect(response.status()).toBe(201);
  const lead = (await response.json()).data;
  expect(lead).toMatchObject({
    customerName: 'Lead creation regression contact',
    mobileNumber: '+919999999985',
    status: 'NEW',
    workflowVersion: 1,
    assignedTo: null,
    nextFollowUpAt: null,
    estimatedProjectValue: '247500.00',
  });
  await expect(form).not.toBeVisible();
  await expect(
    page.getByRole('cell', { name: 'Lead creation regression contact', exact: true }),
  ).toBeVisible();
});
