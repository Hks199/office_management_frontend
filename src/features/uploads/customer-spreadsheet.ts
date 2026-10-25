import { read, utils, type WorkBook, type CellObject } from 'xlsx';

export const IMPORT_MAX_BYTES = 20 * 1024 * 1024;
const MAX_ROWS = 50_001; // Header plus 50,000 customers, matching the backend.
const MAX_COLUMNS = 16;

function workbook(data: ArrayBuffer, extension: string, sheetName?: string): WorkBook {
  if (!data.byteLength || data.byteLength > IMPORT_MAX_BYTES)
    throw new Error('Excel files must be non-empty and no larger than 20 MB.');
  const bytes = new Uint8Array(data);
  const signature =
    extension === 'xlsx' ? [0x50, 0x4b, 3, 4] : [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
  if (!signature.every((value, index) => bytes[index] === value))
    throw new Error(
      'The file content does not match its Excel extension. Save it as an Excel workbook and try again.',
    );
  try {
    return read(data, {
      type: 'array',
      bookSheets: !sheetName,
      ...(sheetName ? { sheets: [sheetName] } : {}),
      sheetRows: MAX_ROWS + 1,
      cellFormula: true,
      cellHTML: false,
      cellStyles: false,
      bookVBA: true,
      bookDeps: false,
    });
  } catch {
    throw new Error('This workbook cannot be read. Use an unencrypted .xlsx or .xls file.');
  }
}

export function spreadsheetSheets(data: ArrayBuffer, extension: string): string[] {
  const names = workbook(data, extension).SheetNames;
  if (!names.length || names.length > 100)
    throw new Error('Use a workbook with between 1 and 100 worksheets.');
  return names;
}

export function spreadsheetCsv(data: ArrayBuffer, extension: string, sheetName: string): string {
  const book = workbook(data, extension, sheetName);
  if (book.vbaraw)
    throw new Error('Macro-enabled workbooks are not supported. Save a copy without macros.');
  const sheet = book.Sheets[sheetName];
  if (!sheet?.['!ref']) throw new Error('The selected worksheet is empty.');
  const range = utils.decode_range(sheet['!fullref'] ?? sheet['!ref']);
  if (range.e.r >= MAX_ROWS || range.e.c >= MAX_COLUMNS)
    throw new Error(
      'A worksheet can contain at most 50,000 contact rows and 16 columns, starting at A1.',
    );
  if (sheet['!merges']?.length)
    throw new Error('Unmerge cells in the selected worksheet before importing.');
  const lines: string[] = [];
  for (let row = 0; row <= range.e.r; row++) {
    const values: string[] = [];
    for (let column = 0; column <= range.e.c; column++) {
      const cell = sheet[utils.encode_cell({ r: row, c: column })] as CellObject | undefined;
      if (cell?.f || cell?.F)
        throw new Error(
          'Formula cells are not supported. Paste their results as values before importing.',
        );
      if (cell?.t === 'e') throw new Error('Fix Excel error cells before importing.');
      const value = cell?.v == null ? '' : String(cell.v);
      if (value.length > 2000 || value.includes('\0'))
        throw new Error('Cells must contain at most 2,000 characters and no NUL characters.');
      values.push(value);
    }
    if (values.every((value) => !value.trim())) continue;
    // Quote data without evaluating formulas or following hyperlinks. Preserve + in phone numbers.
    const line = values.map((value) => `"${value.replaceAll('"', '""')}"`).join(',');
    if (new TextEncoder().encode(line).byteLength > 16384)
      throw new Error('A worksheet row exceeds the 16 KB import limit.');
    lines.push(line);
  }
  if (lines.length < 2)
    throw new Error('The worksheet requires a header and at least one contact row.');
  const csv = lines.join('\r\n') + '\r\n';
  if (new TextEncoder().encode(csv).byteLength > IMPORT_MAX_BYTES)
    throw new Error(
      'The selected worksheet exceeds 20 MB after conversion. Split it into smaller files.',
    );
  return csv;
}
