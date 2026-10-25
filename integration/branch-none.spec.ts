import { test, expect } from '@playwright/test';

for (const scenario of [
  {
    email: 'manager@frontend-test.invalid',
    role: 'Business Development Officer',
    code: 'NONE-BDO',
    manager: 'TEST-MD',
    phone: '+919999999981',
  },
  {
    email: 'fixture7@frontend-test.invalid',
    role: 'Marketing Head',
    code: 'NONE-MH',
    manager: 'TEST-7',
    phone: '+919999999982',
  },
  {
    email: 'fixture7@frontend-test.invalid',
    role: 'Marketing Head',
    code: 'NONE-MH-MD',
    manager: 'TEST-MD',
    phone: '+919999999983',
  },
  {
    email: 'manager@frontend-test.invalid',
    role: 'Marketing Head',
    code: 'MULTI-MH',
    manager: 'TEST-MD',
    phone: '+919999999985',
    additionalManager: 'TEST-7',
  },
]) {
  test(`creates ${scenario.role} reporting to ${scenario.manager} with branch None (${scenario.code})`, async ({
    page,
  }) => {
    await page.goto('/login');
    await page.getByLabel('Work email').fill(scenario.email);
    await page
      .getByLabel('Password', { exact: true })
      .fill('Frontend integration passphrase 2026!');
    await page.getByRole('button', { name: 'Sign in to workspace' }).click();
    await page.getByRole('link', { name: 'Employees', exact: true }).click();
    await page.getByRole('button', { name: 'Add employee', exact: true }).click();
    const modal = page.getByRole('dialog');
    const role = modal.getByRole('combobox', { name: 'Role', exact: true });
    const option = role.getByRole('option', { name: scenario.role, exact: true });
    await expect(option).toHaveCount(1);
    await role.selectOption((await option.getAttribute('value'))!);
    const branch = modal.getByRole('combobox', { name: 'Primary branch', exact: true });
    await expect(branch).toBeEnabled();
    await expect(branch).not.toHaveAttribute('required');
    await branch.selectOption({ label: 'None' });
    await modal.getByLabel('Employee Code').fill(scenario.code);
    await modal.getByLabel('First Name').fill('Company');
    await modal.getByLabel('Last Name').fill('Manager');
    await modal
      .getByRole('textbox', { name: 'Email', exact: true })
      .fill(scenario.code.toLowerCase() + '@frontend-test.invalid');
    await modal.getByLabel('Mobile Number').fill(scenario.phone);
    await modal.getByLabel('Date Of Joining').fill(new Date().toISOString().slice(0, 10));
    const manager = modal.getByRole('group', { name: 'Reporting managers', exact: true });
    if (scenario.role === 'Marketing Head' && scenario.email === 'fixture7@frontend-test.invalid') {
      await expect(manager.getByRole('checkbox', { name: /TEST-MD/ })).toHaveCount(1);
      await expect(manager.getByRole('checkbox', { name: /TEST-7/ })).toHaveCount(1);
    }
    const managerOption = manager.getByRole('checkbox', { name: new RegExp(scenario.manager) });
    await expect(managerOption).toHaveCount(1);
    await managerOption.check();
    const selectedSummary = manager.getByLabel('Selected reporting managers');
    await expect(selectedSummary).toContainText(scenario.manager);
    const expectedCount = 'additionalManager' in scenario ? 2 : 1;
    if ('additionalManager' in scenario) {
      const additional = manager.getByRole('checkbox', {
        name: new RegExp(scenario.additionalManager!),
      });
      await additional.check();
      await expect(manager.getByText('2 of 10 selected')).toBeVisible();
      await expect(selectedSummary).toContainText(scenario.additionalManager!);
      // Searching must preserve and identify every selected manager.
      await modal
        .getByRole('textbox', { name: 'Search Reporting managers', exact: true })
        .fill('TEST-7');
      await modal.getByRole('button', { name: 'Find', exact: true }).last().click();
      await expect(selectedSummary).toContainText(scenario.manager);
      await expect(selectedSummary).toContainText(scenario.additionalManager!);
      await modal.getByRole('button', { name: 'Clear search', exact: true }).click();
      await manager
        .getByRole('button', { name: new RegExp('Remove.*' + scenario.manager) })
        .click();
      await expect(manager.getByText('1 of 10 selected')).toBeVisible();
      await expect(managerOption).not.toBeChecked();
      await manager.getByRole('button', { name: 'Clear all', exact: true }).click();
      await expect(manager.getByText('0 of 10 selected')).toBeVisible();
      await expect(additional).not.toBeChecked();
      await managerOption.check();
      await additional.check();
      await page.setViewportSize({ width: 390, height: 844 });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      await expect(selectedSummary).toContainText(scenario.additionalManager!);
      await manager.screenshot({ path: 'artifacts/reporting-managers-mobile.png' });
    }
    const created = page.waitForResponse(
      (response) => response.request().method() === 'POST' && response.url().endsWith('/employees'),
    );
    await modal.getByRole('button', { name: 'Create employee', exact: true }).click();
    const response = await created;
    expect(response.request().postDataJSON().branchId).toBeNull();
    expect(response.request().postDataJSON().reportingManagerIds).toHaveLength(expectedCount);
    expect(response.status()).toBe(201);
    const result = (await response.json()).data;
    expect(result.branchId).toBeNull();
    expect(result.reportingManagerIds).toHaveLength(expectedCount);
    await expect(modal).not.toBeVisible();
  });
}
