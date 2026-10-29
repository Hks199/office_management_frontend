import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDownUp,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Download,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../auth/auth-context';
import type { Action, ResourceConfig } from './config';
import type { RecordData } from '../../shared/types/api';
import { request } from '../../shared/lib/api';
import { display, label, recordId } from '../../shared/lib/format';
import {
  recordDisplayFields,
  recordFieldLabel,
  recordFieldValue,
} from '../../shared/lib/record-display';
import { EmptyState, ErrorState, Loading } from '../../shared/components/Feedback';
import { Modal } from '../../shared/components/Modal';
import { DynamicForm, FormField } from '../../shared/components/DynamicForm';
import { AttendanceCapture } from '../attendance/AttendanceCapture';
import { AttendanceFilters } from '../attendance/AttendanceFilters';
import { AttendanceOverview } from '../attendance/AttendanceOverview';
import { attendanceRange, workedTime } from '../attendance/supervision';
import { ImportUpload } from '../uploads/ImportUpload';
import { ImportAssignment } from '../uploads/ImportAssignment';
import { importFailureMessage } from '../uploads/import-status';
import { ImportRowsPreview } from '../uploads/ImportRowsPreview';
import { VisitCapture } from '../reports/VisitCapture';
import { ExportDialog } from '../exports/ExportDialog';
import { BranchConfiguration } from '../administration/BranchConfiguration';
import { BranchBdoAssignment } from '../administration/BranchBdoAssignment';
import { EvidencePhotos } from './EvidencePhotos';
import { ProposalReview } from './ProposalReview';
import { ContactCallHistory } from '../reports/ContactCallHistory';
import { useDisplayRecords } from '../../shared/lib/use-display-records';
import { OpenEmployeePanel } from '../employees/OpenEmployeePanel';

