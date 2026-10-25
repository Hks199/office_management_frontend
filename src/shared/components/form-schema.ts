import { z } from 'zod';
import type { Field } from '../../features/resources/config';
import type { RecordData } from '../types/api';
import { label } from '../lib/format';

export function initialValues(fields: Field[], initial: RecordData): RecordData {
  return Object.fromEntries(
    fields.map((field) => {
      let value: unknown = field.name
        .split('.')
        .reduce<unknown>(
          (current, key) =>
            current && typeof current === 'object' ? (current as RecordData)[key] : undefined,
          initial,
        );
      if (
        field.name === 'reportingManagerIds' &&
        (!Array.isArray(value) || !value.length) &&
        initial.reportingManagerId
      )
        value = [initial.reportingManagerId];
      if (field.type === 'date' && value) value = String(value).slice(0, 10);
      if (field.type === 'datetime-local' && value) {
        const date = new Date(String(value));
        value = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16);
      }
      return [
        field.name,
        value ??
          (field.type === 'boolean'
            ? field.name === 'isActive'
            : field.type === 'grants' || field.type === 'multi-lookup'
              ? []
              : ''),
      ];
    }),
  );
}
export function buildPayload(fields: Field[], values: RecordData): RecordData {
  const payload: RecordData = {};
  for (const field of fields) {
    let value = values[field.name];
    if (typeof value === 'string' && field.type !== 'datetime-local') value = value.trim();
    if (
      (value === '' || value === undefined) &&
      !field.required &&
      !field.nullable &&
      field.type !== 'boolean'
    )
      continue;
    if (
      field.required &&
      (value === '' ||
        value === undefined ||
        value === null ||
        (Array.isArray(value) && value.length === 0))
    )
      throw new Error(`${field.label ?? label(field.name)} is required.`);
    if (
      field.lookup &&
      !field.lookup.startsWith('/reference-values') &&
      typeof value === 'string' &&
      value
    )
      z.string()
        .regex(/^[a-f\d]{24}$/i, `Choose a valid ${label(field.name)}.`)
        .parse(value);
    if (field.lookup && Array.isArray(value)) {
      z.array(z.string().regex(/^[a-f\d]{24}$/i, 'Choose a valid option.')).parse(value);
      if (
        field.name === 'reportingManagerIds' &&
        (value.length > 10 || new Set(value).size !== value.length)
      )
        throw new Error('Choose up to ten distinct reporting managers.');
    }
    if (field.nullable && value === '') value = null;
    if (value && field.type === 'datetime-local') value = new Date(String(value)).toISOString();
    if (field.type === 'number' && value !== null && value !== '') value = Number(value);
    if (typeof value === 'string') {
      let schema = z.string();
      if (field.min !== undefined) schema = schema.min(field.min);
      if (field.max !== undefined) schema = schema.max(field.max);
      if (field.pattern)
        schema = schema.regex(
          new RegExp(`^(?:${field.pattern})$`),
          `Invalid ${label(field.name)}.`,
        );
      schema.parse(value);
      if (field.type === 'email') z.email().parse(value);
    }
    const keys = field.name.split('.');
    if (keys.length === 2) {
      payload[keys[0]] ??= {};
      (payload[keys[0]] as RecordData)[keys[1]] = value;
    } else payload[field.name] = value;
  }
  if (
    typeof payload.startDate === 'string' &&
    typeof payload.endDate === 'string' &&
    payload.startDate >= payload.endDate
  )
    throw new Error('The end date must be after the start date.');
  if (
    typeof payload.callStartedAt === 'string' &&
    typeof payload.callEndedAt === 'string' &&
    payload.callStartedAt >= payload.callEndedAt
  )
    throw new Error('The call end must be after its start.');
  return payload;
}
