import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/auth-context';
import { Modal } from '../../shared/components/Modal';
import { ErrorState, Loading } from '../../shared/components/Feedback';
import { request } from '../../shared/lib/api';
import type { RecordData } from '../../shared/types/api';
import { attendancePolicyPayload, calendarPayload, validationMessage } from './contracts';
interface Policy {
  startMinute: number | null;
  endMinute: number | null;
  graceMinutes: number;
  maxAccuracyMeters: number;
  maxCaptureAgeSeconds: number;
  geofence: null | { latitude: number; longitude: number; radiusMeters: number };
}
const defaults: Policy = {
  startMinute: null,
  endMinute: null,
  graceMinutes: 0,
  maxAccuracyMeters: 100,
  maxCaptureAgeSeconds: 300,
  geofence: null,
};
interface Calendar {
  revision?: number;
  configured?: boolean;
  workingWeekdays?: number[];
  holidays?: string[];
}
export function BranchConfiguration({ id, onClose }: { id: string; onClose: () => void }) {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const allowPolicy = can('branches:update');
  const allowCalendar = can('dashboard:read', 'branches:read');
  const [tab, setTab] = useState(allowPolicy ? 'policy' : 'calendar');
  const [success, setSuccess] = useState('');
  const branch = useQuery({
    queryKey: ['branches', 'detail', id],
    queryFn: ({ signal }) => request<RecordData>(`/branches/${id}`, { signal }),
    enabled: allowPolicy && tab === 'policy',
  });
  const calendar = useQuery({
    queryKey: ['branch-calendar', id],
    queryFn: ({ signal }) => request<Calendar>(`/dashboard/attendance-calendars/${id}`, { signal }),
    enabled: allowCalendar && tab === 'calendar',
  });
  async function saved() {
    setSuccess('Branch configuration saved.');
    await queryClient.invalidateQueries();
  }
  return (
    <Modal title="Branch attendance settings" onClose={onClose}>
      <div className="tabs">
        {allowPolicy && (
          <button
            className={tab === 'policy' ? 'active' : ''}
            onClick={() => {
              setTab('policy');
              setSuccess('');
            }}
          >
            Attendance policy
          </button>
        )}
        {allowCalendar && (
          <button
            className={tab === 'calendar' ? 'active' : ''}
            onClick={() => {
              setTab('calendar');
              setSuccess('');
            }}
          >
            Working calendar
          </button>
        )}
      </div>
      {success && (
        <p className="success-banner" role="status">
          {success}
        </p>
      )}
      {tab === 'policy' ? (
        branch.isPending ? (
          <Loading />
        ) : branch.isError ? (
          <ErrorState error={branch.error} retry={() => void branch.refetch()} />
        ) : (
          <PolicyEditor
            key={String(branch.data.data.revision)}
            id={id}
            revision={Number(branch.data.data.revision)}
            policy={{ ...defaults, ...(branch.data.data.attendancePolicy as Partial<Policy>) }}
            onSaved={saved}
          />
        )
      ) : calendar.isPending ? (
        <Loading />
      ) : calendar.isError ? (
        <ErrorState error={calendar.error} retry={() => void calendar.refetch()} />
      ) : (
        <CalendarEditor
          key={calendar.data.data.revision ?? 0}
          id={id}
          calendar={calendar.data.data}
          editable={can('settings:manage')}
          onSaved={saved}
        />
      )}
    </Modal>
  );
}
function PolicyEditor({
  id,
  revision,
  policy,
  onSaved,
}: {
  id: string;
  revision: number;
  policy: Policy;
  onSaved: () => Promise<void>;
}) {
  const time = (value: number | null) =>
    value === null
      ? ''
      : `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
  const [fenced, setFenced] = useState(Boolean(policy.geofence));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const number = (name: string) => Number(form.get(name));
    setBusy(true);
    setError('');
    try {
      const body = attendancePolicyPayload(revision, {
        start: String(form.get('start') ?? ''),
        end: String(form.get('end') ?? ''),
        graceMinutes: number('graceMinutes'),
        maxAccuracyMeters: number('maxAccuracyMeters'),
        maxCaptureAgeSeconds: number('maxCaptureAgeSeconds'),
        geofence: fenced
          ? {
              latitude: number('latitude'),
              longitude: number('longitude'),
              radiusMeters: number('radiusMeters'),
            }
          : null,
      });
      await request(`/branches/${id}`, { method: 'PATCH', body });
      await onSaved();
    } catch (err) {
      setError(validationMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="admin-form" onSubmit={(event) => void submit(event)}>
      <p className="form-note">
        Working times use Asia/Kolkata. Leave both empty to disable schedule flags. Changes apply to
        subsequent attendance evaluations.
      </p>
      <fieldset disabled={busy} className="form-grid">
        <label className="field">
          Work starts
          <input type="time" name="start" defaultValue={time(policy.startMinute)} />
        </label>
        <label className="field">
          Work ends
          <input type="time" name="end" defaultValue={time(policy.endMinute)} />
        </label>
        <label className="field">
          Grace period (minutes)
          <input
            type="number"
            name="graceMinutes"
            min={0}
            max={120}
            required
            defaultValue={policy.graceMinutes}
          />
        </label>
        <label className="field">
          Maximum GPS uncertainty (metres)
          <input
            type="number"
            name="maxAccuracyMeters"
            min={1}
            max={10000}
            step="any"
            required
            defaultValue={policy.maxAccuracyMeters}
          />
        </label>
        <label className="field">
          Maximum capture age (seconds)
          <input
            type="number"
            name="maxCaptureAgeSeconds"
            min={30}
            max={900}
            required
            defaultValue={policy.maxCaptureAgeSeconds}
          />
        </label>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={fenced}
            onChange={(event) => setFenced(event.target.checked)}
          />
          Use a branch geofence
        </label>
        {fenced && (
          <>
            <label className="field">
              Latitude
              <input
                type="number"
                name="latitude"
                min={-90}
                max={90}
                step="any"
                required
                defaultValue={policy.geofence?.latitude}
              />
            </label>
            <label className="field">
              Longitude
              <input
                type="number"
                name="longitude"
                min={-180}
                max={180}
                step="any"
                required
                defaultValue={policy.geofence?.longitude}
              />
            </label>
            <label className="field">
              Geofence radius (metres)
              <input
                type="number"
                name="radiusMeters"
                min={10}
                max={100000}
                step="any"
                required
                defaultValue={policy.geofence?.radiusMeters}
              />
            </label>
          </>
        )}
      </fieldset>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      <div className="modal-actions">
        <button className="button" disabled={busy}>
          {busy ? 'Saving…' : 'Save attendance policy'}
        </button>
      </div>
    </form>
  );
}
function CalendarEditor({
  id,
  calendar,
  editable,
  onSaved,
}: {
  id: string;
  calendar: Calendar;
  editable: boolean;
  onSaved: () => Promise<void>;
}) {
  const [weekdays, setWeekdays] = useState<number[]>(calendar.workingWeekdays ?? []);
  const [holidays, setHolidays] = useState((calendar.holidays ?? []).join('\n'));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const body = calendarPayload(
        calendar.revision ?? 0,
        weekdays,
        holidays
          .split(/\r?\n/)
          .map((value) => value.trim())
          .filter(Boolean),
      );
      await request(`/dashboard/attendance-calendars/${id}`, { method: 'PUT', body });
      await onSaved();
    } catch (err) {
      setError(validationMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="admin-form" onSubmit={(event) => void submit(event)}>
      {calendar.configured === false && (
        <p className="notice">
          This branch has no working calendar. Configure it to calculate missing-check-in totals.
          These totals remain provisional and are not verified absence.
        </p>
      )}
      <p className="form-note">
        Select working weekdays and exceptions in Asia/Kolkata. Updating the calendar uses its own
        revision, independently of the branch profile.
      </p>
      <fieldset disabled={busy || !editable} className="calendar-weekdays">
        <legend>Working days</legend>
        {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(
          (day, index) => (
            <label key={day} className="checkbox-label">
              <input
                type="checkbox"
                checked={weekdays.includes(index + 1)}
                onChange={(event) =>
                  setWeekdays(
                    event.target.checked
                      ? [...weekdays, index + 1].sort((a, b) => a - b)
                      : weekdays.filter((value) => value !== index + 1),
                  )
                }
              />
              {day}
            </label>
          ),
        )}
      </fieldset>
      <label className="field">
        Holidays (one date per line)
        <textarea
          aria-label="Holidays"
          rows={6}
          placeholder="YYYY-MM-DD"
          value={holidays}
          disabled={busy || !editable}
          onChange={(event) => setHolidays(event.target.value)}
        />
      </label>
      {error && (
        <p role="alert" className="inline-error">
          {error}
        </p>
      )}
      {editable ? (
        <div className="modal-actions">
          <button className="button" disabled={busy}>
            {busy ? 'Saving…' : 'Save working calendar'}
          </button>
        </div>
      ) : (
        <p className="form-note">Settings-management access is required to edit this calendar.</p>
      )}
    </form>
  );
}
