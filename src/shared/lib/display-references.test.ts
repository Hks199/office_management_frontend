import { expect, it } from 'vitest';
import { applyReferences, collectReferences } from './display-references';
import { recordDisplayFields, recordFieldValue } from './record-display';
import { display } from './format';

it('batches and deduplicates unresolved references including nested history and role grants', () => {
  const data = [
    {
      employeeId: 'a'.repeat(24),
      branchId: 'b'.repeat(24),
      branchName: 'Raipur',
      history: [{ actorId: 'a'.repeat(24), permissionId: 'c'.repeat(24) }],
    },
  ];
  expect(collectReferences(data)).toEqual([
    { kind: 'employee', id: 'a'.repeat(24) },
    { kind: 'permission', id: 'c'.repeat(24) },
  ]);
  const named = applyReferences(data, [
    { kind: 'employee', id: 'a'.repeat(24), name: 'Ravi Kumar', code: 'SV-01' },
    { kind: 'permission', id: 'c'.repeat(24), name: 'leads:read' },
  ]);
  expect(recordFieldValue(named[0], 'employeeId')).toBe('Ravi Kumar');
  expect(recordFieldValue(named[0], 'history')).toContain('Ravi Kumar');
  expect(JSON.stringify(recordDisplayFields(named[0]))).not.toMatch(/[a-f\d]{24}/i);
  expect(data[0]).not.toHaveProperty('employeeName');
});

it('never displays raw identifiers in missing references, unknown fields or nested values', () => {
  expect(display('a'.repeat(24))).toBe('Record unavailable');
  expect(recordFieldValue({ stateId: 'a'.repeat(24) }, 'stateId')).toBe('State unavailable');
  expect(recordFieldValue({ employeeId: null }, 'employeeId')).toBe('None');
  expect(
    JSON.stringify(
      recordDisplayFields({
        requestId: 'technical',
        metadata: { fileId: 'a'.repeat(24) },
        entityId: 'b'.repeat(24),
      }),
    ),
  ).not.toMatch(/[a-f\d]{24}|technical/);
});

it('resolves role arrays and typed audit entities while retaining internal identifiers', () => {
  const roleId = 'a'.repeat(24);
  const employeeId = 'b'.repeat(24);
  const data = { allowedManagerRoleIds: [roleId], entityType: 'USER', entityId: employeeId };
  expect(collectReferences(data)).toEqual([
    { kind: 'employee', id: employeeId },
    { kind: 'role', id: roleId },
  ]);
  const result = applyReferences(data, [
    { kind: 'role', id: roleId, name: 'Branch Head' },
    { kind: 'employee', id: employeeId, name: 'Ravi Kumar' },
  ]);
  expect(recordFieldValue(result, 'allowedManagerRoleIds')).toBe('Branch Head');
  expect(recordFieldValue(result, 'entityId')).toBe('Ravi Kumar');
  expect(result.allowedManagerRoleIds).toEqual([roleId]);
});