function isBadge(key: string, value: unknown) {
  return (
    key.toLowerCase().includes('status') || typeof value === 'boolean' || key === 'callOutcome'
  );
}
export function StatusBadge({ value }: { value: unknown }) {
  const status = String(value);
  const tone = [
    'true',
    'ACTIVE',
    'APPROVED',
    'COMPLETED',
    'CONVERTED',
    'CONNECTED',
    'CONFIRMED',
  ].includes(status)
    ? 'green'
    : ['false', 'REJECTED', 'CANCELLED', 'EXITED', 'FAILED', 'LOST'].includes(status)
      ? 'red'
      : 'amber';
  return (
    <span className={`badge ${tone}`}>
      <span />
      {typeof value === 'boolean' ? (value ? 'Active' : 'Inactive') : label(status)}
    </span>
  );
}
export function ResourcePage({ config }: { config: ResourceConfig }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { can, user } = useAuth();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  const [filters, setFilters] = useState<RecordData>({});
  const [activeFilters, setActiveFilters] = useState<RecordData>(() =>
    config.slug === 'attendance' ? attendanceRange() : {},
  );
  const [sortOrder, setSortOrder] = useState('desc');
  const [creating, setCreating] = useState(false);
  const [special, setSpecial] = useState(false);
  const [selected, setSelected] = useState<RecordData | null>(() => {
    const id = searchParams.get('record');
    return id && /^[a-f0-9]{24}$/i.test(id) ? { _id: id } : null;
  });
  const [notice, setNotice] = useState('');
  const [exporting, setExporting] = useState(false);
  const [batch, setBatch] = useState<Record<string, number>>({});
  const [assigning, setAssigning] = useState(false);
  const [callHistory, setCallHistory] = useState<RecordData | null>(null);
  const allowBatch = config.slug === 'contacts' && can('customers:assign');
  const params = new URLSearchParams(
    config.unpaginated ? {} : { page: String(page), limit: '20', sortOrder },
  );
  if (term.length >= 2) params.set('search', term);
  Object.entries(activeFilters).forEach(([key, value]) => {
    if (
      value !== '' &&
      value !== null &&
      value !== undefined &&
      !(config.slug === 'blocks' && key === 'stateId')
    )
      params.set(key, String(value));
  });
  const requiredFiltersReady = (config.filters ?? []).every(
    (field) => !field.required || Boolean(activeFilters[field.name]),
  );
  const allowed = can(config.permission, ...(config.needs ?? []));
  const query = useQuery({
    queryKey: [config.slug, params.toString()],
    queryFn: ({ signal }) => request<RecordData[]>(`${config.endpoint}?${params}`, { signal }),
    enabled: allowed && requiredFiltersReady,
    refetchInterval: (query) =>
      config.slug === 'leads'
        ? 15000
        : config.slug === 'imports' &&
            query.state.data?.data.some((row) =>
              ['QUEUED_VALIDATION', 'VALIDATING', 'QUEUED_COMMIT', 'PROCESSING'].includes(
                String(row.status),
              ),
            )
          ? 3000
          : false,
  });
  const rows = useDisplayRecords(Array.isArray(query.data?.data) ? query.data.data : []);
  const meta = query.data?.meta;
  async function refresh() {
    await queryClient.invalidateQueries();
  }
  async function create(payload: RecordData) {
    if (
      config.slug === 'leads' &&
      !can('leads:route') &&
      !can('leads:assign') &&
      can('leads:receive_assignment')
    )
      payload.assignedTo = user?.id;
    if (config.slug === 'blocks') delete payload.stateId;
    await request(config.endpoint, {
      method: 'POST',
      body: payload,
      idempotencyKey: crypto.randomUUID(),
    });
    setCreating(false);
    setNotice(`${label(config.singular)} created successfully.`);
    await refresh();
  }
  function apply(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    setTerm(search.trim());
    setActiveFilters(filters);
  }
  if (!allowed)
    return (
      <EmptyState
        title="Access restricted"
        description="Your current role does not grant access to this module."
      />
    );
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">YOUR WORKSPACE</span>
          <h1>{config.title}</h1>
          <p>{config.description}</p>
        </div>
        <div className="heading-actions">
          {allowBatch && Object.keys(batch).length > 0 && (
            <button className="button" onClick={() => setAssigning(true)}>
              Reassign {Object.keys(batch).length}{' '}
              {Object.keys(batch).length === 1 ? 'contact' : 'contacts'}
            </button>
          )}
          {config.slug === 'leads' && can('leads:export') && (
            <button className="button secondary" onClick={() => setExporting(true)}>
              <Download size={17} />
              Export leads
            </button>
          )}
          {config.slug === 'attendance' && can('attendance:create', 'files:upload') && (
            <button className="button" onClick={() => setSpecial(true)}>
              <Plus size={17} />
              Mark attendance
            </button>
          )}
          {config.slug === 'imports' && can('imports:create', 'leads:import', 'files:upload') && (
            <button className="button" onClick={() => setSpecial(true)}>
              <Plus size={17} />
              Upload CSV / Excel
            </button>
          )}
          {config.slug === 'visits' && can('reports:create') && (
            <button className="button" onClick={() => setSpecial(true)}>
              <Plus size={17} />
              Start site visit
            </button>
          )}
          {config.fields && config.createPermission && can(config.createPermission) && (
            <button className="button" onClick={() => setCreating(true)}>
              <Plus size={17} />
              Add {config.singular}
            </button>
          )}
        </div>
      </div>
      {notice && (
        <div className="success-banner" role="status">
          <ShieldCheck size={18} />
          {notice}
          <button className="text-button" onClick={() => setNotice('')}>
            Dismiss
          </button>
        </div>
      )}
      {config.slug === 'attendance' && (
        <AttendanceOverview
          filters={activeFilters}
          onApply={(next) => {
            setActiveFilters(next);
            setPage(1);
          }}
        />
      )}
      <section className="panel resource-panel">
        <div className="panel-heading">
          <div>
            <h2>All {config.title.toLowerCase()}</h2>
            <span className="muted">
              {meta
                ? `${meta.total.toLocaleString('en-IN')} records within your access`
                : 'Records within your access'}
            </span>
          </div>
          <button
            className="icon-button"
            aria-label="Refresh records"
            disabled={query.isFetching}
            onClick={() =>
              void (config.slug === 'attendance'
                ? queryClient.invalidateQueries({ queryKey: ['attendance'] })
                : query.refetch())
            }
          >
            <RefreshCw size={17} className={query.isFetching ? 'animate-spin' : ''} />
          </button>
        </div>
        {config.slug === 'attendance' ? (
          <AttendanceFilters
            key={JSON.stringify(activeFilters)}
            value={activeFilters}
            onApply={(next) => {
              setActiveFilters(next);
              setPage(1);
            }}
          />
        ) : (
          <form className="table-toolbar" onSubmit={apply}>
            {config.search && (
              <div className="search-field">
                <Search size={17} />
                <input
                  aria-label={`Search ${config.title}`}
                  placeholder={`Search ${config.title.toLowerCase()}…`}
                  value={search}
                  minLength={2}
                  maxLength={100}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
            )}
            {(config.filters ?? []).map((field) => (
              <FormField
                key={field.name}
                field={field}
                value={filters[field.name]}
                values={filters}
                onChange={(value) =>
                  setFilters((previous) => {
                    const next = { ...previous, [field.name]: value };
                    config.filters
                      ?.filter((child) => child.parent === field.name)
                      .forEach((child) => {
                        next[child.name] = '';
                      });
                    return next;
                  })
                }
              />
            ))}
            {(config.search || config.filters) && (
              <button className="button secondary small" type="submit">
                Apply
              </button>
            )}
            <button
              type="button"
              className="button ghost small toolbar-sort"
              onClick={() => {
                setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                setPage(1);
              }}
            >
              <ArrowDownUp size={15} />
              {sortOrder === 'asc' ? 'Ascending' : 'Descending'}
            </button>
          </form>
        )}
        {allowBatch && rows.length > 0 && (
          <p className="form-note">
            Contacts are assigned to a telecaller during import. Select contacts only when you need
            to change their telecaller.
          </p>
        )}
        {!requiredFiltersReady ? (
          <EmptyState
            title="Choose a location"
            description="Select the parent location above and apply the filter to view records."
          />
        ) : query.isPending ? (
          <Loading text={`Loading ${config.title.toLowerCase()}…`} />
        ) : query.isError ? (
          <ErrorState error={query.error} retry={() => void query.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            title={
              config.slug === 'attendance'
                ? 'No attendance matches these filters'
                : term
                  ? 'No matches found'
                  : `No ${config.title.toLowerCase()} yet`
            }
            description={
              config.slug === 'attendance'
                ? 'Try another date range or reset the filters to today.'
                : term
                  ? 'Try a different search or filter.'
                  : undefined
            }
          />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  {allowBatch && <th scope="col">Select</th>}
                  {config.columns.map((column) => (
                    <th key={column} scope="col">
                      {recordFieldLabel(column)}
                    </th>
                  ))}
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={recordId(row)}>
                    {allowBatch && (
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`Select contact ${String(row.customerName)}`}
                          checked={recordId(row) in batch}
                          disabled={typeof row.revision !== 'number'}
                          onChange={(event) =>
                            setBatch((previous) => {
                              const next = { ...previous };
                              if (event.target.checked) next[recordId(row)] = Number(row.revision);
                              else delete next[recordId(row)];
                              return next;
                            })
                          }
                        />
                      </td>
                    )}
                    {config.columns.map((column, index) => (
                      <td key={column} className={index === 0 ? 'primary-cell' : ''}>
                        {config.slug === 'attendance' && column === 'workingHours' ? (
                          workedTime(row)
                        ) : config.slug === 'attendance' && column === 'status' ? (
                          <span
                            className={`badge ${row.status === 'COMPLETED' ? 'green' : 'amber'}`}
                          >
                            {row.status === 'COMPLETED' ? 'Checked out' : 'Awaiting checkout'}
                          </span>
                        ) : config.slug === 'attendance' && column === 'lateArrival' ? (
                          <span className={`badge ${row.lateArrival ? 'red' : 'green'}`}>
                            {row.lateArrival ? 'Late' : 'No late flag'}
                          </span>
                        ) : isBadge(column, row[column]) && row[column] !== undefined ? (
                          <StatusBadge value={row[column]} />
                        ) : (
                          recordFieldValue(row, column)
                        )}
                      </td>
                    ))}
                    <td
                      className={
                        config.slug === 'imports'
                          ? 'import-actions'
                          : config.slug === 'calls'
                            ? 'call-actions'
                            : undefined
                      }
                    >
                      {config.slug === 'calls' && typeof row.customerId === 'string' && (
                        <button
                          type="button"
                          className="button secondary small"
                          aria-label={`Call history for ${display(row.customerName)}`}
                          onClick={() => setCallHistory(row)}
                        >
                          Contact call history
                        </button>
                      )}
                      <button
                        className={
                          config.slug === 'imports' ? 'button secondary small' : 'icon-button'
                        }
                        aria-label={
                          config.slug === 'imports'
                            ? undefined
                            : `View ${recordFieldValue(row, config.columns[0])}`
                        }
                        onClick={() => setSelected(row)}
                      >
                        {config.slug === 'imports' ? (
                          row.status === 'PREVIEW_READY' ? (
                            'Review & assign Telecaller'
                          ) : (
                            'View import progress'
                          )
                        ) : (
                          <ArrowRight size={17} />
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {meta && (
          <div className="table-footer">
            <span>
              {meta.total === 0
                ? '0'
                : `${(meta.page - 1) * meta.limit + 1}–${Math.min(meta.page * meta.limit, meta.total)}`}{' '}
              of {meta.total} records
            </span>
            <div>
              <button
                className="icon-button"
                aria-label="Previous page"
                disabled={page <= 1 || query.isFetching}
                onClick={() => setPage(page - 1)}
              >
                <ChevronLeft size={18} />
              </button>
              <span>
                Page {page} of {Math.max(1, meta.totalPages)}
              </span>
              <button
                className="icon-button"
                aria-label="Next page"
                disabled={page >= meta.totalPages || query.isFetching}
                onClick={() => setPage(page + 1)}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </section>
      {creating && config.fields && (
        <Modal title={`Add ${config.singular}`} onClose={() => setCreating(false)}>
          <DynamicForm
            fields={config.fields}
            submitLabel={`Create ${config.singular}`}
            onCancel={() => setCreating(false)}
            onSubmit={create}
          />
        </Modal>
      )}
      {callHistory && (
        <ContactCallHistory
          key={String(callHistory.customerId)}
          contactId={String(callHistory.customerId)}
          contactName={display(callHistory.customerName)}
          onClose={() => setCallHistory(null)}
        />
      )}
      {selected && (
        <RecordDetails
          config={config}
          initial={selected}
          onClose={() => {
            setSelected(null);
            if (searchParams.has('record')) {
              const next = new URLSearchParams(searchParams);
              next.delete('record');
              setSearchParams(next, { replace: true });
            }
          }}
          onSaved={() => {
            if (config.slug !== 'imports') setSelected(null);
            setNotice('Changes saved successfully.');
            void refresh();
          }}
        />
      )}
      {special && config.slug === 'attendance' && (
        <AttendanceCapture
          onClose={() => setSpecial(false)}
          onSaved={() => {
            setSpecial(false);
            setNotice('Attendance submitted.');
            void refresh();
          }}
        />
      )}
      {special && config.slug === 'imports' && (
        <ImportUpload
          onClose={() => setSpecial(false)}
          onSaved={(job) => {
            setSpecial(false);
            setSelected(job);
            setNotice(
              'Contact file queued for validation. Once ready, review the rows and select a Telecaller to assign.',
            );
            void refresh();
          }}
        />
      )}
      {special && config.slug === 'visits' && (
        <VisitCapture
          onClose={() => setSpecial(false)}
          onSaved={() => {
            setSpecial(false);
            setNotice('Site visit started. Open the visit to add evidence and complete it.');
            void refresh();
          }}
        />
      )}
      {exporting && (
        <ExportDialog
          kind="leads"
          query={Object.fromEntries(params)}
          onClose={() => setExporting(false)}
        />
      )}
      {assigning && (
        <Modal title="Reassign selected contacts" onClose={() => setAssigning(false)}>
          <p className="form-note">
            These contacts already have a telecaller. Choose a new telecaller and provide the reason
            for changing their assignment.
          </p>
          <DynamicForm
            fields={[
              { name: 'assignedTo', label: 'New telecaller', lookup: '/employees', required: true },
              { name: 'reason', type: 'textarea', min: 3, max: 500, required: true },
            ]}
            onCancel={() => setAssigning(false)}
            submitLabel="Reassign contacts"
            onSubmit={async (payload) => {
              if (Object.keys(batch).length > 100)
                throw new Error('Select up to 100 contacts per reassignment.');
              await request('/customers/assignments', {
                method: 'POST',
                body: {
                  ...payload,
                  items: Object.entries(batch).map(([id, revision]) => ({ id, revision })),
                },
              });
              setAssigning(false);
              setBatch({});
              setNotice('Selected contacts reassigned to the chosen telecaller.');
              await refresh();
            }}
          />
        </Modal>
      )}
    </>
  );
}
function RecordDetails({
  config,
  initial,
  onClose,
  onSaved,
}: {
  config: ResourceConfig;
  initial: RecordData;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { can, user } = useAuth();
  const queryClient = useQueryClient();
  const [action, setAction] = useState<Action | 'edit' | null>(null);
  const [completing, setCompleting] = useState(false);
  const [configuring, setConfiguring] = useState(false);
  const [assigningBdo, setAssigningBdo] = useState(false);
  const [tab, setTab] = useState('details');
  const [extraPage, setExtraPage] = useState(1);
  const id = recordId(initial);
  const hasDetailEndpoint =
    !config.endpoint.startsWith('/locations/') &&
    !['attendance', 'evidence', 'policies', 'references', 'hierarchy'].includes(config.slug);
  const detail = useQuery({
    queryKey: [config.slug, 'detail', id],
    queryFn: ({ signal }) =>
      request<RecordData>(`${config.endpoint}/${encodeURIComponent(id)}`, { signal }),
    enabled: hasDetailEndpoint,
    refetchOnMount: config.slug === 'imports' ? 'always' : true,
    refetchInterval: (query) =>
      config.slug === 'imports' &&
      ['QUEUED_VALIDATION', 'VALIDATING', 'QUEUED_COMMIT', 'PROCESSING'].includes(
        String((query.state.data?.data ?? initial).status),
      )
        ? 3000
        : false,
  });
  const record = detail.data?.data ?? initial;
  const changingLeadStatus =
    config.slug === 'leads' && action !== null && action !== 'edit' && action.path === '/status';
  const statusOptions = useQuery({
    queryKey: ['leads', id, 'status-options'],
    refetchOnWindowFocus: false,
    queryFn: ({ signal }) =>
      request<{
        currentStatus: string;
        revision: number;
        workflowVersion: number;
        allowedStatuses: string[];
      }>(`/leads/${encodeURIComponent(id)}/status-options`, { signal }),
    enabled: changingLeadStatus && can('leads:read', 'leads:update'),
  });
  const previewAvailable =
    config.slug !== 'imports' ||
    ['PREVIEW_READY', 'QUEUED_COMMIT', 'PROCESSING', 'COMPLETED'].includes(String(record.status));
  const extraPath =
    tab === 'assignments'
      ? '/assignments'
      : tab === 'proposals'
        ? '/assignment-proposals'
        : tab === 'progress'
          ? '/progress'
          : tab === 'rows'
            ? '/rows'
            : tab === 'history'
              ? config.slug === 'leads'
                ? '/status-history'
                : config.slug === 'targets'
                  ? '/revisions'
                  : '/history'
              : '';
  const extra = useQuery({
    queryKey: [config.slug, id, tab, extraPage],
    queryFn: ({ signal }) =>
      request<unknown>(
        `${config.endpoint}/${encodeURIComponent(id)}${extraPath}${tab === 'progress' ? '' : `?page=${extraPage}&limit=20`}`,
        { signal },
      ),
    enabled: Boolean(extraPath) && (tab !== 'rows' || previewAvailable),
  });
  const actions = (config.actions ?? []).filter(
    (item) =>
      can(item.permission, ...(item.needs ?? [])) &&
      !(
        config.slug === 'leads' &&
        item.path === '/route' &&
        (Boolean(record.assignedTo) ||
          ['CONVERTED', 'LOST', 'NOT_INTERESTED'].includes(String(record.status)))
      ),
  );
  const loading = hasDetailEndpoint && detail.isPending;
  async function save(payload: RecordData) {
    if (typeof record.revision !== 'number' && (action === 'edit' || (action && action.revision)))
      throw new Error('This record has no revision. Refresh the list before editing.');
    if (action === 'edit' || (action && action.revision)) payload.revision = record.revision;
    if (changingLeadStatus) {
      if (!statusOptions.data?.data.allowedStatuses.includes(String(payload.status)))
        throw new Error('Choose an allowed next status. Refresh the status options and try again.');
      payload.revision = statusOptions.data.data.revision;
    }
    if (config.slug === 'roles' && Array.isArray(payload.permissions)) {
      const definitions = await queryClient.fetchQuery({
        queryKey: ['permissions'],
        queryFn: () => request<RecordData[]>('/permissions'),
      });
      payload.permissions = (
        payload.permissions as { permissionId?: string; permission?: string; scope: string }[]
      ).map((grant) => {
        const permissionId =
          grant.permissionId ??
          recordId(
            definitions.data.find((definition) => definition.code === grant.permission) ?? {},
          );
        if (!permissionId) throw new Error('Unknown permission. Refresh and try again.');
        return { permissionId, scope: grant.scope };
      });
    }
    const suffix = action && action !== 'edit' ? action.path : '';
    if (config.slug === 'contacts' && suffix === '/assignments') {
      await request('/customers/assignments', {
        method: 'POST',
        body: {
          items: [{ id, revision: record.revision }],
          assignedTo: payload.assignedTo,
          reason: payload.reason,
        },
      });
      onSaved();
      return;
    }
    const endpoint =
      action && action !== 'edit' && action.endpoint
        ? action.endpoint.replace(':id', encodeURIComponent(id))
        : `${config.endpoint}/${encodeURIComponent(id)}${suffix}`;
    await request(endpoint, {
      method:
        action && action !== 'edit' ? (action.method ?? 'PATCH') : (config.editMethod ?? 'PATCH'),
      body: payload,
      idempotencyKey: crypto.randomUUID(),
    });
    onSaved();
  }
  const fields = (action === 'edit' ? config.editFields : action?.fields)?.map((field) =>
    changingLeadStatus && field.name === 'status'
      ? {
          ...field,
          disabledOptions: field.options?.filter(
            (option) => !statusOptions.data?.data.allowedStatuses.includes(option),
          ),
        }
      : field.lookup?.includes(':id')
        ? { ...field, lookup: field.lookup.replace(':id', encodeURIComponent(id)) }
        : field,
  );
  return (
    <Modal
      title={
        action === 'edit'
          ? `Edit ${config.singular}`
          : action
            ? action.label
            : `${label(config.singular)} details`
      }
      onClose={onClose}
    >
      {loading ? (
        <Loading />
      ) : hasDetailEndpoint && detail.isError ? (
        <ErrorState error={detail.error} retry={() => void detail.refetch()} />
      ) : changingLeadStatus && (statusOptions.isPending || statusOptions.isFetching) ? (
        <Loading text="Loading allowed lead statuses" />
      ) : changingLeadStatus && statusOptions.isError ? (
        <ErrorState error={statusOptions.error} retry={() => void statusOptions.refetch()} />
      ) : changingLeadStatus && !statusOptions.data?.data.allowedStatuses.length ? (
        <>
          <p className="notice">
            No status changes are available from{' '}
            {label(statusOptions.data?.data.currentStatus ?? String(record.status))} for your
            account.
          </p>
          <button type="button" className="button secondary" onClick={() => setAction(null)}>
            Back to lead
          </button>
        </>
      ) : fields ? (
        <>
          <p className="form-note">
            {changingLeadStatus
              ? `Current status: ${label(statusOptions.data?.data.currentStatus ?? String(record.status))}. Choose the lead’s actual status.`
              : config.slug === 'contacts' &&
                  action &&
                  action !== 'edit' &&
                  action.path === '/convert'
                ? `Choose the receiving branch for this site: ${String(record.siteAddress ?? '')}. The lead will wait for the branch head or an authorized senior to assign a sales executive.`
                : 'Changes use the current record revision. The server checks your permission and scope again.'}
          </p>
          {action && action !== 'edit' && action.method === 'DELETE' && (
            <p className="notice">
              Archiving removes this role from active use. Historical records are preserved.
            </p>
          )}
          <DynamicForm
            key={changingLeadStatus ? `${id}:${statusOptions.data?.data.revision}` : undefined}
            fields={fields}
            initial={changingLeadStatus ? { ...record, status: '' } : record}
            onCancel={() => setAction(null)}
            onSubmit={save}
            submitLabel={action === 'edit' ? 'Save changes' : action?.label}
          />
        </>
      ) : (
        <>
          {config.slug === 'imports' && (
            <section aria-label="Import assignment" className="form-stack">
              {['QUEUED_VALIDATION', 'VALIDATING'].includes(String(record.status)) ? (
                <p className="notice" role="status">
                  Validating contact rows. The Telecaller selector will appear here when the preview
                  is ready. This page updates automatically. If validation stays queued, ask your
                  administrator to check import processing.
                </p>
              ) : record.status === 'PREVIEW_READY' ? (
                can('imports:confirm', 'leads:import', 'customers:assign') ? (
                  <ImportAssignment
                    key={id}
                    job={record}
                    onSaved={onSaved}
                    onReviewRows={() => {
                      setExtraPage(1);
                      setTab('rows');
                    }}
                  />
                ) : (
                  <p className="notice">
                    The preview is ready. An authorized import manager must assign a Telecaller and
                    confirm the import.
                  </p>
                )
              ) : ['QUEUED_COMMIT', 'PROCESSING'].includes(String(record.status)) ? (
                <p className="notice" role="status">
                  Import confirmed. Valid contacts are being imported and assigned to the selected
                  Telecaller.
                </p>
              ) : record.status === 'COMPLETED' ? (
                <p className="notice" role="status">
                  {String(record.importedRows ?? 0)} contacts imported and assigned. Open Contacts
                  to view or reassign them.
                </p>
              ) : (
                <p className="inline-error" role="alert">
                  {importFailureMessage(record.errorCode)}
                </p>
              )}
            </section>
          )}
          <div className="detail-actions">
            {config.slug === 'employees' && <OpenEmployeePanel employeeId={id} />}
            {config.slug === 'leads' && !record.assignedTo && (
              <p className="notice">
                Awaiting assignment: this lead is with the receiving branch. Its branch head or an
                authorized senior must assign a sales executive.
              </p>
            )}
            {config.slug === 'customers' && typeof record.leadId === 'string' && (
              <Link
                className="button secondary small"
                to={`/leads?record=${encodeURIComponent(record.leadId)}`}
              >
                View source lead
              </Link>
            )}
            {config.slug === 'leads' && typeof record.confirmedCustomerId === 'string' && (
              <Link
                className="button secondary small"
                to={`/customers?record=${encodeURIComponent(record.confirmedCustomerId)}`}
              >
                View customer
              </Link>
            )}
            {config.slug === 'branches' &&
              record.isActive === true &&
              ['users:transfer', 'roles:read', 'users:read'].every((permission) =>
                user?.grants.some(
                  (grant) => grant.permission === permission && grant.scope === 'ALL',
                ),
              ) && (
                <button className="button secondary small" onClick={() => setAssigningBdo(true)}>
                  Assign BDO primary branch
                </button>
              )}
            {config.slug === 'branches' &&
              user?.canManageAttendanceSettings &&
              !user.employeePanel &&
              (can('branches:update') || can('dashboard:read', 'branches:read')) && (
                <button className="button secondary small" onClick={() => setConfiguring(true)}>
                  Attendance settings
                </button>
              )}
            {config.editFields && config.editPermission && can(config.editPermission) && (
              <button className="button secondary small" onClick={() => setAction('edit')}>
                Edit {config.singular}
              </button>
            )}
            {actions.map((item) => (
              <button
                key={item.label}
                className="button secondary small"
                onClick={() => setAction(item)}
              >
                {item.label}
              </button>
            ))}
            {config.slug === 'visits' &&
              record.status === 'OPEN' &&
              can('reports:create', 'files:upload') && (
                <button className="button small" onClick={() => setCompleting(true)}>
                  Complete visit
                </button>
              )}
          </div>
          <div className="tabs">
            <button className={tab === 'details' ? 'active' : ''} onClick={() => setTab('details')}>
              Details
            </button>
            {['contacts', 'leads'].includes(config.slug) && (
              <button
                className={tab === 'assignments' ? 'active' : ''}
                onClick={() => {
                  setExtraPage(1);
                  setTab('assignments');
                }}
              >
                Assignments
              </button>
            )}
            {config.slug === 'leads' && (
              <button
                className={tab === 'proposals' ? 'active' : ''}
                onClick={() => {
                  setExtraPage(1);
                  setTab('proposals');
                }}
              >
                Assignment proposals
              </button>
            )}
            {['leads', 'calls', 'visits', 'targets', 'evidence'].includes(config.slug) && (
              <button
                className={tab === 'history' ? 'active' : ''}
                onClick={() => {
                  setExtraPage(1);
                  setTab('history');
                }}
              >
                History
              </button>
            )}
            {config.slug === 'targets' && (
              <button
                className={tab === 'progress' ? 'active' : ''}
                onClick={() => {
                  setExtraPage(1);
                  setTab('progress');
                }}
              >
                Verified progress
              </button>
            )}
            {config.slug === 'imports' && (
              <button
                className={tab === 'rows' ? 'active' : ''}
                disabled={!previewAvailable}
                title={
                  !previewAvailable
                    ? 'Row preview becomes available after validation completes successfully.'
                    : undefined
                }
                onClick={() => {
                  setExtraPage(1);
                  setTab('rows');
                }}
              >
                Row preview
              </button>
            )}
          </div>
          {tab === 'details' ? (
            <>
              <RecordView record={record} />
              {['attendance', 'visits'].includes(config.slug) && (
                <EvidencePhotos record={record} kind={config.slug as 'attendance' | 'visits'} />
              )}
            </>
          ) : tab === 'rows' && !previewAvailable ? (
            <p className="notice" role="status">
              {record.status === 'FAILED'
                ? importFailureMessage(record.errorCode)
                : 'Contact validation has not finished. The preview will become available automatically when validation completes.'}
            </p>
          ) : extra.isPending ? (
            <Loading />
          ) : extra.isError ? (
            <ErrorState error={extra.error} retry={() => void extra.refetch()} />
          ) : tab === 'proposals' ? (
            <ProposalReview data={extra.data?.data} />
          ) : config.slug === 'imports' && tab === 'rows' ? (
            <ImportRowsPreview data={extra.data?.data} />
          ) : (
            <DataView data={extra.data?.data} />
          )}
          {tab !== 'details' && extra.data?.meta && (
            <div className="table-footer">
              <span>{extra.data.meta.total} records</span>
              <div>
                <button
                  className="icon-button"
                  aria-label="Previous detail page"
                  disabled={extraPage <= 1 || extra.isFetching}
                  onClick={() => setExtraPage(extraPage - 1)}
                >
                  <ChevronLeft size={18} />
                </button>
                <span>Page {extraPage}</span>
                <button
                  className="icon-button"
                  aria-label="Next detail page"
                  disabled={extraPage >= extra.data.meta.totalPages || extra.isFetching}
                  onClick={() => setExtraPage(extraPage + 1)}
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}
          {tab !== 'details' && !extra.data?.meta && Array.isArray(extra.data?.data) && (
            <div className="table-footer">
              <span>Page {extraPage}</span>
              <div>
                <button
                  className="button secondary small"
                  disabled={extraPage <= 1 || extra.isFetching}
                  onClick={() => setExtraPage(extraPage - 1)}
                >
                  Previous
                </button>
                <button
                  className="button secondary small"
                  disabled={extra.data.data.length < 20 || extra.isFetching}
                  onClick={() => setExtraPage(extraPage + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
      {completing && (
        <VisitCapture existing={record} onClose={() => setCompleting(false)} onSaved={onSaved} />
      )}
      {configuring && <BranchConfiguration id={id} onClose={() => setConfiguring(false)} />}
      {assigningBdo && (
        <BranchBdoAssignment
          branch={record}
          onClose={() => setAssigningBdo(false)}
          onSaved={() => {
            setAssigningBdo(false);
            void queryClient.invalidateQueries();
            onSaved();
          }}
        />
      )}
    </Modal>
  );
}
export function RecordView({ record }: { record: RecordData }) {
  const readable = useDisplayRecords(record);
  return (
    <dl className="record-details">
      {recordDisplayFields(readable).map(({ key, title, value }) => (
        <div key={key}>
          <dt>{title}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
export function DataView({ data }: { data: unknown }) {
  return Array.isArray(data) ? (
    data.length ? (
      <div className="record-collection">
        {data.map((record, index) => (
          <RecordView
            key={index}
            record={
              record && typeof record === 'object' ? (record as RecordData) : { value: record }
            }
          />
        ))}
      </div>
    ) : (
      <EmptyState />
    )
  ) : data && typeof data === 'object' ? (
    <RecordView record={data as RecordData} />
  ) : (
    <p>{display(data)}</p>
  );
}
