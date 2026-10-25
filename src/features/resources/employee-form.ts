import type { Field } from './config';
import type { RecordData } from '../../shared/types/api';
import { recordId } from '../../shared/lib/format';

export function employeeFormFields(
  fields: Field[],
  values: RecordData,
  selectedRole?: RecordData,
): Field[] {
  const creation = fields.some(
    (field) => field.name === 'roleId' && field.lookup === '/employees/role-options',
  );
  if (!creation) return fields;
  // Missing or stale role metadata must never allow company-wide placement.
  const companyWide =
    selectedRole?.allowsNoBranch === true && recordId(selectedRole) === values.roleId;
  return fields.map((field) =>
    field.name === 'branchId'
      ? {
          ...field,
          label: 'Primary branch',
          lookup: '/employees/branch-options',
          parent: 'roleId',
          required: !companyWide,
          nullable: companyWide,
          hint: companyWide
            ? 'Select None if this employee has no primary branch, or choose a branch.'
            : 'A primary branch is required for this role. Select the branch where this employee will work.',
        }
      : field.name === 'reportingManagerIds'
        ? {
            ...field,
            lookup: '/employees/manager-options',
            parent: 'roleId',
            hint: 'Tick one or more approved managers (up to 10). Each manager can access this employee and their team within their existing permissions.',
          }
        : field,
  );
}
