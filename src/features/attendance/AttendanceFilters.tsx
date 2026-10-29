import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth/auth-context';
import { FormField } from '../../shared/components/DynamicForm';
import type { Field } from '../resources/config';
import type { RecordData } from '../../shared/types/api';
import { attendanceRange, attendanceRangeError } from './supervision';

export function AttendanceFilters({
  value,
  onApply,
}: {
  value: RecordData;
  onApply: (filters: RecordData) => void;
}) {
  const { can } = useAuth();
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState('');
  const fields: Field[] = [
    { name: 'from', label: 'From date', type: 'date', required: true },
    { name: 'to', label: 'To date', type: 'date', required: true },
    ...(can('branches:read') ? [{ name: 'branchId', label: 'Branch', lookup: '/branches' }] : []),
    ...(can('users:read')
      ? [
          {
            name: 'employeeId',
            label: 'Employee',
            lookup: '/employees',
            hint: 'Search by name or employee code.',
          },
          {
            name: 'managerId',
            label: 'Reporting manager',
            lookup: '/employees',
            hint: 'Includes all reporting levels under this employee, within your access.',
          },
        ]
      : []),
    ...(can('roles:read') ? [{ name: 'roleId', label: 'Employee role', lookup: '/roles' }] : []),
  ];
  function submit(event: FormEvent) {
    event.preventDefault();
    const message = attendanceRangeError(draft);
    setError(message);
    if (!message) onApply(draft);
  }
  return (
    <form className="attendance-filters" onSubmit={submit}>
      <div className="attendance-presets" aria-label="Attendance date shortcuts">
        {['today', 'yesterday', 'week', 'month'].map((preset) => (
          <button
            className="button secondary small"
            type="button"
            key={preset}
            onClick={() => {
              const next = { ...draft, ...attendanceRange(preset) };
              setDraft(next);
              setError('');
              onApply(next);
            }}
          >
            {
              { today: 'Today', yesterday: 'Yesterday', week: 'This week', month: 'This month' }[
                preset
              ]
            }
          </button>
        ))}
      </div>
      <div className="attendance-filter-grid">
        {fields.map((field) => (
          <FormField
            key={field.name}
            field={field}
            value={draft[field.name]}
            values={draft}
            onChange={(next) => setDraft({ ...draft, [field.name]: next })}
          />
        ))}
        <label className="form-field">
          Attendance status
          <select
            value={String(draft.status ?? '')}
            onChange={(e) => setDraft({ ...draft, status: e.target.value })}
          >
            <option value="">All recorded attendance</option>
            <option value="OPEN">Awaiting checkout</option>
            <option value="COMPLETED">Checked out</option>
          </select>
        </label>
        <FormField
          field={{
            name: 'reviewStatus',
            label: 'Photo / attendance review',
            type: 'select',
            options: ['PENDING', 'APPROVED', 'REJECTED'],
          }}
          value={draft.reviewStatus}
          values={draft}
          onChange={(next) => setDraft({ ...draft, reviewStatus: next })}
        />
        <label className="form-field">
          Punctuality
          <select
            value={
              draft.lateArrival === 'true' ? 'late' : draft.earlyExit === 'true' ? 'early' : ''
            }
            onChange={(e) =>
              setDraft({
                ...draft,
                lateArrival: e.target.value === 'late' ? 'true' : '',
                earlyExit: e.target.value === 'early' ? 'true' : '',
              })
            }
          >
            <option value="">All arrivals and exits</option>
            <option value="late">Late arrivals</option>
            <option value="early">Early exits</option>
          </select>
        </label>
        <label className="form-field">
          Location evidence
          <select
            value={String(draft.outsideGeofence ?? '')}
            onChange={(e) => setDraft({ ...draft, outsideGeofence: e.target.value })}
          >
            <option value="">All locations</option>
            <option value="true">Outside configured geofence</option>
          </select>
        </label>
      </div>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      <div className="attendance-filter-actions">
        <button className="button small" type="submit">
          Apply filters
        </button>
        <button
          className="button ghost small"
          type="button"
          onClick={() => {
            const next = attendanceRange();
            setDraft(next);
            setError('');
            onApply(next);
          }}
        >
          Reset to today
        </button>
        <span className="muted">
          Applied dates: {String(value.from)} to {String(value.to)} · IST
        </span>
      </div>
    </form>
  );
}
