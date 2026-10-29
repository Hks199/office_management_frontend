export interface Field {
  name: string;
  label?: string;
  type?:
    | 'text'
    | 'email'
    | 'tel'
    | 'date'
    | 'datetime-local'
    | 'number'
    | 'textarea'
    | 'select'
    | 'boolean'
    | 'grants'
    | 'multi-lookup';
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: string;
  options?: string[];
  disabledOptions?: string[];
  lookup?: string;
  parent?: string;
  nullable?: boolean;
  hint?: string;
}
export interface Action {
  endpoint?: string;
  label: string;
  permission: string;
  path: string;
  method?: 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  fields: Field[];
  revision?: boolean;
  needs?: string[];
}
export interface ResourceConfig {
  slug: string;
  title: string;
  singular: string;
  description: string;
  endpoint: string;
  permission: string;
  columns: string[];
  search?: boolean;
  filters?: Field[];
  fields?: Field[];
  createPermission?: string;
  editPermission?: string;
  editFields?: Field[];
  editMethod?: 'PATCH' | 'PUT';
  actions?: Action[];
  needs?: string[];
  unpaginated?: boolean;
}
const text = (name: string, max = 100): Field => ({ name, required: true, max });
const id = (name: string, lookup: string, nullable = false): Field => ({
  name,
  lookup,
  required: !nullable,
  nullable,
});
const choice = (name: string, options: string[], required = true): Field => ({
  name,
  type: 'select',
  options,
  required,
});
const reason: Field = { name: 'reason', type: 'textarea', required: true, min: 3, max: 500 };
const activeFilter: Field = {
  name: 'isActive',
  label: 'Active status',
  type: 'select',
  options: ['true', 'false'],
};
const phone: Field = {
  name: 'mobileNumber',
  type: 'tel',
  pattern: '[0-9]{10}|\\+[1-9][0-9]{7,14}',
  hint: 'Enter a 10-digit Indian number, for example 9876543210. +91 is added automatically. Other countries require their country code.',
  required: true,
};
const profile: Field[] = [
  text('firstName', 80),
  text('lastName', 80),
  { name: 'email', type: 'email', required: true, max: 254 },
  phone,
  { name: 'dateOfJoining', type: 'date', required: true },
  { name: 'designation', max: 100 },
  { name: 'department', max: 100 },
];
const geography: Field[] = [
  id('stateId', '/locations/states'),
  { ...id('districtId', '/locations/districts'), parent: 'stateId' },
  { ...id('blockId', '/locations/blocks', true), parent: 'districtId' },
];
const requirements: Field[] = [
  {
    name: 'requiredCapacityKw',
    label: 'Required capacity (kW)',
    required: true,
    pattern: '(0|[1-9]\\d{0,7})(\\.\\d{1,2})?',
  },
  {
    name: 'ratePerKw',
    label: 'Rate per kW (₹)',
    required: true,
    pattern: '(0|[1-9]\\d{0,7})(\\.\\d{1,2})?',
  },
  ...['paymentMode', 'panelBrand', 'panelTechnology', 'leadSource'].map((name): Field => ({
    name,
    required: true,
    lookup: `/reference-values?category=${name.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase()}`,
  })),
  { name: 'nextFollowUpAt', type: 'datetime-local', nullable: true },
];
const leadContact: Field[] = [
  text('customerName', 150),
  phone,
  ...geography,
  { name: 'siteAddress', type: 'textarea', min: 3, max: 1000, required: true },
  { name: 'remarks', type: 'textarea', max: 2000 },
];
const review = (permission: string, remarks = false): Action => ({
  label: 'Review',
  permission,
  path: '/review',
  fields: [
    choice('reviewStatus', ['PENDING', 'APPROVED', 'REJECTED']),
    { ...reason, name: remarks ? 'remarks' : 'reason' },
  ],
  revision: true,
});
const statuses = [
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
];
const policyFields: Field[] = [
  id('creatorRoleId', '/roles'),
  id('targetRoleId', '/roles'),
  {
    name: 'allowedManagerRoleIds',
    label: 'Allowed manager roles',
    lookup: '/roles',
    type: 'multi-lookup',
    required: true,
  },
  choice('branchRule', ['SAME_BRANCH', 'EXPLICIT_SCOPE']),
  { name: 'allowCrossBranchReporting', type: 'boolean' },
  { name: 'isActive', type: 'boolean' },
];
export const resources: ResourceConfig[] = [
  {
    slug: 'hierarchy',
    title: 'Reporting hierarchy',
    singular: 'employee',
    description: 'Explore the reporting structure within your access.',
    endpoint: '/employees/hierarchy',
    permission: 'hierarchy:read',
    needs: ['users:read'],
    search: true,
    columns: [
      'employeeCode',
      'firstName',
      'lastName',
      'designation',
      'hierarchyDepth',
      'reportingManagerId',
    ],
    filters: [{ name: 'rootId', lookup: '/employees' }],
  },
  {
    slug: 'references',
    title: 'Lead reference values',
    singular: 'reference value',
    description: 'Maintain approved payment modes, panel options, and lead sources.',
    endpoint: '/reference-values',
    permission: 'locations:read',
    unpaginated: true,
    filters: [
      choice('category', ['PAYMENT_MODE', 'PANEL_BRAND', 'PANEL_TECHNOLOGY', 'LEAD_SOURCE']),
      activeFilter,
    ],
    columns: ['category', 'code', 'label', 'isActive'],
    createPermission: 'settings:manage',
    fields: [
      choice('category', ['PAYMENT_MODE', 'PANEL_BRAND', 'PANEL_TECHNOLOGY', 'LEAD_SOURCE']),
      { name: 'code', pattern: '[A-Z0-9_-]{1,32}', required: true },
      text('label'),
    ],
    editPermission: 'settings:manage',
    editFields: [text('label'), { name: 'isActive', type: 'boolean' }],
  },
  {
    slug: 'employees',
    title: 'Employees',
    singular: 'employee',
    description: 'The people moving your organization forward.',
    endpoint: '/employees',
    permission: 'users:read',
    search: true,
    columns: ['employeeCode', 'firstName', 'lastName', 'email', 'designation', 'employmentStatus'],
    filters: [choice('employmentStatus', ['ACTIVE', 'ON_LEAVE', 'EXITED'], false), activeFilter],
    createPermission: 'users:create',
    fields: [
      { name: 'employeeCode', pattern: '[A-Z0-9-]{2,32}', required: true },
      ...profile,
      { ...id('roleId', '/employees/role-options'), label: 'Role' },
      id('branchId', '/branches', true),
      {
        ...id('reportingManagerIds', '/employees'),
        label: 'Reporting managers',
        type: 'multi-lookup',
        hint: 'Tick the managers you want to select (up to 10). Each manager gains access within their existing permissions.',
      },
    ],
    editPermission: 'users:update',
    editFields: profile,
    actions: [
      {
        label: 'Change manager',
        permission: 'users:change_manager',
        path: '/manager',
        revision: true,
        fields: [
          {
            ...id('reportingManagerIds', '/employees'),
            label: 'Reporting managers',
            type: 'multi-lookup',
            hint: 'Tick the managers you want to select (up to 10). Each manager gains access within their existing permissions.',
          },
          reason,
        ],
      },
      {
        label: 'Transfer branch',
        permission: 'users:transfer',
        path: '/branch',
        revision: true,
        fields: [
          id('branchId', '/branches', true),
          {
            ...id('reportingManagerIds', '/employees'),
            label: 'Reporting managers',
            type: 'multi-lookup',
            hint: 'Tick the managers you want to select (up to 10). Each manager gains access within their existing permissions.',
          },
          reason,
        ],
      },
      {
        label: 'Change role',
        permission: 'roles:assign',
        path: '/role',
        revision: true,
        fields: [{ ...id('roleId', '/employees/role-options/assignment'), label: 'Role' }, reason],
      },
      {
        label: 'Employment status',
        permission: 'users:deactivate',
        path: '/status',
        revision: true,
        fields: [
          { name: 'isActive', type: 'boolean' },
          choice('employmentStatus', ['ACTIVE', 'ON_LEAVE', 'EXITED']),
          reason,
        ],
      },
    ],
  },
  {
    slug: 'branches',
    title: 'Branches',
    singular: 'branch',
    description: 'Connected locations. One shared direction.',
    endpoint: '/branches',
    permission: 'branches:read',
    search: true,
    filters: [activeFilter],
    columns: ['branchCode', 'branchName', 'address', 'contactNumber', 'isActive'],
    createPermission: 'branches:create',
    fields: [
      { name: 'branchCode', required: true, pattern: '[A-Z0-9_-]{2,32}' },
      text('branchName'),
      { name: 'address', type: 'textarea', min: 5, max: 500, required: true },
      { ...phone, name: 'contactNumber' },
      ...geography,
    ],
    editPermission: 'branches:update',
    editFields: [
      text('branchName'),
      { name: 'address', type: 'textarea', min: 5, max: 500, required: true },
      { ...phone, name: 'contactNumber' },
      { name: 'isActive', type: 'boolean' },
    ],
    actions: [
      {
        label: 'Assign branch head',
        permission: 'branches:assign_head',
        path: '/head',
        revision: true,
        fields: [id('branchHeadId', '/employees', true), reason],
      },
    ],
  },
  {
    slug: 'contacts',
    title: 'Contacts',
    singular: 'contact',
    description:
      'Call imported contacts, record their interest, and convert qualified opportunities to leads. Confirmed business becomes a customer.',
    endpoint: '/customers',
    permission: 'customers:read',
    search: true,
    columns: ['customerName', 'mobileNumber', 'siteAddress', 'status', 'assignedTo'],
    filters: [choice('status', ['AVAILABLE', 'INTERESTED', 'NOT_INTERESTED', 'CONVERTED'], false)],
    actions: [
      {
        label: 'Reassign contact',
        permission: 'customers:assign',
        path: '/assignments',
        method: 'POST',
        revision: true,
        fields: [{ ...id('assignedTo', '/employees'), label: 'New telecaller' }, reason],
      },
      {
        label: 'Update status',
        permission: 'customers:read',
        path: '/status',
        revision: true,
        fields: [choice('status', ['AVAILABLE', 'INTERESTED', 'NOT_INTERESTED']), reason],
      },
      {
        label: 'Convert to lead',
        permission: 'leads:create',
        path: '/convert',
        method: 'POST',
        revision: true,
        fields: [
          {
            ...id('branchId', '/leads/branch-options'),
            label: 'Receiving branch',
            hint: 'Choose the branch serving the contact’s site address. Its branch head or an authorized senior will assign a sales executive.',
          },
          ...requirements.map((field) => ({ ...field, name: `requirements.${field.name}` })),
        ],
      },
    ],
  },
  {
    slug: 'customers',
    title: 'Customers',
    singular: 'customer',
    description: 'Confirmed business from converted leads. Reopened leads are marked for review.',
    endpoint: '/sales-customers',
    permission: 'leads:read',
    search: true,
    columns: [
      'name',
      'mobileNumber',
      'branchId',
      'assignedTo',
      'projectValue',
      'confirmedAt',
      'status',
    ],
    filters: [choice('status', ['CONFIRMED', 'REVIEW_REQUIRED'], false)],
  },
  {
    slug: 'leads',
    title: 'Leads',
    singular: 'lead',
    description:
      'Qualify opportunities and mark confirmed business Converted to create a customer.',
    endpoint: '/leads',
    permission: 'leads:read',
    search: true,
    columns: [
      'customerName',
      'branchId',
      'assignedTo',
      'assignmentState',
      'status',
      'mobileNumber',
      'requiredCapacityKw',
      'nextFollowUpAt',
    ],
    filters: [
      choice('status', statuses, false),
      { ...choice('assignmentState', ['UNASSIGNED', 'ASSIGNED'], false), label: 'Assignment' },
    ],
    createPermission: 'leads:create',
    fields: [
      ...leadContact,
      ...requirements,
      {
        ...id('branchId', '/leads/branch-options'),
        label: 'Receiving branch',
        hint: 'Choose the branch serving the site address. The branch head or an authorized senior assigns the sales executive.',
      },
    ],
    editPermission: 'leads:update',
    editFields: [...leadContact, ...requirements],
    actions: [
      {
        label: 'Route to branch',
        permission: 'leads:route',
        path: '/route',
        method: 'POST',
        revision: true,
        fields: [{ ...id('branchId', '/leads/branch-options'), label: 'Receiving branch' }, reason],
      },
      {
        label: 'Capture target milestone',
        permission: 'reports:review',
        needs: ['leads:read'],
        endpoint: '/target-evidence/leads/:id/capture',
        path: '',
        method: 'POST',
        fields: [choice('milestone', ['CREATED', 'QUALIFIED', 'CONVERTED'])],
      },
      {
        label: 'Change status',
        permission: 'leads:update',
        path: '/status',
        revision: true,
        fields: [choice('status', statuses), reason],
      },
      {
        label: 'Assign lead',
        permission: 'leads:assign',
        path: '/assignments',
        method: 'POST',
        revision: true,
        fields: [
          {
            ...id('assignedTo', '/leads/:id/assignees'),
            label: 'Sales executive',
            hint: 'Only active sales executives in this lead’s receiving branch are listed.',
          },
          reason,
        ],
      },
      {
        label: 'Propose assignment',
        permission: 'leads:propose_assignment',
        path: '/assignment-proposals',
        method: 'POST',
        revision: true,
        fields: [id('assignedTo', '/employees'), reason],
      },
    ],
  },
  {
    slug: 'attendance',
    title: 'Attendance',
    singular: 'attendance record',
    description: 'A clear view of your team’s working day.',
    endpoint: '/attendance',
    permission: 'attendance:read',
    columns: [
      'attendanceDate',
      'employeeId',
      'branchId',
      'effectiveCheckInAt',
      'effectiveCheckOutAt',
      'workingHours',
      'status',
      'lateArrival',
      'reviewStatus',
    ],
    filters: [
      { name: 'month', type: 'text', pattern: '20[0-9]{2}-(0[1-9]|1[0-2])', hint: 'YYYY-MM' },
      choice('reviewStatus', ['PENDING', 'APPROVED', 'REJECTED'], false),
    ],
    actions: [
      review('attendance:review'),
      {
        label: 'Correct timestamps',
        permission: 'attendance:correct',
        path: '/corrections',
        method: 'POST',
        revision: true,
        fields: [
          { name: 'effectiveCheckInAt', type: 'datetime-local', required: true },
          { name: 'effectiveCheckOutAt', type: 'datetime-local', nullable: true },
          reason,
        ],
      },
    ],
  },
  {
    slug: 'calls',
    title: 'Call reports',
    singular: 'call report',
    description: 'Meaningful conversations, measured with care.',
    endpoint: '/telecaller-reports/calls',
    permission: 'reports:read',
    columns: [
      'callStartedAt',
      'customerName',
      'callOutcome',
      'callDurationSeconds',
      'reviewStatus',
    ],
    filters: [choice('reviewStatus', ['PENDING', 'APPROVED', 'REJECTED'], false)],
    createPermission: 'reports:create',
    fields: [
      {
        ...id('customerId', '/telecaller-reports/contact-options'),
        hint: 'Choose an Available or Interested contact assigned to you or within your authorized team. Your name is recorded as the caller.',
      },
      { name: 'callStartedAt', type: 'datetime-local', required: true },
      { name: 'callEndedAt', type: 'datetime-local', required: true },
      choice('callOutcome', [
        'CONNECTED',
        'NOT_ANSWERED',
        'BUSY',
        'SWITCHED_OFF',
        'WRONG_NUMBER',
        'CALLBACK_REQUESTED',
        'INTERESTED',
        'NOT_INTERESTED',
      ]),
      { name: 'followUpAt', type: 'datetime-local', nullable: true },
      { name: 'remarks', type: 'textarea', max: 2000 },
    ],
    actions: [review('reports:review', true)],
  },
  {
    slug: 'visits',
    title: 'Site visits',
    singular: 'site visit',
    description: 'On-site activity, submitted and verified.',
    endpoint: '/sales-reports/visits',
    permission: 'reports:read',
    columns: [
      'businessDate',
      'customerName',
      'siteAddress',
      'visitOutcome',
      'status',
      'reviewStatus',
    ],
    filters: [choice('reviewStatus', ['PENDING', 'APPROVED', 'REJECTED'], false)],
    actions: [review('reports:review', true)],
  },
  {
    slug: 'targets',
    title: 'Targets',
    singular: 'target',
    description: 'Set a direction. Track verified progress.',
    endpoint: '/targets',
    permission: 'targets:read',
    filters: [choice('status', ['ACTIVE', 'CANCELLED'], false)],
    columns: [
      'employeeId',
      'targetType',
      'targetValue',
      'periodType',
      'startDate',
      'endDate',
      'status',
    ],
    createPermission: 'targets:create',
    fields: [
      id('employeeId', '/employees'),
      choice('targetType', [
        'CALLS_COMPLETED',
        'CONNECTED_CALLS',
        'LEADS_GENERATED',
        'SITE_VISITS',
        'QUALIFIED_LEADS',
        'CONVERSIONS',
        'SALES_VALUE',
      ]),
      { name: 'targetValue', pattern: '(0|[1-9]\\d{0,15})(\\.\\d{1,2})?', required: true },
      choice('periodType', ['DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM']),
      { name: 'startDate', type: 'date', required: true },
      {
        name: 'endDate',
        type: 'date',
        required: true,
        hint: 'Exclusive end date; must be after the start date.',
      },
    ],
    editPermission: 'targets:update',
    editFields: [
      { name: 'targetValue', pattern: '(0|[1-9]\\d{0,15})(\\.\\d{1,2})?', required: true },
      { name: 'startDate', type: 'date', required: true },
      { name: 'endDate', type: 'date', required: true },
      choice('status', ['ACTIVE', 'CANCELLED']),
      reason,
    ],
  },
  {
    slug: 'evidence',
    title: 'Target evidence',
    singular: 'evidence',
    description: 'Verify the milestones behind your team’s progress.',
    endpoint: '/target-evidence',
    permission: 'reports:read',
    needs: ['leads:read'],
    columns: ['employeeId', 'leadId', 'milestone', 'reviewStatus', 'createdAt'],
    filters: [choice('reviewStatus', ['PENDING', 'APPROVED', 'REJECTED'], false)],
    actions: [{ ...review('reports:review', true), needs: ['leads:read'] }],
  },
  {
    slug: 'roles',
    title: 'Roles & access',
    singular: 'role',
    description: 'Give every person the access their work requires.',
    endpoint: '/roles',
    permission: 'roles:read',
    search: true,
    filters: [activeFilter],
    columns: ['name', 'code', 'description', 'isActive', 'revision'],
    createPermission: 'roles:create',
    fields: [
      text('name'),
      { name: 'code', pattern: '[A-Z][A-Z0-9_]{1,31}', required: true },
      { name: 'description', type: 'textarea', max: 500 },
      { name: 'allowsNoBranch', type: 'boolean' },
      { name: 'permissions', type: 'grants' },
    ],
    editPermission: 'roles:update',
    editFields: [
      text('name'),
      { name: 'description', type: 'textarea', max: 500 },
      { name: 'allowsNoBranch', type: 'boolean' },
      { name: 'isActive', type: 'boolean' },
      { name: 'permissions', type: 'grants' },
    ],
    actions: [
      {
        label: 'Archive role',
        permission: 'roles:delete',
        path: '',
        method: 'DELETE',
        fields: [],
        revision: true,
      },
    ],
  },
  {
    slug: 'policies',
    title: 'Creation policies',
    singular: 'creation policy',
    description: 'Control which roles may create and manage employees.',
    endpoint: '/role-creation-policies',
    permission: 'policies:manage',
    filters: [activeFilter],
    columns: ['creatorRoleId', 'targetRoleId', 'branchRule', 'isActive'],
    createPermission: 'policies:manage',
    fields: policyFields,
    editPermission: 'policies:manage',
    editMethod: 'PUT',
    editFields: policyFields,
  },
  {
    slug: 'states',
    title: 'States',
    singular: 'state',
    description: 'Maintain approved geographic master data.',
    endpoint: '/locations/states',
    permission: 'locations:read',
    search: true,
    filters: [activeFilter],
    columns: ['name', 'code', 'isActive'],
    createPermission: 'locations:manage',
    fields: [text('name'), { name: 'code', required: true, pattern: '[A-Z0-9_-]{1,32}' }],
    editPermission: 'locations:manage',
    editFields: [text('name'), { name: 'isActive', type: 'boolean' }],
  },
  {
    slug: 'districts',
    title: 'Districts',
    singular: 'district',
    description: 'Maintain districts within your approved states.',
    endpoint: '/locations/districts',
    permission: 'locations:read',
    search: true,
    filters: [id('stateId', '/locations/states'), activeFilter],
    columns: ['name', 'code', 'stateId', 'isActive'],
    createPermission: 'locations:manage',
    fields: [
      text('name'),
      { name: 'code', required: true, pattern: '[A-Z0-9_-]{1,32}' },
      id('stateId', '/locations/states'),
    ],
    editPermission: 'locations:manage',
    editFields: [text('name'), { name: 'isActive', type: 'boolean' }],
  },
  {
    slug: 'blocks',
    title: 'Blocks & tehsils',
    singular: 'block',
    description: 'Keep local administrative areas organized.',
    endpoint: '/locations/blocks',
    permission: 'locations:read',
    search: true,
    filters: [
      id('stateId', '/locations/states'),
      { ...id('districtId', '/locations/districts'), parent: 'stateId' },
      activeFilter,
    ],
    columns: ['name', 'code', 'districtId', 'kind', 'isActive'],
    createPermission: 'locations:manage',
    fields: [
      text('name'),
      { name: 'code', required: true, pattern: '[A-Z0-9_-]{1,32}' },
      id('stateId', '/locations/states'),
      { ...id('districtId', '/locations/districts'), parent: 'stateId' },
      choice('kind', ['BLOCK', 'TEHSIL']),
    ],
    editPermission: 'locations:manage',
    editFields: [text('name'), { name: 'isActive', type: 'boolean' }],
  },
  {
    slug: 'imports',
    title: 'Contact imports',
    singular: 'import',
    description: 'Upload CSV or Excel contacts, review validation, then assign and import.',
    endpoint: '/csv-imports',
    permission: 'imports:read',
    columns: ['createdAt', 'status', 'totalRows', 'acceptedRows', 'rejectedRows', 'importedRows'],
  },
];
