export function importFailureMessage(code: unknown): string {
  const messages = new Map([
    [
      'STORAGE_ACCESS_DENIED',
      'Private storage access was denied. Ask your administrator to check AWS permissions and complete any required security recovery.',
    ],
    [
      'STORAGE_CREDENTIALS_INVALID',
      'Private storage credentials are invalid or expired. Ask your administrator to update the backend configuration.',
    ],
    [
      'STORAGE_UNAVAILABLE',
      'Private storage is not configured. Ask your administrator to complete storage setup.',
    ],
    [
      'STORAGE_REQUEST_FAILED',
      'Private storage could not be reached or verified. Ask your administrator to check connectivity and retry processing.',
    ],
    [
      'INVALID_CSV_HEADER',
      'Column headers are missing or duplicated. Correct the file or column mapping and upload again.',
    ],
    [
      'EMPTY_CSV',
      'The selected file or worksheet has no contact rows. Add contact details and upload again.',
    ],
    [
      'INVALID_CSV_FORMAT',
      'The file has an invalid CSV structure or encoding. Save a fresh UTF-8 CSV or Excel workbook and upload again.',
    ],
    [
      'CSV_LIMIT',
      'The file exceeds a row, column or cell limit. Split or correct the file and upload again.',
    ],
    [
      'INVALID_LOCATION',
      'A location is missing, inactive or ambiguous. Correct the location details and upload again.',
    ],
    [
      'DEDUPE_POLICY_CHANGED',
      'Duplicate-check settings changed. Upload the file again to create a new preview.',
    ],
  ]);
  return (
    messages.get(String(code)) ??
    'Import processing failed. Ask your administrator to review the import before uploading again.'
  );
}
