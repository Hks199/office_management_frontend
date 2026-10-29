import { businessDate, display } from '../../shared/lib/format';
import { recordFieldValue } from '../../shared/lib/record-display';
import type { RecordData } from '../../shared/types/api';

export function attendanceRange(preset = 'today', now = new Date()): RecordData {
  const today = businessDate(now);
  const date = new Date(`${today}T00:00:00Z`);
  if (preset === 'yesterday') date.setUTCDate(date.getUTCDate() - 1);
  if (preset === 'week') date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  if (preset === 'month') date.setUTCDate(1);
  const from = date.toISOString().slice(0, 10);
  return { from, to: preset === 'yesterday' ? from : today };
}

export function attendanceRangeError(filters: RecordData): string {
  const from = String(filters.from ?? '');
  const to = String(filters.to ?? '');
  if (!from || !to) return 'Choose both a from date and a to date.';
  if (from > to) return 'From date must be before or equal to to date.';
  if (Date.parse(to) - Date.parse(from) > 365 * 86400000)
    return 'Choose a date range of at most 366 days.';
  return '';
}

export function workedTime(row: RecordData): string {
  if (!row.effectiveCheckOutAt) return 'In progress';
  const minutes = Math.max(
    0,
    Math.round(
      (Date.parse(String(row.effectiveCheckOutAt)) - Date.parse(String(row.effectiveCheckInAt))) /
        60000,
    ),
  );
  return Number.isFinite(minutes) ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : 'Unavailable';
}

export function attendanceCsv(rows: RecordData[]): string {
  const cell = (value: unknown) => {
    let text = String(value ?? '');
    // Spreadsheet formulas can be embedded in employee/branch names.
    if (/^[\s]*[=+@\-\t\r\n]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  const headers = [
    'Date',
    'Employee',
    'Branch',
    'Check-in (IST)',
    'Checkout (IST)',
    'Working hours',
    'Status',
    'Late arrival',
    'Early exit',
    'Review',
    'Evidence flags',
  ];
  return (
    '\uFEFF' +
    [
      headers,
      ...rows.map((row) => [
        row.attendanceDate,
        recordFieldValue(row, 'employeeId'),
        recordFieldValue(row, 'branchId'),
        display(row.effectiveCheckInAt ?? row.checkInAt),
        display(row.effectiveCheckOutAt ?? row.checkOutAt),
        workedTime(row),
        row.status === 'OPEN' ? 'Awaiting checkout' : 'Checked out',
        row.lateArrival ? 'Yes' : 'No',
        row.earlyExit ? 'Yes' : 'No',
        row.reviewStatus,
        Array.isArray(row.evidenceFlags) ? row.evidenceFlags.join('; ') : '',
      ]),
    ]
      .map((row) => row.map(cell).join(','))
      .join('\r\n')
  );
}
