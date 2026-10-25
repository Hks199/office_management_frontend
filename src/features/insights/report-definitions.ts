import type { Field } from '../resources/config';
export interface ReportDefinition {
  key: string;
  title: string;
  endpoint: string;
  permissions: string[];
  fields: Field[];
  shape?: 'days' | 'rows' | 'dashboard';
  paginated?: boolean;
  dashboardKind?: string;
}
const employee: Field = { name: 'employeeId', label: 'Employee', lookup: '/employees' };
const branch: Field = { name: 'branchId', label: 'Branch', lookup: '/branches' };
const range: Field[] = [
  { name: 'from', label: 'From date', type: 'date' },
  { name: 'to', label: 'To date', type: 'date' },
];
const targetFields: Field[] = [
  employee,
  branch,
  ...range,
  {
    name: 'targetType',
    type: 'select',
    options: [
      'CALLS_COMPLETED',
      'CONNECTED_CALLS',
      'LEADS_GENERATED',
      'SITE_VISITS',
      'QUALIFIED_LEADS',
      'CONVERSIONS',
      'SALES_VALUE',
    ],
  },
  { name: 'periodType', type: 'select', options: ['DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM'] },
  { name: 'status', type: 'select', options: ['ACTIVE', 'CANCELLED'] },
];
const attendanceFields: Field[] = [
  { name: 'month', type: 'text', pattern: '20[0-9]{2}-(0[1-9]|1[0-2])', hint: 'YYYY-MM' },
  employee,
  branch,
  { name: 'reviewStatus', type: 'select', options: ['PENDING', 'APPROVED', 'REJECTED'] },
];
export const reportDefinitions: ReportDefinition[] = [
  {
    key: 'downlines',
    title: 'Reporting downlines',
    endpoint: '/employees/downlines',
    permissions: ['hierarchy:read', 'users:read'],
    fields: [
      { name: 'rootId', label: 'Reporting root', lookup: '/employees' },
      { name: 'depth', type: 'number', min: 1, max: 20 },
    ],
    paginated: true,
  },
  {
    key: 'daily-calls',
    title: 'Daily call summary',
    endpoint: '/telecaller-reports/daily',
    permissions: ['reports:read'],
    fields: [employee, branch, ...range],
    shape: 'days',
    paginated: true,
  },
  {
    key: 'target-summary',
    title: 'Verified target summary',
    endpoint: '/targets/summary',
    permissions: ['targets:read'],
    fields: targetFields,
    shape: 'rows',
    paginated: true,
  },
  {
    key: 'target-reports',
    title: 'Detailed target report',
    endpoint: '/targets/reports',
    permissions: ['targets:read'],
    fields: targetFields,
    shape: 'rows',
    paginated: true,
  },
  {
    key: 'attendance-summary',
    title: 'Attendance summary',
    endpoint: '/attendance/summary',
    permissions: ['attendance:read'],
    fields: attendanceFields,
  },
  {
    key: 'my-attendance',
    title: 'My attendance',
    endpoint: '/attendance/me',
    permissions: ['attendance:read'],
    fields: attendanceFields.filter((field) => !['employeeId', 'branchId'].includes(field.name)),
    paginated: true,
  },
  {
    key: 'employee-attendance',
    title: 'Employee attendance',
    endpoint: '/attendance/employee',
    permissions: ['attendance:read', 'users:read'],
    fields: attendanceFields
      .filter((field) => field.name !== 'branchId')
      .map((field) => (field.name === 'employeeId' ? { ...field, required: true } : field)),
    paginated: true,
  },
  {
    key: 'branch-attendance',
    title: 'Branch attendance',
    endpoint: '/attendance/branch',
    permissions: ['attendance:read', 'branches:read'],
    fields: attendanceFields
      .filter((field) => field.name !== 'employeeId')
      .map((field) => (field.name === 'branchId' ? { ...field, required: true } : field)),
    paginated: true,
  },
  ...[
    {
      kind: 'attendance',
      title: 'Attendance dashboard',
      permissions: ['attendance:read', 'users:read'],
    },
    { kind: 'leads', title: 'Lead dashboard', permissions: ['leads:read'] },
    { kind: 'targets', title: 'Target dashboard', permissions: ['targets:read', 'reports:read'] },
    {
      kind: 'employee-performance',
      title: 'Employee performance',
      permissions: ['reports:read', 'users:read'],
    },
    {
      kind: 'branch-performance',
      title: 'Branch performance',
      permissions: ['reports:read', 'branches:read'],
    },
    {
      kind: 'role-performance',
      title: 'Role performance',
      permissions: ['reports:read', 'users:read'],
    },
    { kind: 'lead-funnel', title: 'Lead funnel', permissions: ['leads:read'] },
    { kind: 'trends', title: 'Verified trends', permissions: ['reports:read'] },
  ].map(({ kind, title, permissions }): ReportDefinition => ({
    key: kind,
    title,
    endpoint: `/dashboard/${kind}`,
    permissions: ['dashboard:read', ...permissions],
    shape: 'dashboard',
    dashboardKind: kind,
    paginated: kind.endsWith('performance'),
    fields: [
      { name: 'startDate', type: 'date', required: true },
      { name: 'endDate', label: 'End date (exclusive)', type: 'date', required: true },
      branch,
      employee,
      { name: 'roleId', label: 'Role', lookup: '/roles' },
      { name: 'compare', type: 'select', options: ['true', 'false'] },
    ],
  })),
];
