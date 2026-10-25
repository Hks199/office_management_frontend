import { test, expect } from '@playwright/test';
import { utils, write } from 'xlsx';

const headers = [
  'Contact Name',
  'Mobile Number',
  'Alternate Number',
  'State',
  'District',
  'Block/Tehsil',
  'Site Address',
  'Remarks',
];

for (const [index, extension] of ['csv', 'xlsx', 'xls'].entries()) {
  test(`imports ${extension} contacts through preview, duplicate checks and assignment`, async ({
    page,
  }) => {
    await page.goto('/login');
    await page.getByLabel('Work email').fill('manager@frontend-test.invalid');
    await page
      .getByLabel('Password', { exact: true })
      .fill('Frontend integration passphrase 2026!');
    const loggedIn = page.waitForResponse((response) => response.url().endsWith('/auth/login'));
    await page.getByRole('button', { name: 'Sign in to workspace' }).click();
    const token = ((await (await loggedIn).json()) as { data: { accessToken: string } }).data
      .accessToken;
    const authorization = { Authorization: `Bearer ${token}` };
    await page.getByRole('link', { name: 'Contact imports', exact: true }).click();
    await page.getByRole('button', { name: 'Upload CSV / Excel', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('link', { name: 'Download Excel template' })).toBeVisible();
    const branch = dialog.getByRole('combobox', { name: 'Branch Id', exact: true });
    await expect(
      branch.getByRole('option', { name: 'Integration Branch', exact: true }),
    ).toHaveCount(1);
    await branch.selectOption({ label: 'Integration Branch' });
    const name = `Imported ${extension} contact`;
    const row = [
      name,
      `987654320${index}`,
      '',
      'Integration State',
      'Integration District',
      '',
      'Contact rooftop, first floor',
      'Call tomorrow',
    ];
    const rows = [
      headers,
      row,
      row.map((value, column) => (column === 1 ? `+91${value}` : value)),
      [
        name,
        'invalid phone',
        '',
        'Integration State',
        'Integration District',
        '',
        'Invalid contact address',
        '',
      ],
    ];
    const csv =
      rows
        .map((values) => values.map((value) => `"${value.replaceAll('"', '""')}"`).join(','))
        .join('\r\n') + '\r\n';
    let file: Buffer = Buffer.from(csv);
    if (extension !== 'csv') {
      const book = utils.book_new();
      utils.book_append_sheet(
        book,
        utils.aoa_to_sheet([['Do not import this worksheet']]),
        'Instructions',
      );
      utils.book_append_sheet(book, utils.aoa_to_sheet(rows), 'Contacts');
      file = write(book, {
        type: 'buffer',
        bookType: extension === 'xls' ? 'biff8' : 'xlsx',
      }) as Buffer;
    }
    let uploaded = false;
    await page.route('https://frontend-fixture.s3.ap-south-1.amazonaws.com/', async (route) => {
      const request = route.request();
      const body = request.postDataBuffer()!;
      const multipart = new Request('https://fixture.invalid', {
        method: 'POST',
        headers: { 'Content-Type': request.headers()['content-type'] },
        body: new Uint8Array(body),
      });
      const form = await multipart.formData();
      const uploadedFile = form.get('file') as File;
      expect(uploadedFile.name).toBe('contacts.csv');
      expect(await uploadedFile.text()).toBe(csv);
      const stored = await page.request.post('http://127.0.0.1:3101/__test/import-storage', {
        headers: {
          'Content-Type': 'application/octet-stream',
          'X-Fixture-Object-Key': String(form.get('key')),
        },
        data: Buffer.from(await uploadedFile.arrayBuffer()),
      });
      expect(stored.status()).toBe(204);
      uploaded = true;
      await route.fulfill({ status: 204 });
    });
    await dialog.getByLabel('Contact CSV or Excel file').setInputFiles({
      name: `Contact list.${extension}`,
      mimeType: 'application/octet-stream',
      buffer: file,
    });
    if (extension !== 'csv') {
      await expect(dialog.getByRole('combobox', { name: 'Excel worksheet' })).toBeVisible();
      await dialog.getByRole('combobox', { name: 'Excel worksheet' }).selectOption('Contacts');
    }
    const queued = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' && response.url().endsWith('/csv-imports'),
    );
    await dialog.getByRole('button', { name: 'Upload & validate', exact: true }).click();
    const response = await queued;
    expect(response.status()).toBe(202);
    expect(uploaded).toBe(true);
    const job = ((await response.json()) as { data: { _id: string } }).data;
    await expect(
      page.getByRole('heading', { name: 'Import contacts', exact: true }),
    ).not.toBeVisible();
    const getJob = async () =>
      (
        (await (
          await page.request.get(`/api/v1/csv-imports/${job._id}`, { headers: authorization })
        ).json()) as {
          data: {
            status: string;
            acceptedRows: number;
            duplicateRows: number;
            rejectedRows: number;
            importedRows: number;
          };
        }
      ).data;
    await expect.poll(async () => (await getJob()).status).toBe('PREVIEW_READY');
    expect(await getJob()).toMatchObject({
      acceptedRows: 1,
      duplicateRows: 1,
      rejectedRows: 1,
      importedRows: 0,
    });
    // The uploaded job opens automatically, and the assignment form appears after validation.
    await expect(dialog.getByRole('combobox', { name: 'Telecaller', exact: true })).toBeVisible({
      timeout: 10000,
    });
    const detailField = (title: string) =>
      dialog
        .locator('.record-details > div')
        .filter({ has: page.getByText(title, { exact: true }) })
        .locator('dd');
    await expect(detailField('Created by')).toHaveText('Integration Manager (TEST-MD)');
    await expect(detailField('Branch')).toHaveText('Integration Branch');
    await expect(detailField('File')).toHaveText('contacts.csv');
    await expect(detailField('Assigned to')).toHaveText('Not assigned');
    await expect(dialog.locator('dt').filter({ hasText: /^Request Id$/ })).toHaveCount(0);
    await dialog.getByRole('button', { name: 'Row preview', exact: true }).click();
    await expect(
      dialog.getByText(
        'Mobile Number is missing or invalid. Correct this field and upload again.',
        { exact: true },
      ),
    ).toBeVisible();
    const assignee = dialog.getByRole('combobox', { name: 'Telecaller', exact: true });
    await expect(assignee.getByRole('option', { name: 'Caller Fixture 3 TEST-3' })).toHaveCount(1);
    await expect(
      assignee.getByRole('option', { name: /Sales Fixture|Integration Manager/ }),
    ).toHaveCount(0);
    await assignee.selectOption({ label: 'Caller Fixture 3 TEST-3' });
    const assignedTo = await assignee.inputValue();
    const confirmed = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        response.url().endsWith(`/csv-imports/${job._id}/confirm`),
    );
    await dialog.getByRole('button', { name: 'Assign Telecaller & import', exact: true }).click();
    expect((await confirmed).status()).toBe(202);
    await expect.poll(async () => (await getJob()).status).toBe('COMPLETED');
    expect((await getJob()).importedRows).toBe(1);
    await dialog.getByRole('button', { name: 'Details', exact: true }).click();
    await expect(detailField('Assigned to')).toHaveText('Caller Fixture 3 (TEST-3)');
    const customers = (
      (await (
        await page.request.get(`/api/v1/customers?search=${encodeURIComponent(name)}`, {
          headers: authorization,
        })
      ).json()) as { data: { customerName: string; assignedTo: string; mobileNumber: string }[] }
    ).data;
    expect(customers).toHaveLength(1);
    expect(customers[0]).toMatchObject({
      customerName: name,
      assignedTo,
      mobileNumber: `+91987654320${index}`,
    });
  });
}
