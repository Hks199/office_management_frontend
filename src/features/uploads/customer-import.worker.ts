import { spreadsheetCsv, spreadsheetSheets } from './customer-spreadsheet';

export interface ImportWorkerInput {
  data: ArrayBuffer;
  extension: string;
  sheetName?: string;
}
export type ImportWorkerResult = { sheets: string[] } | { csv: string } | { error: string };

self.onmessage = (event: MessageEvent<ImportWorkerInput>) => {
  const { data, extension, sheetName } = event.data;
  try {
    const result: ImportWorkerResult = sheetName
      ? { csv: spreadsheetCsv(data, extension, sheetName) }
      : { sheets: spreadsheetSheets(data, extension) };
    self.postMessage(result);
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : 'Unable to read this workbook.',
    });
  }
};
