import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/auth-context';
import { Modal } from '../../shared/components/Modal';
import { ErrorState, Loading } from '../../shared/components/Feedback';
import { request } from '../../shared/lib/api';
import { validationMessage } from '../administration/contracts';

import { officeSettingsPayload } from './office-settings';

export interface OfficeSettingsData {
  configured?: boolean;
  revision: number;
  startMinute?: number;
  endMinute?: number;
  graceMinutes?: number;
  workingWeekdays?: number[];
  holidays?: string[];
}
export function OfficeSettings({ onClose }: { onClose: () => void }) {
  const { user, can } = useAuth();
  const allowed = Boolean(
    user?.canManageAttendanceSettings && !user.employeePanel && can('settings:manage'),
  );
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState('');
  const [reloadVersion, setReloadVersion] = useState(0);
  const query = useQuery({
    queryKey: ['attendance', 'office-settings'],
    queryFn: ({ signal }) => request<OfficeSettingsData>('/attendance/settings', { signal }),
    enabled: allowed,
  });
  return (
    <Modal title="Office timings & holidays" onClose={onClose}>
      {notice && (
        <p className="success-banner" role="status">
          {notice}
        </p>
      )}
      {!allowed ? (
        <p>Only the MD can manage office timings and holidays.</p>
      ) : query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          <OfficeSettingsEditor
            key={`${query.data.data.revision}-${reloadVersion}`}
            settings={query.data.data}
            onSaved={async () => {
              await queryClient.invalidateQueries();
              setNotice('Office settings saved.');
            }}
          />
          <button
            type="button"
            className="text-button"
            disabled={query.isFetching}
            onClick={() =>
              void query.refetch().then(() => setReloadVersion((version) => version + 1))
            }
          >
            Reload saved settings
          </button>
        </>
      )}
    </Modal>
  );
}
function OfficeSettingsEditor({
  settings,
  onSaved,
}: {
  settings: OfficeSettingsData;
  onSaved: () => Promise<void>;
}) {
  const time = (value?: number) =>
    value == null
      ? ''
      : `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
  const [start, setStart] = useState(time(settings.startMinute));
  const [end, setEnd] = useState(time(settings.endMinute));
  const [grace, setGrace] = useState(settings.graceMinutes ?? 0);
  const [days, setDays] = useState(settings.workingWeekdays ?? [1, 2, 3, 4, 5, 6]);
  const [holidays, setHolidays] = useState(settings.holidays ?? []);
  const [holiday, setHoliday] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (holiday)
        throw new Error('Click Add holiday for the selected date, or clear it before saving.');
      await request('/attendance/settings', {
        method: 'PUT',
        body: officeSettingsPayload(settings.revision, start, end, grace, days, holidays),
      });
      await onSaved();
    } catch (cause) {
      setError(validationMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="admin-form" onSubmit={(event) => void submit(event)}>
      <p className="form-note">
        All times use Asia/Kolkata. These are office-wide defaults, including employees without a
        branch. Existing branch timings and working weekdays override defaults; office holidays
        apply to every branch. <Link to="/branches">Manage branch overrides</Link>.
      </p>
      {settings.configured === false && (
        <p className="notice">
          Set your office schedule to enable absence calculations for employees without branch
          settings.
        </p>
      )}
      <fieldset disabled={busy} className="form-grid">
        <label className="field">
          Office starts
          <input
            type="time"
            required
            value={start}
            onChange={(event) => setStart(event.target.value)}
          />
        </label>
        <label className="field">
          Office ends
          <input
            type="time"
            required
            value={end}
            onChange={(event) => setEnd(event.target.value)}
          />
        </label>
        <label className="field">
          Grace period (minutes)
          <input
            type="number"
            min={0}
            max={120}
            required
            value={grace}
            onChange={(event) => setGrace(Number(event.target.value))}
          />
        </label>
      </fieldset>
      <fieldset className="calendar-weekdays" disabled={busy}>
        <legend>Working days</legend>
        {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(
          (day, index) => (
            <label className="checkbox-label" key={day}>
              <input
                type="checkbox"
                checked={days.includes(index + 1)}
                onChange={(event) =>
                  setDays(
                    event.target.checked
                      ? [...days, index + 1].sort((a, b) => a - b)
                      : days.filter((value) => value !== index + 1),
                  )
                }
              />
              {day}
            </label>
          ),
        )}
      </fieldset>
      <div className="field">
        <label htmlFor="office-holiday">Holiday date</label>
        <div className="attendance-presets">
          <input
            id="office-holiday"
            type="date"
            disabled={busy}
            value={holiday}
            onChange={(event) => setHoliday(event.target.value)}
          />
          <button
            type="button"
            className="button secondary small"
            disabled={busy || !holiday || holidays.length >= 366}
            onClick={() => {
              setHolidays([...new Set([...holidays, holiday])].sort());
              setHoliday('');
            }}
          >
            Add holiday
          </button>
        </div>
      </div>
      <ul className="office-holiday-list">
        {holidays.map((day) => (
          <li key={day}>
            <span>{day}</span>
            <button
              type="button"
              className="text-button"
              aria-label={`Remove holiday ${day}`}
              disabled={busy}
              onClick={() => setHolidays(holidays.filter((value) => value !== day))}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      {!holidays.length && <p className="muted">No office holidays added.</p>}
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      <p className="form-note">
        Absence is provisional until the day ends. It means no recorded check-in after start time
        plus grace, rather than an approved payroll absence. Schedule changes affect new check-ins
        and today’s calculation; existing attendance snapshots are preserved.
      </p>
      <div className="modal-actions">
        <button className="button" disabled={busy}>
          {busy ? 'Saving…' : 'Save office settings'}
        </button>
      </div>
    </form>
  );
}
