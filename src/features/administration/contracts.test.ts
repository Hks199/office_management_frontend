import { describe, it, expect } from 'vitest';
import { attendancePolicyPayload, calendarPayload, workflowPayload } from './contracts';
describe('administration payload validation', () => {
  const base = {
    start: '09:00',
    end: '18:00',
    graceMinutes: 15,
    maxAccuracyMeters: 100,
    maxCaptureAgeSeconds: 300,
    geofence: null,
  };
  it('converts local working times to backend minute fields with revision', () => {
    expect(attendancePolicyPayload(7, base)).toEqual({
      revision: 7,
      attendancePolicy: {
        startMinute: 540,
        endMinute: 1080,
        graceMinutes: 15,
        maxAccuracyMeters: 100,
        maxCaptureAgeSeconds: 300,
        geofence: null,
      },
    });
  });
  it('requires a complete forward schedule and bounded geofence', () => {
    expect(() => attendancePolicyPayload(0, { ...base, end: '' })).toThrow();
    expect(() => attendancePolicyPayload(0, { ...base, start: '19:00' })).toThrow();
    expect(() =>
      attendancePolicyPayload(0, {
        ...base,
        geofence: { latitude: 91, longitude: 0, radiusMeters: 50 },
      }),
    ).toThrow();
  });
  it('supports disabling both schedule times', () => {
    expect(
      attendancePolicyPayload(0, { ...base, start: '', end: '' }).attendancePolicy.startMinute,
    ).toBeNull();
  });
  it('requires working days and rejects impossible or duplicate holiday dates', () => {
    expect(calendarPayload(0, [1, 2], ['2026-12-25']).revision).toBe(0);
    expect(() => calendarPayload(0, [], [])).toThrow();
    expect(() => calendarPayload(0, [1], ['2026-02-30'])).toThrow();
    expect(() => calendarPayload(0, [1], ['2026-12-25', '2026-12-25'])).toThrow();
  });
  it('rejects duplicate and controlled terminal transitions', () => {
    expect(() =>
      workflowPayload(1, [
        { from: 'NEW', to: 'CONTACTED' },
        { from: 'NEW', to: 'CONTACTED' },
      ]),
    ).toThrow();
    expect(() => workflowPayload(1, [{ from: 'CONVERTED', to: 'CONTACTED' }])).toThrow();
    expect(workflowPayload(2, [{ from: 'NEW', to: 'CONTACTED' }]).expectedVersion).toBe(2);
  });
});
