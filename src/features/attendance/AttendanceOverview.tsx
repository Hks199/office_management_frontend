import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { request, errorMessage } from '../../shared/lib/api';
import type { RecordData } from '../../shared/types/api';
import {
  applyReferences,
  collectReferences,
  type DisplayReference,
} from '../../shared/lib/display-references';
import { attendanceCsv } from './supervision';

const statusFields = ['status', 'reviewStatus', 'lateArrival', 'earlyExit', 'outsideGeofence'];
export function AttendanceOverview({
  filters,
  onApply,
}: {
  filters: RecordData;
  onApply: (filters: RecordData) => void;
}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (!statusFields.includes(key) && value !== '' && value != null)
      params.set(key, String(value));
  });
  const query = useQuery({
    queryKey: ['attendance', 'overview', params.toString()],
    queryFn: ({ signal }) =>
      request<{ days: RecordData[] }>(`/attendance/summary?${params}`, { signal }),
  });
  const total = (key: string) =>
    (query.data?.data.days ?? []).reduce((sum, day) => sum + Number(day[key] ?? 0), 0);
  const cards = [
    { label: 'Attendance records', count: total('records'), field: '', value: '' },
    {
      label: 'Awaiting checkout',
      count: total('records') - total('completed'),
      field: 'status',
      value: 'OPEN',
    },
    { label: 'Checked out', count: total('completed'), field: 'status', value: 'COMPLETED' },
    { label: 'Late arrivals', count: total('lateArrivals'), field: 'lateArrival', value: 'true' },
    {
      label: 'Pending review',
      count: total('pendingReview'),
      field: 'reviewStatus',
      value: 'PENDING',
    },
    { label: 'Early exits', count: total('earlyExits'), field: 'earlyExit', value: 'true' },
  ];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function exportCsv() {
    setBusy(true);
    setError('');
    const abort = new AbortController();
    controller.current = abort;
    const exportParams = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== '' && value != null) exportParams.set(key, String(value));
    });
    exportParams.set('limit', '100');
    exportParams.set('sortOrder', 'asc');
    try {
      const records: RecordData[] = [];
      let expectedTotal = -1;
      let pages = 1;
      for (let page = 1; page <= pages; page++) {
        exportParams.set('page', String(page));
        const result = await request<RecordData[]>(`/attendance?${exportParams}`, {
          signal: abort.signal,
        });
        if (!result.meta)
          throw new Error('Attendance pagination is unavailable. Please refresh and try again.');
        if (result.meta.total > 10000)
          throw new Error('Choose a smaller date range or team to export at most 10,000 records.');
        if (expectedTotal >= 0 && result.meta.total !== expectedTotal)
          throw new Error('Attendance changed during export. Please retry.');
        expectedTotal = result.meta.total;
        pages = result.meta.totalPages;
        records.push(...result.data);
      }
      if (
        records.length !== expectedTotal ||
        new Set(records.map((row) => String(row._id))).size !== expectedTotal
      )
        throw new Error('Attendance changed during export. Please retry.');
      if (!records.length) throw new Error('No attendance records match the applied filters.');
      const references = collectReferences(records);
      const labels: DisplayReference[] = [];
      for (let offset = 0; offset < references.length; offset += 100) {
        const result = await request<DisplayReference[]>('/display-references', {
          method: 'POST',
          signal: abort.signal,
          body: { references: references.slice(offset, offset + 100) },
        });
        labels.push(...result.data);
      }
      abort.signal.throwIfAborted();
      const url = URL.createObjectURL(
        new Blob([attendanceCsv(applyReferences(records, labels))], {
          type: 'text/csv;charset=utf-8',
        }),
      );
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `attendance-${String(filters.from)}-to-${String(filters.to)}.csv`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) {
      if (!abort.signal.aborted)
        setError(
          cause instanceof Error && !(cause instanceof TypeError)
            ? cause.message
            : errorMessage(cause),
        );
    } finally {
      if (!abort.signal.aborted) setBusy(false);
    }
  }
  return (
    <section className="attendance-overview" aria-label="Attendance overview">
      <div className="attendance-overview-heading">
        <div>
          <h2>Team attendance overview</h2>
          <p className="muted">
            Counts for the selected dates and team, before status filters. Each record is one
            employee’s day.
          </p>
        </div>
        <button className="button secondary small" disabled={busy} onClick={() => void exportCsv()}>
          <Download size={16} />
          {busy ? 'Preparing export…' : 'Export filtered CSV'}
        </button>
      </div>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      {query.isError ? (
        <p className="inline-error" role="alert">
          {errorMessage(query.error)}{' '}
          <button type="button" className="text-button" onClick={() => void query.refetch()}>
            Retry overview
          </button>
        </p>
      ) : (
        <div className="attendance-summary-grid" aria-busy={query.isFetching}>
          {cards.map((card) => (
            <button
              type="button"
              key={card.label}
              className="attendance-summary-card"
              disabled={query.isPending}
              aria-pressed={
                card.field
                  ? filters[card.field] === card.value
                  : statusFields.every((key) => !filters[key])
              }
              onClick={() => {
                const next = { ...filters };
                statusFields.forEach((key) => delete next[key]);
                if (card.field) next[card.field] = card.value;
                onApply(next);
              }}
            >
              <span>{card.label}</span>
              <strong>{query.isPending ? '…' : card.count.toLocaleString('en-IN')}</strong>
            </button>
          ))}
        </div>
      )}
      <p className="form-note">
        Late and early flags use the attendance policy recorded at check-in. Location warnings
        require a configured geofence. Open records are awaiting checkout; they are not
        automatically marked absent.
      </p>
    </section>
  );
}
