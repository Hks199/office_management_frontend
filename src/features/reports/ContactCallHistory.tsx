import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { RecordData } from '../../shared/types/api';
import { request } from '../../shared/lib/api';
import { display, label, recordId } from '../../shared/lib/format';
import { Modal } from '../../shared/components/Modal';
import { EmptyState, ErrorState, Loading } from '../../shared/components/Feedback';

export function ContactCallHistory({
  contactId,
  contactName,
  onClose,
}: {
  contactId: string;
  contactName: string;
  onClose: () => void;
}) {
  const [page, setPage] = useState(1);
  const params = new URLSearchParams({
    customerId: contactId,
    page: String(page),
    limit: '20',
    sortOrder: 'desc',
  });
  const query = useQuery({
    queryKey: ['calls', 'contact-history', contactId, page],
    queryFn: ({ signal }) =>
      request<RecordData[]>(`/telecaller-reports/calls?${params}`, { signal }),
  });
  const rows = query.data?.data ?? [];
  const meta = query.data?.meta;
  return (
    <Modal title={`Call history: ${contactName}`} onClose={onClose}>
      <p className="form-note">
        Each row is a separate recorded call to this contact. Only calls within your authorized
        scope are shown. Times are in India Standard Time; newest reports appear first.
      </p>
      {query.isPending ? (
        <Loading text="Loading contact call history" />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : !rows.length ? (
        <EmptyState
          title="No call history"
          description="No recorded calls to this contact are visible within your access scope."
        />
      ) : (
        <div className="table-scroll">
          <table aria-label="Contact call history">
            <thead>
              <tr>
                {[
                  'Call started',
                  'Call ended',
                  'Duration',
                  'Caller',
                  'Outcome',
                  'Remarks',
                  'Follow-up',
                  'Review status',
                ].map((title) => (
                  <th key={title}>{title}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={recordId(row)}>
                  <td>{display(row.callStartedAt)}</td>
                  <td>{display(row.callEndedAt)}</td>
                  <td>
                    {typeof row.callDurationSeconds === 'number'
                      ? `${Math.floor(row.callDurationSeconds / 60)}m ${row.callDurationSeconds % 60}s`
                      : 'Unavailable'}
                  </td>
                  <td>
                    {typeof row.employeeName === 'string' && row.employeeName
                      ? row.employeeName
                      : 'Caller unavailable'}
                  </td>
                  <td>{label(String(row.callOutcome ?? 'UNKNOWN'))}</td>
                  <td>{display(row.remarks)}</td>
                  <td>{display(row.followUpAt)}</td>
                  <td>{label(String(row.reviewStatus ?? 'PENDING'))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {meta && (
        <div className="table-footer">
          <span>{meta.total} recorded calls</span>
          <div>
            <button
              type="button"
              className="button secondary small"
              disabled={page <= 1 || query.isFetching}
              onClick={() => setPage((previous) => previous - 1)}
            >
              Previous calls
            </button>
            <span>
              Page {page} of {Math.max(1, meta.totalPages)}
            </span>
            <button
              type="button"
              className="button secondary small"
              disabled={page >= meta.totalPages || query.isFetching}
              onClick={() => setPage((previous) => previous + 1)}
            >
              Next calls
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
