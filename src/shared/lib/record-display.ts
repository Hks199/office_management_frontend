import type { RecordData } from '../types/api';
import { display, label } from './format';

export const references = {
  entityId: { title: 'Related record', name: 'entityName', code: 'entityCode' },
  rootId: { title: 'Employee', name: 'rootName', code: 'rootCode' },
  allowedManagerRoleIds: {
    title: 'Allowed manager roles',
    name: 'allowedManagerRoleNames',
    code: 'allowedManagerRoleCodes',
  },
  photoFileIds: { title: 'Photos', name: 'photoFileNames', code: 'photoFileCodes' },
  employeeId: { title: 'Employee', name: 'employeeName', code: 'employeeCode' },
  userId: { title: 'Employee', name: 'userName', code: 'userCode' },
  actorId: { title: 'Performed by', name: 'actorName', code: 'actorCode' },
  actingAsEmployeeId: {
    title: 'Employee panel',
    name: 'actingAsEmployeeName',
    code: 'actingAsEmployeeCode',
  },
  ownerId: { title: 'Owner', name: 'ownerName', code: 'ownerCode' },
  managerId: { title: 'Manager', name: 'managerName', code: 'managerCode' },
  branchHeadId: { title: 'Branch head', name: 'branchHeadName', code: 'branchHeadCode' },
  salesExecutiveId: {
    title: 'Sales executive',
    name: 'salesExecutiveName',
    code: 'salesExecutiveCode',
  },
  proposedTo: { title: 'Proposed assignee', name: 'proposedToName', code: 'proposedToCode' },
  proposedBy: { title: 'Proposed by', name: 'proposedByName', code: 'proposedByCode' },
  reviewedBy: { title: 'Reviewed by', name: 'reviewedByName', code: 'reviewedByCode' },
  changedBy: { title: 'Changed by', name: 'changedByName', code: 'changedByCode' },
  performedBy: { title: 'Performed by', name: 'performedByName', code: 'performedByCode' },
  creatorRoleId: { title: 'Creator role', name: 'creatorRoleName', code: 'creatorRoleCode' },
  targetRoleId: { title: 'Target role', name: 'targetRoleName', code: 'targetRoleCode' },
  stateId: { title: 'State', name: 'stateName', code: 'stateCode' },
  districtId: { title: 'District', name: 'districtName', code: 'districtCode' },
  blockId: { title: 'Block / tehsil', name: 'blockName', code: 'blockCode' },
  customerId: { title: 'Contact', name: 'customerName', code: 'customerCode' },
  contactId: { title: 'Contact', name: 'contactName', code: 'contactCode' },
  sourceCustomerId: {
    title: 'Source contact',
    name: 'sourceContactName',
    code: 'sourceContactCode',
  },
  leadId: { title: 'Lead', name: 'leadName', code: 'leadCode' },
  reportId: { title: 'Report', name: 'reportName', code: 'reportCode' },
  visitId: { title: 'Visit', name: 'visitName', code: 'visitCode' },
  targetId: { title: 'Target', name: 'targetName', code: 'targetCode' },
  permissionId: { title: 'Permission', name: 'permissionName', code: 'permissionCode' },
  checkInPhotoFileId: {
    title: 'Check-in photo',
    name: 'checkInPhotoName',
    code: 'checkInPhotoCode',
  },
  checkOutPhotoFileId: {
    title: 'Check-out photo',
    name: 'checkOutPhotoName',
    code: 'checkOutPhotoCode',
  },
  roleId: { title: 'Role', name: 'roleName', code: 'roleCode' },
  branchId: { title: 'Branch', name: 'branchName', code: 'branchCode' },
  createdBy: { title: 'Created by', name: 'createdByName', code: 'createdByCode' },
  confirmedBy: { title: 'Confirmed by', name: 'confirmedByName', code: 'confirmedByCode' },
  confirmedCustomerId: {
    title: 'Customer',
    name: 'confirmedCustomerCode',
    code: 'confirmedCustomerCode',
  },
  assignedTo: { title: 'Assigned to', name: 'assignedToName', code: 'assignedToCode' },
  assignedBy: { title: 'Assigned by', name: 'assignedByName', code: 'assignedByCode' },
  routedBy: { title: 'Routed by', name: 'routedByName', code: 'routedByCode' },
  telecallerId: { title: 'Telecaller', name: 'telecallerName', code: 'telecallerCode' },
  previousAssigneeId: {
    title: 'Previous assignee',
    name: 'previousAssigneeName',
    code: 'previousAssigneeCode',
  },
  fileId: { title: 'File', name: 'fileName', code: 'fileCode' },
  reportingManagerIds: {
    title: 'Reporting managers',
    name: 'reportingManagerNames',
    code: 'reportingManagerCodes',
  },
  reportingManagerId: {
    title: 'Reporting manager',
    name: 'reportingManagerName',
    code: 'reportingManagerCode',
  },
} as const;

