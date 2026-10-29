import { attendancePolicyPayload, calendarPayload } from '../administration/contracts';
export function officeSettingsPayload(
  revision: number,
  start: string,
  end: string,
  graceMinutes: number,
  workingWeekdays: number[],
  holidays: string[],
) {
  const { attendancePolicy } = attendancePolicyPayload(revision, {
    start,
    end,
    graceMinutes,
    maxAccuracyMeters: 100,
    maxCaptureAgeSeconds: 300,
    geofence: null,
  });
  if (attendancePolicy.startMinute === null || attendancePolicy.endMinute === null)
    throw new Error('Set both office start and end times.');
  return {
    ...calendarPayload(revision, workingWeekdays, holidays),
    startMinute: attendancePolicy.startMinute,
    endMinute: attendancePolicy.endMinute,
    graceMinutes: attendancePolicy.graceMinutes,
  };
}
