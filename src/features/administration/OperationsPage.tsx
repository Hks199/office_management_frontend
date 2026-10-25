import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/auth-context';
import { request } from '../../shared/lib/api';
import { EmptyState, ErrorState, Loading } from '../../shared/components/Feedback';
import { ResultView } from '../../shared/components/ResultView';
export function OperationsPage() {
  const { can } = useAuth();
  const allowed = can('settings:manage');
  const query = useQuery({
    queryKey: ['operations'],
    queryFn: ({ signal }) => request('/operations/metrics', { signal }),
    enabled: allowed,
  });
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">ADMINISTRATION</span>
          <h1>Operations</h1>
          <p>Observed HTTP activity, database events and background job queues.</p>
        </div>
        <button
          className="button secondary"
          disabled={!allowed || query.isFetching}
          onClick={() => void query.refetch()}
        >
          Refresh metrics
        </button>
      </div>
      {!allowed ? (
        <EmptyState title="Access restricted" />
      ) : query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <section className="panel report-results">
          <p className="form-note">
            These are process-observed events and queue snapshots, rather than a synchronized
            system-wide audit.
          </p>
          <ResultView data={query.data.data} />
        </section>
      )}
    </>
  );
}
