import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/auth-context';
import { request, errorMessage } from '../../shared/lib/api';
import type { RecordData } from '../../shared/types/api';
import { OfficeSettings } from './OfficeSettings';
interface Workforce {
  date: string;
  totalEmployees: number;
  activeEmployees: number;
  onLeave: number;
  inactiveEmployees: number;
  notRequired: number;
  present: number;
  absent: number;
  notDue: number;
  nonWorkingDay: number;
  notConfigured: number;
}
export function WorkforceOverview({ filters }: { filters: RecordData }) {
  const { user, can } = useAuth();
  const [settings, setSettings] = useState(false);
  const params = new URLSearchParams();
  ['branchId', 'employeeId', 'managerId', 'roleId'].forEach((key) => {
    if (filters[key]) params.set(key, String(filters[key]));
  });
  const query = useQuery({
    queryKey: ['attendance', 'workforce', params.toString()],
    queryFn: ({ signal }) => request<Workforce>(`/attendance/workforce?${params}`, { signal }),
    refetchInterval: 60000,
  });
  const md = Boolean(
    user?.canManageAttendanceSettings && !user.employeePanel && can('settings:manage'),
  );
  const data = query.data?.data;
  return (
    <section className="attendance-workforce" aria-label="Today's employee attendance">
      <div className="attendance-overview-heading">
        <div>
          <h2>Today’s workforce</h2>
          <p className="muted">
            {data?.date ?? 'Today'} · IST · Selected team within your access. These figures always
            refer to today.
          </p>
        </div>
        {md && (
          <button
            type="button"
            className="button secondary small"
            onClick={() => setSettings(true)}
          >
            Office timings & holidays
          </button>
        )}
      </div>
      {query.isError ? (
        <p className="inline-error" role="alert">
          {errorMessage(query.error)}{' '}
          <button type="button" className="text-button" onClick={() => void query.refetch()}>
            Retry employee counts
          </button>
        </p>
      ) : (
        <div className="attendance-summary-grid" aria-busy={query.isFetching}>
          {(
            [
              ['Total employees', data?.totalEmployees],
              ['Active employees', data?.activeEmployees],
              ['Checked in today', data?.present],
              ['Absent / no check-in', data?.absent],
              ['On leave', data?.onLeave],
              ['Weekly off / holiday', data?.nonWorkingDay],
            ] as const
          ).map(([name, count]) => (
            <div
              key={name}
              className={`attendance-summary-card${name === 'Absent / no check-in' ? ' attendance-absence-card' : ''}`}
            >
              <span>{name}</span>
              <strong>{count == null ? '…' : count.toLocaleString('en-IN')}</strong>
              {name === 'Absent / no check-in' && Boolean(data?.notConfigured) && (
                <small>Partial count; schedule setup needed</small>
              )}
            </div>
          ))}
        </div>
      )}
      {data && (
        <>
          <p className="form-note">
            {data.notDue} not due to check in yet · {data.notRequired} not required to mark
            attendance · {data.inactiveEmployees} inactive or exited. Absence excludes recorded
            leave, holidays and weekly offs and remains provisional during the day.
          </p>
          {data.notConfigured > 0 && (
            <p className="notice" role="status">
              {data.notConfigured} employee(s) have no complete working schedule. Their absence
              cannot be calculated yet.
              {md
                ? ' Open Office timings & holidays to configure defaults.'
                : ' Ask the MD to configure office timings and working days.'}
            </p>
          )}
        </>
      )}
      {settings && <OfficeSettings onClose={() => setSettings(false)} />}
    </section>
  );
}
