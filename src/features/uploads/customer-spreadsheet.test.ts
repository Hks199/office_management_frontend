import { describe, expect, it } from 'vitest';
import { utils, write, type WorkBook, type BookType } from 'xlsx';
import { spreadsheetCsv, spreadsheetSheets } from './customer-spreadsheet';
import { validateCustomerFile } from './customer-import-file';

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
const customer = [
  'Sample Contact',
  '+919876543210',
  '',
  'Test State',
  'Test District',
  '',
  'Roof, first floor',
  'Said "call later"',
];
function book() {
  const result = utils.book_new();
  utils.book_append_sheet(result, utils.aoa_to_sheet([headers, customer]), 'Contacts');
  return result;
}
function bytes(book: WorkBook, bookType: BookType = 'xlsx'): ArrayBuffer {
  return write(book, { type: 'array', bookType }) as ArrayBuffer;
}

describe('contact spreadsheet preparation', () => {
  it.each(['xlsx', 'xls'] as const)(
    'reads %s and preserves phone numbers, commas, quotes and empty columns',
    (extension) => {
      const data = bytes(book(), extension === 'xls' ? 'biff8' : 'xlsx');
      expect(spreadsheetSheets(data, extension)).toEqual(['Contacts']);
      const csv = spreadsheetCsv(data, extension, 'Contacts');
      expect(csv).toContain('"+919876543210","","Test State"');
      expect(csv).toContain('"Roof, first floor","Said ""call later"""');
    },
  );
  it('converts only the selected worksheet', () => {
    const workbook = book();
    utils.book_append_sheet(
      workbook,
      utils.aoa_to_sheet([headers, ['Other Contact', ...customer.slice(1)]]),
      'Other',
    );
    const data = bytes(workbook);
    expect(spreadsheetSheets(data, 'xlsx')).toEqual(['Contacts', 'Other']);
    expect(spreadsheetCsv(data, 'xlsx', 'Other')).toContain('Other Contact');
    expect(spreadsheetCsv(data, 'xlsx', 'Other')).not.toContain('Sample Contact');
  });
  it('rejects formulas rather than importing cached results', () => {
    const workbook = book();
    workbook.Sheets.Contacts.A2 = {
      t: 's',
      v: 'cached name',
      f: 'HYPERLINK("https://example.invalid", "name")',
    };
    expect(() => spreadsheetCsv(bytes(workbook), 'xlsx', 'Contacts')).toThrow('Formula cells');
  });
  it('rejects renamed text, invalid workbooks and mismatched extensions', () => {
    expect(() =>
      spreadsheetSheets(new TextEncoder().encode('not a workbook').buffer, 'xlsx'),
    ).toThrow('does not match');
    expect(() => spreadsheetSheets(bytes(book()), 'xls')).toThrow('does not match');
    expect(() => spreadsheetSheets(new Uint8Array([0x50, 0x4b, 3, 4]).buffer, 'xlsx')).toThrow(
      'cannot be read',
    );
  });
  it('rejects empty sheets, merged cells and large ranges without truncating data', () => {
    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, utils.aoa_to_sheet([]), 'Contacts');
    expect(() => spreadsheetCsv(bytes(workbook), 'xlsx', 'Contacts')).toThrow('empty');
    const merged = book();
    merged.Sheets.Contacts['!merges'] = [utils.decode_range('A1:B1')];
    expect(() => spreadsheetCsv(bytes(merged), 'xlsx', 'Contacts')).toThrow('Unmerge');
    const wide = book();
    wide.Sheets.Contacts.Q2 = { t: 's', v: 'extra' };
    wide.Sheets.Contacts['!ref'] = 'A1:Q2';
    expect(() => spreadsheetCsv(bytes(wide), 'xlsx', 'Contacts')).toThrow('16 columns');
    const tall = book();
    tall.Sheets.Contacts.A50002 = { t: 's', v: 'last row' };
    tall.Sheets.Contacts['!ref'] = 'A1:H50002';
    expect(() => spreadsheetCsv(bytes(tall), 'xlsx', 'Contacts')).toThrow('50,000');
  });
  it('rejects overlong cells and files outside the allowed formats and size', () => {
    const workbook = book();
    workbook.Sheets.Contacts.H2 = { t: 's', v: 'x'.repeat(2001) };
    expect(() => spreadsheetCsv(bytes(workbook), 'xlsx', 'Contacts')).toThrow('2,000');
    expect(() => validateCustomerFile(new File(['data'], 'contacts.xlsm'))).toThrow(
      'Supported files',
    );
    expect(() => validateCustomerFile(new File([], 'contacts.csv'))).toThrow('non-empty');
    expect(() =>
      validateCustomerFile(new File(['data'], 'Contact list October.xlsx')),
    ).not.toThrow();
  });
});
