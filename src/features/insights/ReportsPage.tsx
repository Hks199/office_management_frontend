import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { useAuth } from '../auth/auth-context';
import { reportDefinitions, type ReportDefinition } from './report-definitions';
import { FormField } from '../../shared/components/DynamicForm';
import { buildPayload } from '../../shared/components/form-schema';
import { EmptyState, ErrorState, Loading } from '../../shared/components/Feedback';
import { ResultView } from '../../shared/components/ResultView';
import { request, errorMessage } from '../../shared/lib/api';
import { businessDate } from '../../shared/lib/format';
import type { RecordData } from '../../shared/types/api';
import { ExportDialog } from '../exports/ExportDialog';

export function ReportsPage() {
  const { can } = useAuth();
  const available = reportDefinitions.filter((definition) => can(...definition.permissions));
  const [key, setKey] = useState('daily-calls');
  const definition = available.find((item) => item.key === key) ?? available[0];
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">REPORTING</span>
          <h1>Reports & insights</h1>
          <p>Explore daily activity, attendance and verified performance within your scope.</p>
        </div>
      </div>
      {!definition ? (
        <EmptyState
          title="Access restricted"
          description="Your role needs reporting, attendance, target or dashboard access."
        />
      ) : (
        <>
          <label className="field report-selector">
            Report
            <select value={definition.key} onChange={(event) => setKey(event.target.value)}>
              {available.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.title}
                </option>
              ))}
            </select>
          </label>
          <ReportExplorer key={definition.key} definition={definition} />
        </>
      )}
    </>
  );
}
function ReportExplorer({ definition }: { definition: ReportDefinition }) {
  const { can } = useAuth();
  const today = businessDate();
  const initial =
    definition.shape === 'dashboard'
      ? {
          startDate: `${today.slice(0, 7)}-01`,
          endDate: new Date(Date.parse(`${today}T00:00:00Z`) + 86400000).toISOString().slice(0, 10),
        }
      : {};
  const [values, setValues] = useState<RecordData>(initial);
  const [applied, setApplied] = useState<RecordData>(initial);
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const lookupPermission: Record<string, string> = {
    '/employees': 'users:read',
    '/branches': 'branches:read',
    '/roles': 'roles:read',
  };
  const fields = definition.fields.filter(
    (field) => !field.lookup || can(lookupPermission[field.lookup] ?? ''),
  );
  const ready = fields.every((field) => !field.required || Boolean(applied[field.name]));
  let endpoint = definition.endpoint;
  const params = new URLSearchParams();
  Object.entries(applied).forEach(([name, value]) => {
    if (value !== '' && value !== undefined && value !== null) params.set(name, String(value));
  });
  if (['employee-attendance', 'branch-attendance'].includes(definition.key)) {
    const name = definition.key === 'employee-attendance' ? 'employeeId' : 'branchId';
    endpoint += `/${encodeURIComponent(String(applied[name] ?? ''))}`;
    params.delete(name);
  }
  if (definition.paginated) {
    params.set('page', String(page));
    params.set('limit', '20');
  }
  const query = useQuery({
    queryKey: ['report', definition.key, params.toString(), endpoint],
    queryFn: ({ signal }) => request<unknown>(`${endpoint}?${params}`, { signal }),
    enabled: ready,
  });
  let data: unknown = query.data?.data;
  if (definition.shape && data && typeof data === 'object')
    data = (data as RecordData)[definition.shape === 'dashboard' ? 'data' : definition.shape];
  const body = data && typeof data === 'object' && !Array.isArray(data) ? (data as RecordData) : {};
  const pages =
    query.data?.meta?.totalPages ??
    (typeof body.total === 'number' ? Math.ceil(body.total / 20) : 1);
  function apply(event: FormEvent) {
    event.preventDefault();
    try {
      const payload = buildPayload(fields, values);
      if (
        typeof payload.from === 'string' &&
        typeof payload.to === 'string' &&
        payload.from > payload.to
      )
        throw new Error('The end date cannot precede the start date.');
      if (
        definition.shape === 'dashboard' &&
        (Date.parse(String(payload.endDate)) - Date.parse(String(payload.startDate))) / 86400000 >
          366
      )
        throw new Error('Choose a period of 366 days or less.');
      setApplied(payload);
      setPage(1);
      setError('');
    } catch (err) {
      setError(errorMessage(err));
    }
  }
  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>{definition.title}</h2>
        {definition.dashboardKind && can('dashboard:export') && (
          <button
            className="button secondary small"
            disabled={!ready}
            onClick={() => setExporting(true)}
          >
            <Download size={15} />
            Export
          </button>
        )}
      </div>
      <form onSubmit={apply} className="report-filters">
        <div className="form-grid">
          {fields.map((field) => (
            <FormField
              key={field.name}
              field={field}
              value={values[field.name]}
              values={values}
              onChange={(value) => setValues((previous) => ({ ...previous, [field.name]: value }))}
            />
          ))}
        </div>
        {error && (
          <p className="inline-error" role="alert">
            {error}
          </p>
        )}
        <button className="button" type="submit">
          Run report
        </button>
      </form>
      {!ready ? (
        <EmptyState title="Choose report filters" />
      ) : query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <div className="report-results">
          <ResultView data={data} />
          {query.data?.data && typeof query.data.data === 'object' && 'asOf' in query.data.data ? (
            <p className="form-note">
              Verified progress is scoped to your current access. Submitted and approved activity
              remain separate.
            </p>
          ) : null}
        </div>
      )}
      {definition.paginated && ready && query.isSuccess && (
        <div className="table-footer">
          <span>
            Page {page} of {Math.max(1, pages)}
          </span>
          <div>
            <button
              className="button secondary small"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </button>
            <button
              className="button secondary small"
              disabled={page >= pages}
              onClick={() => setPage(page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}
      {exporting && (
        <ExportDialog
          kind="dashboard"
          dashboardKind={definition.dashboardKind}
          query={applied}
          onClose={() => setExporting(false)}
        />
      )}
    </section>
  );
}
