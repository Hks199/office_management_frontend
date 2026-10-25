import { expect, it } from 'vitest';
import { employeeFormFields } from './employee-form';
import { resources } from './config';
import { buildPayload, initialValues } from '../../shared/components/form-schema';

const fields = resources.find((resource) => resource.slug === 'employees')!.fields!;
const roleId = 'a'.repeat(24);
const branchId = 'b'.repeat(24);
function branch(role?: Record<string, unknown>, values = { roleId }) {
  return employeeFormFields(fields, values, role).find((field) => field.name === 'branchId')!;
}
it('requires a branch for branch-based roles before sending employee creation', () => {
  const field = branch({ _id: roleId, allowsNoBranch: false });
  expect(field.lookup).toBe('/employees/branch-options');
  expect(field.parent).toBe('roleId');
  expect(() => buildPayload([field], { branchId: '' })).toThrow('Primary branch is required');
  expect(() => buildPayload([field], { branchId: null })).toThrow('Primary branch is required');
  expect(buildPayload([field], { branchId })).toEqual({ branchId });
});
it('allows null only for the currently selected company-wide role', () => {
  expect(buildPayload([branch({ _id: roleId, allowsNoBranch: true })], { branchId: '' })).toEqual({
    branchId: null,
  });
  expect(() =>
    buildPayload([branch({ _id: 'c'.repeat(24), allowsNoBranch: true })], { branchId: '' }),
  ).toThrow();
  expect(() => buildPayload([branch()], { branchId: '' })).toThrow();
});
it('does not change unrelated branch or role-change forms', () => {
  const transfer = resources
    .find((resource) => resource.slug === 'employees')!
    .actions!.find((action) => action.label === 'Transfer branch')!.fields;
  expect(employeeFormFields(transfer, {}, { _id: roleId, allowsNoBranch: false })).toBe(transfer);
});
it('loads reporting managers for the selected role and resets them when the role changes', () => {
  const manager = employeeFormFields(fields, { roleId }).find(
    (field) => field.name === 'reportingManagerIds',
  );
  expect(manager).toMatchObject({
    lookup: '/employees/manager-options',
    parent: 'roleId',
    required: true,
    type: 'multi-lookup',
  });
});

it('submits multiple managers and initializes older single-manager employees', () => {
  const manager = fields.find((field) => field.name === 'reportingManagerIds')!;
  const managers = ['a'.repeat(24), 'b'.repeat(24)];
  expect(buildPayload([manager], { reportingManagerIds: managers })).toEqual({
    reportingManagerIds: managers,
  });
  expect(initialValues([manager], { reportingManagerId: managers[0] })).toEqual({
    reportingManagerIds: [managers[0]],
  });
  expect(() => buildPayload([manager], { reportingManagerIds: [] })).toThrow(
    'Reporting managers is required',
  );
  expect(() => buildPayload([manager], { reportingManagerIds: ['invalid'] })).toThrow();
  expect(() =>
    buildPayload([manager], { reportingManagerIds: [managers[0], managers[0]] }),
  ).toThrow('distinct');
});
