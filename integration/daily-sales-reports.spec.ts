import { test, expect } from '@playwright/test';

test('daily sales reports fit mobile screens and remain discoverable in navigation', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/login');
  await page.getByLabel('Work email').fill('fixture9@frontend-test.invalid');
  await page.getByLabel('Password', { exact: true }).fill('Frontend integration passphrase 2026!');
  await page.getByRole('button', { name: 'Sign in to workspace' }).click();
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'Daily sales reports', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Daily sales reports', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'New visit report', exact: true })).toBeVisible();
  await expect(page.getByLabel('Report date', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('a telecaller cannot open the sales-executive reporting page', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Work email').fill('fixture3@frontend-test.invalid');
  await page.getByLabel('Password', { exact: true }).fill('Frontend integration passphrase 2026!');
  await page.getByRole('button', { name: 'Sign in to workspace' }).click();
  await expect(page.getByRole('heading', { name: 'Your team. A bigger picture.' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Daily sales reports', exact: true })).toHaveCount(0);
  await page.goto('/daily-reports');
  await expect(page.getByRole('heading', { name: 'Access restricted', exact: true })).toBeVisible();
});

test('a sales executive starts, resumes and submits a contact visit report with GPS and a private photo', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 22.57, longitude: 88.36, accuracy: 10 });
  let privateUploads = 0;
  await page.route('https://frontend-fixture.s3.ap-south-1.amazonaws.com/**', async (route) => {
    expect(route.request().headers().authorization).toBeUndefined();
    privateUploads++;
    await route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*' } });
  });
  await page.goto('/login');
  await page.getByLabel('Work email').fill('fixture9@frontend-test.invalid');
  await page.getByLabel('Password', { exact: true }).fill('Frontend integration passphrase 2026!');
  await page.getByRole('button', { name: 'Sign in to workspace' }).click();
  await page.getByRole('link', { name: 'Daily sales reports', exact: true }).first().click();
  await expect(
    page.getByRole('heading', { name: 'Daily sales reports', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'New visit report', exact: true }).click();
  const start = page.getByRole('dialog', { name: 'Start site visit', exact: true });
  const lead = start.getByRole('combobox', { name: 'Contact / assigned lead', exact: true });
  const customer = lead.getByRole('option', { name: 'Daily Reporting Contact', exact: true });
  await expect(customer).toHaveCount(1);
  await lead.selectOption((await customer.getAttribute('value'))!);
  const starting = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' && response.url().endsWith('/sales-reports/visits'),
  );
  await start.getByRole('button', { name: 'Start visit', exact: true }).click();
  const response = await starting;
  expect(response.status()).toBe(201);
  const started = await response.json();
  expect(started.data.startLocation).toMatchObject({ latitude: 22.57, longitude: 88.36 });
  const complete = page.getByRole('dialog', { name: 'Complete site visit', exact: true });
  await expect(complete).toBeVisible();
  await complete.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Daily sales reports', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Complete report', exact: true }).click();
  await complete
    .getByLabel('Discussion notes')
    .fill('Inspected the roof and discussed a six kilowatt installation.');
  await complete.getByLabel('Contact interest').selectOption('INTERESTED');
  await complete.getByLabel('Installation readiness').selectOption('READY');
  await complete.getByLabel('Visit outcome').selectOption('COMPLETED');
  await complete.getByLabel('Required capacity (kW)').fill('6.00');
  await complete.getByLabel('Visit photos', { exact: true }).setInputFiles({
    name: 'contact-site.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jhWQAAAAASUVORK5CYII=',
      'base64',
    ),
  });
  const submitting = page.waitForResponse(
    (result) => result.request().method() === 'PATCH' && result.url().endsWith('/complete'),
  );
  await complete.getByRole('button', { name: 'Submit visit', exact: true }).click();
  const submitted = await submitting;
  expect(submitted.status()).toBe(200);
  const report = (await submitted.json()).data;
  expect(report.status).toBe('SUBMITTED');
  expect(report.reviewStatus).toBe('PENDING');
  expect(report.photoFileIds).toHaveLength(1);
  expect(report.location).toMatchObject({ latitude: 22.57, longitude: 88.36 });
  expect(privateUploads).toBe(1);
  await expect(page.getByRole('status')).toContainText('Contact visit report submitted');
  await expect(page.getByRole('button', { name: 'Complete report', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'View report', exact: true }).click();
  const details = page.getByRole('dialog', { name: 'Contact visit report', exact: true });
  await expect(
    details.getByText('Inspected the roof and discussed a six kilowatt installation.', {
      exact: true,
    }),
  ).toBeVisible();
  await expect(details.getByRole('button', { name: 'Visit photo 1', exact: true })).toBeVisible();
});