export const technicalFields = new Set([
  'employeePanelId',
  '_id',
  'id',
  '__v',
  'requestId',
  'sessionId',
  'credentialId',
  'leaseId',
  'versionId',
  'sourceEventId',
  'evidenceId',
]);

export function recordFieldLabel(key: string) {
  return Object.hasOwn(references, key)
    ? references[key as keyof typeof references].title
    : label(key);
}

export function recordFieldValue(record: RecordData, key: string): string {
  if (key === 'assignmentState') return label(String(record[key]));
  if (key === 'leadId' && typeof record.leadCode === 'string') return record.leadCode;
  if (key === 'entityType' && record[key] === 'CUSTOMER') return 'Contact';
  if (key === 'visitOutcome' && record[key] === 'CUSTOMER_UNAVAILABLE')
    return 'Contact unavailable';
  const reference = Object.hasOwn(references, key)
    ? references[key as keyof typeof references]
    : undefined;
  if (!reference) {
    const value = record[key];
    if (Array.isArray(value))
      return value
        .map((item) =>
          typeof item === 'object' && item
            ? recordDisplayFields(item as RecordData)
                .map((field) => `${field.title}: ${field.value}`)
                .join(' · ')
            : display(item),
        )
        .join(', ');
    if (value && typeof value === 'object')
      return recordDisplayFields(value as RecordData)
        .map((field) => `${field.title}: ${field.value}`)
        .join(' · ');
    return display(value);
  }
  if (!record[key]) return key === 'assignedTo' ? 'Not assigned' : 'None';
  if (Array.isArray(record[reference.name])) {
    const codes = record[reference.code];
    return (
      (record[reference.name] as unknown[])
        .map((name, index) =>
          Array.isArray(codes) && codes[index]
            ? `${display(name)} (${display(codes[index])})`
            : display(name),
        )
        .join(', ') || 'None'
    );
  }
  if (!(reference.name in record) && typeof record[key] === 'object') return display(record[key]);
  const name = record[reference.name];
  if (typeof name !== 'string' || !name.trim()) return `${reference.title} unavailable`;
  const code = record[reference.code];
  return [
    'reportingManagerId',
    'createdBy',
    'confirmedBy',
    'assignedTo',
    'assignedBy',
    'previousAssigneeId',
  ].includes(key) &&
    typeof code === 'string' &&
    code
    ? `${name} (${code})`
    : name;
}

export function recordDisplayFields(record: RecordData) {
  const hidden = new Set(technicalFields);
  if (Array.isArray(record.reportingManagerIds)) {
    hidden.add('reportingManagerId');
    hidden.add('reportingManagerName');
    hidden.add('reportingManagerCode');
  }
  for (const [key, reference] of Object.entries(references)) {
    if (key in record && reference.name in record) {
      hidden.add(reference.name);
      hidden.add(reference.code);
    }
  }
  return Object.keys(record)
    .filter((key) => !hidden.has(key))
    .map((key) => ({ key, title: recordFieldLabel(key), value: recordFieldValue(record, key) }));
}
