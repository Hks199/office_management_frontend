import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, RefreshCw } from 'lucide-react';
import { useAuth } from '../auth/auth-context';
import { VisitCapture } from './VisitCapture';
import { EvidencePhotos } from '../resources/EvidencePhotos';
import { RecordView, StatusBadge } from '../resources/ResourcePage';
import { EmptyState, ErrorState, Loading } from '../../shared/components/Feedback';
import { Modal } from '../../shared/components/Modal';
import { businessDate, display, recordId } from '../../shared/lib/format';
import { request } from '../../shared/lib/api';
import type { RecordData } from '../../shared/types/api';

export function DailySalesReportsPage() {
  const { user, can } = useAuth();
  const queryClient = useQueryClient();
  const [date, setDate] = useState(businessDate());
  const [page, setPage] = useState(1);
  const [starting, setStarting] = useState(false);
  const [completing, setCompleting] = useState<RecordData | null>(null);
  const [viewing, setViewing] = useState<RecordData | null>(null);
  const [notice, setNotice] = useState('');
  const allowed = can('reports:read', 'leads:read', 'leads:receive_assignment');
  const canSubmit = can('reports:create', 'files:upload');
  const today = businessDate();
  const params = new URLSearchParams({
    employeeId: user?.id ?? '',
    from: date,
    to: date,
    page: String(page),
    limit: '20',
  });
  const reports = useQuery({
    queryKey: ['daily-sales-visits', user?.id, date, page],
    queryFn: ({ signal }) => request<RecordData[]>(`/sales-reports/visits?${params}`, { signal }),
    enabled: allowed && Boolean(date),
    refetchInterval: 60_000,
  });
  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['daily-sales-visits'] }),
      queryClient.invalidateQueries({ queryKey: ['visits'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    ]);
  }
  function saved() {
    setCompleting(null);
    setNotice('Contact visit report submitted. Your manager can now review it.');
    void refresh();
  }
  if (!allowed)
    return (
      <EmptyState
        title="Access restricted"
        description="Daily sales reporting is available to employees assigned to handle sales leads."
      />
    );
  const rows = reports.data?.data ?? [];
  const meta = reports.data?.meta;
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR CONTACT ACTIVITY</span>
          <h1>Daily sales reports</h1>
          <p>
            Record each contact visit, add photos and discussion details, then submit it for review.
          </p>
        </div>
        <div className="heading-actions">
          <button
            className="button secondary"
            disabled={reports.isFetching}
            onClick={() => void refresh()}
          >
            <RefreshCw size={16} />
            Refresh
          </button>
          {canSubmit && (
            <button
              className="button"
              onClick={() => {
                setNotice('');
                setStarting(true);
              }}
            >
              <Plus size={16} />
              New visit report
            </button>
          )}
        </div>
      </div>
      <div className="notice">
        Start a report when you reach the contact. Allow GPS, then add the visit photos, discussion,
        outcome and next follow-up. Complete open reports within 24 hours. Choose an earlier date to
        find previous visits.
      </div>
      {notice && (
        <p className="success-banner" role="status">
          {notice}
        </p>
      )}
      <section className="panel">
        <div className="table-toolbar">
          <label className="field">
            Report date
            <input
              type="date"
              value={date}
              max={today}
              required
              onChange={(event) => {
                if (event.target.value) {
                  setDate(event.target.value);
                  setPage(1);
                }
              }}
            />
          </label>
          <Link className="text-button" to="/leads">
            View my leads
          </Link>
        </div>
        {reports.isPending ? (
          <Loading text="Loading your contact visit reports…" />
        ) : reports.isError ? (
          <ErrorState error={reports.error} retry={() => void reports.refetch()} />
        ) : !rows.length ? (
          <EmptyState
            title="No visit reports for this date"
            description="Use New visit report to record a contact visit. Each contact visit is a separate report."
          />
        ) : (
          <div className="sales-report-list">
            {rows.map((record) => {
              const open = record.status === 'OPEN';
              const started = Date.parse(String(record.visitStartedAt ?? ''));
              const expired =
                open && Number.isFinite(started) && reports.dataUpdatedAt - started > 86400000;
              return (
                <article className="sales-report-card" key={recordId(record)}>
                  <div>
                    <h2>{display(record.customerName)}</h2>
                    <p className="muted">{display(record.siteAddress)}</p>
                    <p className="muted">Started {display(record.visitStartedAt)}</p>
                    <div className="detail-actions">
                      <StatusBadge value={expired ? 'EXPIRED' : record.status} />
                      {record.status === 'SUBMITTED' && <StatusBadge value={record.reviewStatus} />}
                    </div>
                    {record.reviewRemarks ? (
                      <p className="form-note">Manager feedback: {display(record.reviewRemarks)}</p>
                    ) : null}
                    {expired && (
                      <p className="field-hint">
                        The submission window has ended. Start a new visit at the contact site.
                      </p>
                    )}
                  </div>
                  <div className="detail-actions">
                    <button className="button secondary small" onClick={() => setViewing(record)}>
                      View report
                    </button>
                    {open && !expired && canSubmit && (
                      <button className="button small" onClick={() => setCompleting(record)}>
                        Complete report
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
        {meta && meta.totalPages > 1 && (
          <div className="pagination">
            <span>{meta.total} reports</span>
            <div>
              <button
                className="button secondary small"
                disabled={page <= 1 || reports.isFetching}
                onClick={() => setPage(page - 1)}
              >
                Previous page
              </button>
              <span>
                Page {page} of {meta.totalPages}
              </span>
              <button
                className="button secondary small"
                disabled={page >= meta.totalPages || reports.isFetching}
                onClick={() => setPage(page + 1)}
              >
                Next page
              </button>
            </div>
          </div>
        )}
      </section>
      {starting && (
        <VisitCapture
          onClose={() => setStarting(false)}
          onSaved={(record) => {
            setStarting(false);
            setDate(String(record.businessDate ?? today));
            setPage(1);
            setCompleting(record);
            void refresh();
          }}
        />
      )}
      {completing && (
        <VisitCapture
          key={recordId(completing)}
          existing={completing}
          onClose={() => {
            setCompleting(null);
            void refresh();
          }}
          onSaved={saved}
        />
      )}
      {viewing && <VisitDetails record={viewing} onClose={() => setViewing(null)} />}
    </>
  );
}

function VisitDetails({ record, onClose }: { record: RecordData; onClose: () => void }) {
  const detail = useQuery({
    queryKey: ['visits', 'detail', recordId(record)],
    queryFn: ({ signal }) =>
      request<RecordData>(`/sales-reports/visits/${recordId(record)}`, { signal }),
  });
  const value = detail.data?.data ?? record;
  const fields = [
    'businessDate',
    'customerName',
    'customerMobile',
    'siteAddress',
    'visitStartedAt',
    'visitCompletedAt',
    'status',
    'discussionNotes',
    'customerInterest',
    'installationReadiness',
    'visitOutcome',
    'requiredCapacityKw',
    'estimatedProjectValue',
    'nextFollowUpAt',
    'reviewStatus',
    'reviewRemarks',
  ];
  return (
    <Modal title="Contact visit report" onClose={onClose}>
      {detail.isPending ? (
        <Loading />
      ) : detail.isError ? (
        <ErrorState error={detail.error} retry={() => void detail.refetch()} />
      ) : (
        <>
          <RecordView record={Object.fromEntries(fields.map((field) => [field, value[field]]))} />
          <EvidencePhotos record={value} kind="visits" />
        </>
      )}
    </Modal>
  );
}
