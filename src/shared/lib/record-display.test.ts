import { expect, it } from 'vitest';
import { recordDisplayFields, recordFieldValue } from './record-display';

it('shows employee relationship names without duplicate metadata or raw IDs', () => {
  const fields = recordDisplayFields({
    _id: 'a'.repeat(24),
    roleId: 'b'.repeat(24),
    roleName: 'Sales Executive',
    roleCode: 'SEX',
    branchId: 'c'.repeat(24),
    branchName: 'Raipur',
    branchCode: 'BR-01',
    reportingManagerId: 'd'.repeat(24),
    reportingManagerName: 'Ravi Kumar',
    reportingManagerCode: 'SV-MH-001',
  });
  expect(fields).toEqual([
    { key: 'roleId', title: 'Role', value: 'Sales Executive' },
    { key: 'branchId', title: 'Branch', value: 'Raipur' },
    { key: 'reportingManagerId', title: 'Reporting manager', value: 'Ravi Kumar (SV-MH-001)' },
  ]);
});
it('distinguishes no branch or manager from a missing referenced record', () => {
  expect(recordFieldValue({ branchId: null, branchName: null }, 'branchId')).toBe('None');
  expect(
    recordFieldValue(
      { reportingManagerId: null, reportingManagerName: null },
      'reportingManagerId',
    ),
  ).toBe('None');
  expect(
    recordFieldValue(
      { reportingManagerId: 'd'.repeat(24), reportingManagerName: null },
      'reportingManagerId',
    ),
  ).toBe('Reporting manager unavailable');
});
it('keeps standalone names and unrelated values visible', () => {
  expect(recordDisplayFields({ branchName: 'Raipur', isActive: true })).toEqual([
    { key: 'branchName', title: 'Branch Name', value: 'Raipur' },
    { key: 'isActive', title: 'Is Active', value: 'Yes' },
  ]);
});

it('shows readable contact assignment history and hides duplicate label metadata', () => {
  expect(recordFieldValue({ entityType: 'CUSTOMER' }, 'entityType')).toBe('Contact');
  expect(recordFieldValue({ visitOutcome: 'CUSTOMER_UNAVAILABLE' }, 'visitOutcome')).toBe(
    'Contact unavailable',
  );
  expect(
    recordDisplayFields({
      assignedBy: 'a'.repeat(24),
      assignedByName: 'Ravi Kumar',
      assignedByCode: 'MD-01',
      previousAssigneeId: 'b'.repeat(24),
      previousAssigneeName: 'Priya Singh',
      previousAssigneeCode: 'TC-01',
    }),
  ).toEqual([
    { key: 'assignedBy', title: 'Assigned by', value: 'Ravi Kumar (MD-01)' },
    { key: 'previousAssigneeId', title: 'Previous assignee', value: 'Priya Singh (TC-01)' },
  ]);
});

it('renders import references as names and omits the technical request identifier', () => {
  const fields = recordDisplayFields({
    createdBy: 'a'.repeat(24),
    createdByName: 'Ravi Kumar',
    createdByCode: 'MD-01',
    branchId: 'b'.repeat(24),
    branchName: 'Raipur',
    branchCode: 'RP',
    fileId: 'c'.repeat(24),
    fileName: 'contacts.csv',
    assignedTo: 'd'.repeat(24),
    assignedToName: 'Priya Singh',
    assignedToCode: 'TC-01',
    requestId: 'technical-trace-id',
  });
  expect(fields).toEqual([
    { key: 'createdBy', title: 'Created by', value: 'Ravi Kumar (MD-01)' },
    { key: 'branchId', title: 'Branch', value: 'Raipur' },
    { key: 'fileId', title: 'File', value: 'contacts.csv' },
    { key: 'assignedTo', title: 'Assigned to', value: 'Priya Singh (TC-01)' },
  ]);
  expect(recordFieldValue({ assignedTo: null, assignedToName: null }, 'assignedTo')).toBe(
    'Not assigned',
  );
  expect(recordFieldValue({ createdBy: 'a'.repeat(24), createdByName: null }, 'createdBy')).toBe(
    'Created by unavailable',
  );
});
