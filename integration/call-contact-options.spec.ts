import { expect, test } from '@playwright/test';

test('call report contact dropdown loads the assigned-contact endpoint and supports scoped search', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByLabel('Work email').fill('fixture3@frontend-test.invalid');
  await page.getByLabel('Password', { exact: true }).fill('Frontend integration passphrase 2026!');
  const login = page.waitForResponse((response) => response.url().endsWith('/auth/login'));
  await page.getByRole('button', { name: 'Sign in to workspace' }).click();
  const token = (await (await login).json()).data.accessToken as string;
  await page.getByRole('link', { name: 'Call reports', exact: true }).click();
  const options = page.waitForResponse((response) =>
    response.url().includes('/telecaller-reports/contact-options?'),
  );
  await page.getByRole('button', { name: 'Add call report', exact: true }).click();
  expect((await options).status()).toBe(200);
  const dialog = page.getByRole('dialog');
  const contact = dialog.getByRole('combobox', { name: 'Contact', exact: true });
  await expect(dialog.getByRole('combobox', { name: 'Call Outcome', exact: true })).toBeVisible();
  await expect(dialog.getByRole('combobox', { name: /Contact interest/i })).toHaveCount(0);
  await expect(
    contact.getByRole('option', { name: 'Integration Contact', exact: true }),
  ).toHaveCount(1);
  await expect(
    contact.getByRole('option', { name: 'Branch Routing Contact', exact: true }),
  ).toHaveCount(1);
  await dialog.getByRole('textbox', { name: 'Search Contact', exact: true }).fill('Branch');
  await dialog.getByRole('button', { name: 'Find', exact: true }).click();
  await expect(
    contact.getByRole('option', { name: 'Integration Contact', exact: true }),
  ).toHaveCount(0);
  await expect(
    contact.getByRole('option', { name: 'Branch Routing Contact', exact: true }),
  ).toHaveCount(1);
  await contact.selectOption({ label: 'Branch Routing Contact' });
  const localTime = (minutesAgo: number) => {
    const date = new Date(Date.now() - minutesAgo * 60000);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  };
  await dialog.locator('input[name="callStartedAt"]').fill(localTime(60));
  await dialog.locator('input[name="callEndedAt"]').fill(localTime(55));
  await dialog
    .getByRole('combobox', { name: 'Call Outcome', exact: true })
    .selectOption('INTERESTED');
  const saved = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response.url().endsWith('/telecaller-reports/calls'),
  );
  await dialog.getByRole('button', { name: 'Create call report', exact: true }).click();
  const response = await saved;
  expect(response.status()).toBe(201);
  expect(response.request().postDataJSON()).not.toHaveProperty('customerInterest');
  expect((await response.json()).data.customerInterest).toBe('INTERESTED');
  await expect(dialog).not.toBeVisible();
  await page.getByRole('link', { name: 'Contacts', exact: true }).click();
  await expect(
    page
      .getByRole('row')
      .filter({ hasText: 'Branch Routing Contact' })
      .getByRole('cell', { name: 'INTERESTED', exact: true }),
  ).toBeVisible();
  const previous = response.request().postDataJSON() as Record<string, unknown>;
  const repeated = await page.request.post('/api/v1/telecaller-reports/calls', {
    headers: { Authorization: `Bearer ${token}`, 'Idempotency-Key': crypto.randomUUID() },
    data: {
      ...previous,
      callStartedAt: new Date(Date.now() - 7200000).toISOString(),
      callEndedAt: new Date(Date.now() - 7140000).toISOString(),
      callOutcome: 'CONNECTED',
      remarks: 'Second separate conversation',
    },
  });
  expect(repeated.status()).toBe(201);
  await page.getByRole('link', { name: 'Call reports', exact: true }).click();
  await page
    .getByRole('button', { name: 'Call history for Branch Routing Contact', exact: true })
    .first()
    .click();
  const history = page.getByRole('dialog', {
    name: 'Call history: Branch Routing Contact',
    exact: true,
  });
  const table = history.getByRole('table', { name: 'Contact call history' });
  await expect(table.getByRole('row')).toHaveCount(3);
  await expect(
    table.getByRole('cell', { name: 'Second separate conversation', exact: true }),
  ).toBeVisible();
  await expect(table.getByRole('cell', { name: 'INTERESTED', exact: true })).toBeVisible();
  await expect(history.getByText('2 recorded calls', { exact: true })).toBeVisible();
});
