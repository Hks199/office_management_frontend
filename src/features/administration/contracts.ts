import { z } from 'zod';
export const leadStatuses = [
  'NEW',
  'ASSIGNED',
  'CONTACTED',
  'INTERESTED',
  'QUALIFIED',
  'SITE_VISIT_SCHEDULED',
  'SITE_VISITED',
  'QUOTATION_SENT',
  'NEGOTIATION',
  'CONVERTED',
  'NOT_INTERESTED',
  'LOST',
  'ON_HOLD',
] as const;
const businessDay = z
  .string()
  .regex(/^20\d{2}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, 'Enter a valid calendar date.');
export function workflowPayload(
  expectedVersion: number,
  transitions: { from: string; to: string }[],
) {
  return z
    .object({
      expectedVersion: z.number().int().min(1),
      transitions: z
        .array(z.object({ from: z.enum(leadStatuses), to: z.enum(leadStatuses) }))
        .min(1)
        .max(100)
        .superRefine((edges, ctx) => {
          const seen = new Set<string>();
          for (const edge of edges) {
            const key = `${edge.from}:${edge.to}`;
            if (seen.has(key))
              ctx.addIssue({ code: 'custom', message: 'Remove duplicate transitions.' });
            seen.add(key);
            if (
              edge.from === edge.to ||
              ['CONVERTED', 'LOST', 'NOT_INTERESTED', 'ON_HOLD'].includes(edge.from) ||
              edge.to === 'NEW'
            )
              ctx.addIssue({
                code: 'custom',
                message:
                  'Terminal reopening and hold/resume are controlled by the backend. Choose a permitted transition.',
              });
          }
        }),
    })
    .parse({ expectedVersion, transitions });
}
export function calendarPayload(revision: number, workingWeekdays: number[], holidays: string[]) {
  return z
    .object({
      revision: z.number().int().min(0),
      workingWeekdays: z
        .array(z.number().int().min(1).max(7))
        .min(1, 'Select at least one working day.')
        .max(7),
      holidays: z
        .array(businessDay)
        .max(366)
        .refine((days) => new Set(days).size === days.length, 'Remove duplicate holidays.'),
    })
    .parse({ revision, workingWeekdays, holidays });
}
function minute(value: string) {
  if (!value) return null;
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59)
    throw new Error('Enter a valid working time.');
  return Number(match[1]) * 60 + Number(match[2]);
}
export function attendancePolicyPayload(
  revision: number,
  values: {
    start: string;
    end: string;
    graceMinutes: number;
    maxAccuracyMeters: number;
    maxCaptureAgeSeconds: number;
    geofence: null | { latitude: number; longitude: number; radiusMeters: number };
  },
) {
  const policy = z
    .object({
      startMinute: z.number().int().min(0).max(1439).nullable(),
      endMinute: z.number().int().min(1).max(1439).nullable(),
      graceMinutes: z.number().int().min(0).max(120),
      maxAccuracyMeters: z.number().min(1).max(10000),
      maxCaptureAgeSeconds: z.number().int().min(30).max(900),
      geofence: z
        .object({
          latitude: z.number().min(-90).max(90),
          longitude: z.number().min(-180).max(180),
          radiusMeters: z.number().min(10).max(100000),
        })
        .nullable(),
    })
    .superRefine((value, ctx) => {
      if (
        (value.startMinute === null) !== (value.endMinute === null) ||
        (value.startMinute !== null &&
          value.endMinute !== null &&
          value.endMinute <= value.startMinute)
      )
        ctx.addIssue({
          code: 'custom',
          message: 'Set both working times, with the end after the start, or leave both empty.',
        });
    })
    .parse({
      startMinute: minute(values.start),
      endMinute: minute(values.end),
      graceMinutes: values.graceMinutes,
      maxAccuracyMeters: values.maxAccuracyMeters,
      maxCaptureAgeSeconds: values.maxCaptureAgeSeconds,
      geofence: values.geofence,
    });
  return { revision: z.number().int().min(0).parse(revision), attendancePolicy: policy };
}
export function validationMessage(error: unknown) {
  return error instanceof z.ZodError
    ? error.issues[0].message
    : error instanceof Error
      ? error.message
      : 'Unable to save changes.';
}
