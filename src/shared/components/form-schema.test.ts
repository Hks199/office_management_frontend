import { describe, expect, it } from 'vitest';
import { buildPayload, initialValues } from './form-schema';
import { resources } from '../../features/resources/config';
describe('backend form contracts', () => {
  it('accepts local Indian phone numbers and existing international numbers in phone fields', () => {
    const mobile = resources
      .find((resource) => resource.slug === 'employees')!
      .fields!.find((field) => field.name === 'mobileNumber')!;
    const contact = resources
      .find((resource) => resource.slug === 'branches')!
      .fields!.find((field) => field.name === 'contactNumber')!;
    for (const value of ['9876543210', '+919876543210', '+14155552671']) {
      expect(buildPayload([mobile], { mobileNumber: value })).toEqual({ mobileNumber: value });
      expect(buildPayload([contact], { contactNumber: value })).toEqual({ contactNumber: value });
    }
    for (const value of ['987654321', '919876543210', '987654321a', ''])
      expect(() => buildPayload([mobile], { mobileNumber: value })).toThrow();
  });
  it('preserves exact decimal values and nullable fields', () => {
    const fields = resources.find((resource) => resource.slug === 'targets')!.editFields!;
    const payload = buildPayload(fields, {
      targetValue: '9999999999999999.99',
      startDate: '2026-10-01',
      endDate: '2026-11-01',
      status: 'ACTIVE',
      reason: 'Updated plan',
    });
    expect(payload.targetValue).toBe('9999999999999999.99');
    expect(buildPayload([{ name: 'branchId', nullable: true }], { branchId: '' })).toEqual({
      branchId: null,
    });
  });
  it('rejects reversed target periods and invalid database identifiers', () => {
    expect(() =>
      buildPayload([{ name: 'startDate' }, { name: 'endDate' }], {
        startDate: '2026-11-01',
        endDate: '2026-10-01',
      }),
    ).toThrow('end date');
    expect(() =>
      buildPayload([{ name: 'roleId', lookup: '/roles', required: true }], { roleId: 'invalid' }),
    ).toThrow();
  });
  it('sends only configured fields and constructs nested conversion requirements', () => {
    const payload = buildPayload([{ name: 'requirements.ratePerKw', required: true }], {
      'requirements.ratePerKw': '40000.25',
      injected: 'discard',
    });
    expect(payload).toEqual({ requirements: { ratePerKw: '40000.25' } });
  });
  it('normalizes ISO employee dates for native date inputs', () => {
    expect(
      initialValues([{ name: 'dateOfJoining', type: 'date' }], {
        dateOfJoining: '2026-10-19T00:00:00.000Z',
      }),
    ).toEqual({ dateOfJoining: '2026-10-19' });
  });
});
