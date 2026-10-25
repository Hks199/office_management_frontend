export function label(value: string) {
  const names: Record<string, string> = {
    customerName: 'Contact Name',
    customerCode: 'Customer Code',
    customerId: 'Contact',
    customerMobile: 'Contact Mobile',
    customerInterest: 'Contact Interest',
    CUSTOMER: 'Contact',
    CUSTOMER_UNAVAILABLE: 'Contact unavailable',
    UNASSIGNED: 'Awaiting assignment',
    assignmentState: 'Assignment',
  };
  if (Object.hasOwn(names, value)) return names[value];
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_:-]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bCustomers\b/g, 'Contacts')
    .replace(/\bCustomer\b/g, 'Contact');
}
export function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return new Intl.NumberFormat('en-IN').format(value);
  if (typeof value === 'string' && /^[a-f\d]{24}$/i.test(value)) return 'Record unavailable';
  if (Array.isArray(value)) return value.map(display).join(', ');
  if (typeof value === 'object') {
    const item = value as Record<string, unknown>;
    return item.name
      ? String(item.name)
      : item.firstName
        ? `${String(item.firstName)} ${String(item.lastName ?? '')}`.trim()
        : item.branchName
          ? String(item.branchName)
          : item.employeeCode
            ? String(item.employeeCode)
            : Object.entries(item)
                .map(([key, val]) => `${label(key)}: ${display(val)}`)
                .join(' · ');
  }
  if (/^\d{4}-\d{2}-\d{2}T/.test(String(value)))
    return new Intl.DateTimeFormat('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Kolkata',
    }).format(new Date(String(value)));
  return String(value);
}
export function businessDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}
export function recordId(record: Record<string, unknown>) {
  return String(record.id ?? record._id ?? '');
}
