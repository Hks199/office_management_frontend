import type { RecordData } from '../types/api';
import { references } from './record-display';

export interface DisplayReference {
  kind: string;
  id: string;
  name?: string;
  code?: string;
}
const employeeFields = new Set([
  'employeeId',
  'rootId',
  'userId',
  'actorId',
  'ownerId',
  'managerId',
  'branchHeadId',
  'salesExecutiveId',
  'proposedTo',
  'proposedBy',
  'reviewedBy',
  'changedBy',
  'performedBy',
  'createdBy',
  'confirmedBy',
  'assignedTo',
  'assignedBy',
  'routedBy',
  'telecallerId',
  'previousAssigneeId',
  'reportingManagerId',
  'actingAsEmployeeId',
  'reportingManagerIds',
]);
export function referenceKind(key: string, record?: RecordData): string | undefined {
  if (key === 'entityId')
    return (
      {
        user: 'employee',
        employee: 'employee',
        branch: 'branch',
        role: 'role',
        customer: 'contact',
        contact: 'contact',
        lead: 'lead',
        report: 'report',
        target: 'target',
        file: 'file',
        state: 'state',
        district: 'district',
        block: 'block',
      } as Record<string, string>
    )[String(record?.entityType ?? '').toLowerCase()];
  if (key === 'allowedManagerRoleIds') return 'role';
  if (key === 'photoFileIds') return 'file';
  if (employeeFields.has(key)) return 'employee';
  if (['roleId', 'creatorRoleId', 'targetRoleId'].includes(key)) return 'role';
  if (['customerId', 'contactId', 'sourceCustomerId'].includes(key)) return 'contact';
  if (['reportId', 'visitId'].includes(key)) return 'report';
  if (['fileId', 'checkInPhotoFileId', 'checkOutPhotoFileId'].includes(key)) return 'file';
  return (
    {
      branchId: 'branch',
      stateId: 'state',
      districtId: 'district',
      blockId: 'block',
      leadId: 'lead',
      targetId: 'target',
      permissionId: 'permission',
    } as Record<string, string>
  )[key];
}
export function collectReferences(data: unknown): DisplayReference[] {
  const found = new Map<string, DisplayReference>();
  const visit = (value: unknown) => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    const record = value as RecordData;
    Object.entries(record).forEach(([key, entry]) => {
      const kind = referenceKind(key, record);
      const definition = references[key as keyof typeof references];
      for (const id of Array.isArray(entry) ? entry : [entry]) {
        if (
          kind &&
          typeof id === 'string' &&
          /^[a-f\d]{24}$/i.test(id) &&
          !(definition && record[definition.name])
        )
          found.set(`${kind}:${id}`, { kind, id });
      }
      visit(entry);
    });
  };
  visit(data);
  return [...found.values()].sort((a, b) => `${a.kind}:${a.id}`.localeCompare(`${b.kind}:${b.id}`));
}
export function applyReferences<T>(data: T, labels: DisplayReference[]): T {
  const names = new Map(
    labels.map((reference) => [`${reference.kind}:${reference.id}`, reference]),
  );
  const visit = (value: unknown): unknown => {
    if (!value || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(visit);
    const record = Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, visit(entry)]),
    );
    for (const [key, entry] of Object.entries(record)) {
      const definition = references[key as keyof typeof references];
      if (definition && Array.isArray(entry) && !record[definition.name]) {
        const resolved = entry.map((id) =>
          names.get(`${referenceKind(key, record)}:${String(id)}`),
        );
        if (resolved.some(Boolean))
          record[definition.name] = resolved
            .map((name) => name?.name ?? 'Record unavailable')
            .join(', ');
        continue;
      }
      const name = names.get(`${referenceKind(key, record)}:${String(entry)}`);
      if (definition && name && !record[definition.name]) {
        record[definition.name] = name.name;
        if (!record[definition.code]) record[definition.code] = name.code;
      }
    }
    return record;
  };
  return visit(data) as T;
}
