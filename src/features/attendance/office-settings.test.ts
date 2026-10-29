import { describe, expect, it } from 'vitest';
import { officeSettingsPayload } from './office-settings';

describe('office timing and holiday forms', () => {
  it('stores validated local office times and holiday dates', () => {
    expect(officeSettingsPayload(2, '09:30', '18:00', 15, [1, 2, 3, 4, 5], ['2026-11-09'])).toEqual(
      {
        revision: 2,
        startMinute: 570,
        endMinute: 1080,
        graceMinutes: 15,
        workingWeekdays: [1, 2, 3, 4, 5],
        holidays: ['2026-11-09'],
      },
    );
  });
  it('rejects missing/reversed times, missing weekdays and invalid holidays', () => {
    expect(() => officeSettingsPayload(0, '', '', 0, [1], [])).toThrow('Set both');
    expect(() => officeSettingsPayload(0, '18:00', '09:30', 0, [1], [])).toThrow();
    expect(() => officeSettingsPayload(0, '09:00', '18:00', 0, [], [])).toThrow();
    expect(() => officeSettingsPayload(0, '09:00', '18:00', 0, [1], ['2026-02-30'])).toThrow();
  });
});
