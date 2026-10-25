import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

test('branded workspace stays usable on desktop and mobile, including navigation and call forms', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await mkdir('artifacts/brand-refresh', { recursive: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/login');
  await expect(page.getByRole('img', { name: 'Sunvika', exact: true })).toBeVisible();
  await page.screenshot({ path: 'artifacts/brand-refresh/login-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole('button', { name: 'Sign in to workspace', exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: 'artifacts/brand-refresh/login-mobile.png', fullPage: true });
  await page.getByLabel('Work email').fill('manager@frontend-test.invalid');
  await page.getByLabel('Password', { exact: true }).fill('Frontend integration passphrase 2026!');
  await page.getByRole('button', { name: 'Sign in to workspace', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Your team/ })).toBeVisible();
  await expect(page.locator('.metrics-grid')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: 'artifacts/brand-refresh/overview-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await page.getByRole('link', { name: 'Call reports', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Call reports', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Add call report', exact: true }).click();
  await expect(
    page.getByRole('dialog').getByRole('combobox', { name: 'Contact', exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole('dialog').getByRole('button', { name: 'Create call report', exact: true }),
  ).toBeInViewport();
  expect(
    await page
      .getByRole('dialog')
      .evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true);
  await page.screenshot({ path: 'artifacts/brand-refresh/call-form-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await page.setViewportSize({ width: 320, height: 740 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(
    page.getByRole('button', { name: 'Call history for Integration Contact', exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: 'artifacts/brand-refresh/calls-desktop.png', fullPage: true });
  await page.getByRole('link', { name: 'Overview', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Your team/ })).toBeVisible();
  await expect(page.locator('.metrics-grid')).toBeVisible();
  await page.screenshot({ path: 'artifacts/brand-refresh/overview-desktop.png', fullPage: true });
});
