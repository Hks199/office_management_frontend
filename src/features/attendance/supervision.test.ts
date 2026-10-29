import { describe, expect, it } from 'vitest';
import { attendanceCsv, attendanceRange, attendanceRangeError, workedTime } from './supervision';

describe('attendance supervision', () => {
  it('uses India business dates at the UTC day boundary', () => {
    expect(attendanceRange('today', new Date('2026-10-28T20:00:00Z'))).toEqual({
      from: '2026-10-29',
      to: '2026-10-29',
    });
    expect(attendanceRange('yesterday', new Date('2026-12-31T20:00:00Z'))).toEqual({
      from: '2026-12-31',
      to: '2026-12-31',
    });
  });
  it('starts weeks on Monday and permits cross-month ranges', () => {
    expect(attendanceRange('week', new Date('2026-11-01T10:00:00Z'))).toEqual({
      from: '2026-10-26',
      to: '2026-11-01',
    });
    expect(attendanceRange('month', new Date('2026-11-15T10:00:00Z'))).toEqual({
      from: '2026-11-01',
      to: '2026-11-15',
    });
    expect(attendanceRangeError({ from: '2026-09-20', to: '2026-10-29' })).toBe('');
  });
  it('rejects incomplete, reversed and excessively long ranges', () => {
    for (const value of [
      { from: '2026-10-29' },
      { from: '2026-10-30', to: '2026-10-29' },
      { from: '2025-01-01', to: '2026-10-29' },
    ])
      expect(attendanceRangeError(value)).not.toBe('');
  });
  it('uses corrected times for duration and keeps open records in progress', () => {
    expect(
      workedTime({
        effectiveCheckInAt: '2026-10-29T04:00:00Z',
        effectiveCheckOutAt: '2026-10-29T12:30:00Z',
      }),
    ).toBe('8h 30m');
    expect(workedTime({})).toBe('In progress');
  });
  it('exports readable names and neutralizes spreadsheet formula injection', () => {
    const csv = attendanceCsv([
      {
        employeeId: 'aaaaaaaaaaaaaaaaaaaaaaaa',
        employeeName: '=HYPERLINK("evil")',
        branchName: 'Pune, East',
        branchId: 'bbbbbbbbbbbbbbbbbbbbbbbb',
        attendanceDate: '2026-10-29',
        status: 'OPEN',
        reviewStatus: 'PENDING',
        lateArrival: true,
      },
    ]);
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain('Pune, East');
    expect(csv).toContain('Awaiting checkout');
    expect(csv).not.toContain('aaaaaaaaaaaaaaaaaaaaaaaa');
  });
});
