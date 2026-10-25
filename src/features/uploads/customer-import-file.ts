import type { ImportWorkerInput, ImportWorkerResult } from './customer-import.worker';

export const MAX_IMPORT_BYTES = 20 * 1024 * 1024;
export function validateCustomerFile(file?: File): asserts file is File {
  if (!file || file.size < 1 || file.size > MAX_IMPORT_BYTES)
    throw new Error('Select a non-empty CSV or Excel file up to 20 MB.');
  if (!/\.(csv|xlsx|xls)$/i.test(file.name))
    throw new Error('Supported files are CSV (.csv) and Excel (.xlsx or .xls).');
}

// Parse untrusted workbooks away from the UI and stop slow/corrupt files.
async function parseWorkbook(file: File, sheetName?: string): Promise<ImportWorkerResult> {
  validateCustomerFile(file);
  const data = await file.arrayBuffer();
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./customer-import.worker.ts', import.meta.url), {
      type: 'module',
    });
    const timeout = setTimeout(() => {
      worker.terminate();
      reject(
        new Error(
          'Reading Excel took too long. Split the workbook into smaller files and try again.',
        ),
      );
    }, 20_000);
    const finish = () => {
      clearTimeout(timeout);
      worker.terminate();
    };
    worker.onmessage = (event: MessageEvent<ImportWorkerResult>) => {
      finish();
      if ('error' in event.data) reject(new Error(event.data.error));
      else resolve(event.data);
    };
    worker.onerror = () => {
      finish();
      reject(new Error('Unable to read Excel. Save a fresh workbook and try again.'));
    };
    const input: ImportWorkerInput = {
      data,
      extension: file.name.split('.').at(-1)!.toLowerCase(),
      ...(sheetName ? { sheetName } : {}),
    };
    worker.postMessage(input, [data]);
  });
}

export async function customerWorkbookSheets(file: File): Promise<string[]> {
  const result = await parseWorkbook(file);
  if (!('sheets' in result)) throw new Error('Unable to list worksheets.');
  return result.sheets;
}

export async function prepareCustomerFile(file: File, sheetName: string): Promise<File> {
  validateCustomerFile(file);
  // Keep the private backend CSV pipeline, checksum verification and row validation authoritative.
  if (/\.csv$/i.test(file.name)) return new File([file], 'contacts.csv', { type: 'text/csv' });
  if (!sheetName) throw new Error('Choose an Excel worksheet.');
  const result = await parseWorkbook(file, sheetName);
  if (!('csv' in result)) throw new Error('Unable to prepare this worksheet.');
  return new File([result.csv], 'contacts.csv', { type: 'text/csv' });
}
