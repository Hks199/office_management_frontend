import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../auth/auth-context';
import { EmptyState, ErrorState, Loading } from '../../shared/components/Feedback';
import { request } from '../../shared/lib/api';
import { label } from '../../shared/lib/format';
import { leadStatuses, validationMessage, workflowPayload } from './contracts';
interface Workflow {
  version: number;
  transitions: { from: string; to: string }[];
}
export function CommercialPage() {
  const { can } = useAuth();
  if (!can('settings:manage')) return <EmptyState title="Access restricted" />;
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">ADMINISTRATION</span>
          <h1>Commercial settings</h1>
          <p>Manage lead transitions and contact duplicate rules.</p>
        </div>
      </div>
      <div className="admin-stack">
        <DuplicateSettings />
        {can('leads:read') ? (
          <WorkflowSettings />
        ) : (
          <section className="panel">
            <EmptyState
              title="Lead workflows unavailable"
              description="Lead-read access is required to inspect and edit the workflow."
            />
          </section>
        )}
      </div>
    </>
  );
}
function DuplicateSettings() {
  const query = useQuery({
    queryKey: ['commercial-settings'],
    queryFn: ({ signal }) =>
      request<{ revision: number; duplicateScope: string }>('/commercial-settings', { signal }),
  });
  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>Contact duplicate rules</h2>
        <button className="button secondary small" onClick={() => void query.refetch()}>
          Refresh
        </button>
      </div>
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : query.data.data ? (
        <DuplicateForm
          key={query.data.data.revision}
          initial={query.data.data}
          onSaved={() => void query.refetch()}
        />
      ) : (
        <EmptyState
          title="Commercial settings are not initialized"
          description="Run the backend's commercial setup migration."
        />
      )}
    </section>
  );
}
function DuplicateForm({
  initial,
  onSaved,
}: {
  initial: { revision: number; duplicateScope: string };
  onSaved: () => void;
}) {
  const [scope, setScope] = useState(initial.duplicateScope);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  return (
    <form
      className="admin-form"
      onSubmit={(event) => {
        event.preventDefault();
        setBusy(true);
        setError('');
        setSuccess('');
        void request('/commercial-settings', {
          method: 'PATCH',
          body: { revision: initial.revision, duplicateScope: scope },
        })
          .then(() => {
            setSuccess('Duplicate rules saved.');
            onSaved();
          })
          .catch((err: unknown) => setError(validationMessage(err)))
          .finally(() => setBusy(false));
      }}
    >
      <p className="form-note">
        Choose whether duplicate contacts are detected within a branch or across the company. The
        backend locks this setting once contact records exist.
      </p>
      <label className="field">
        Duplicate scope
        <select value={scope} disabled={busy} onChange={(event) => setScope(event.target.value)}>
          <option value="BRANCH">Within each branch</option>
          <option value="COMPANY">Across the company</option>
        </select>
      </label>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      {success && <p role="status">{success}</p>}
      <button className="button" disabled={busy || scope === initial.duplicateScope}>
        {busy ? 'Saving…' : 'Save duplicate rules'}
      </button>
    </form>
  );
}
function WorkflowSettings() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [success, setSuccess] = useState('');
  const query = useQuery({
    queryKey: ['lead-workflow'],
    queryFn: ({ signal }) => request<Workflow>('/lead-workflows', { signal }),
  });
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>Lead workflow</h2>
          <span className="muted">
            {query.data ? `Current version ${query.data.data.version}` : 'Versioned transitions'}
          </span>
        </div>
        <button
          className="button secondary small"
          onClick={() => {
            setEditing(false);
            void query.refetch();
          }}
        >
          Refresh
        </button>
      </div>
      {success && (
        <p className="success-banner" role="status">
          {success}
        </p>
      )}
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          <div className="admin-form">
            <p className="form-note">
              Saving creates a new workflow version. Existing leads retain their recorded workflow
              version. Terminal reopening requires lead-reopen access; hold/resume follows backend
              rules.
            </p>
            {!editing && (
              <>
                <div className="transition-list">
                  {query.data.data.transitions.map((edge, index) => (
                    <div key={index}>
                      <span>{label(edge.from)}</span>
                      <span aria-label="to">→</span>
                      <span>{label(edge.to)}</span>
                    </div>
                  ))}
                </div>
                <button className="button" onClick={() => setEditing(true)}>
                  Edit transitions
                </button>
              </>
            )}
          </div>
          {editing && (
            <WorkflowEditor
              key={query.data.data.version}
              initial={query.data.data}
              onCancel={() => setEditing(false)}
              onSaved={async () => {
                setEditing(false);
                setSuccess('A new workflow version was saved.');
                await queryClient.invalidateQueries({ queryKey: ['lead-workflow'] });
              }}
            />
          )}
        </>
      )}
    </section>
  );
}
function WorkflowEditor({
  initial,
  onCancel,
  onSaved,
}: {
  initial: Workflow;
  onCancel: () => void;
  onSaved: () => Promise<void>;
}) {
  const [edges, setEdges] = useState(initial.transitions);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <form
      className="admin-form"
      onSubmit={(event) => {
        event.preventDefault();
        setBusy(true);
        setError('');
        try {
          const body = workflowPayload(initial.version, edges);
          void request('/lead-workflows', { method: 'POST', body })
            .then(onSaved)
            .catch((err: unknown) => setError(validationMessage(err)))
            .finally(() => setBusy(false));
        } catch (err) {
          setError(validationMessage(err));
          setBusy(false);
        }
      }}
    >
      <fieldset disabled={busy} className="transition-editor">
        {edges.map((edge, index) => (
          <div key={index}>
            <label className="field">
              From
              <select
                aria-label={`Transition ${index + 1} from`}
                value={edge.from}
                onChange={(event) =>
                  setEdges(
                    edges.map((item, i) =>
                      i === index ? { ...item, from: event.target.value } : item,
                    ),
                  )
                }
              >
                {leadStatuses
                  .filter(
                    (status) =>
                      !['CONVERTED', 'LOST', 'NOT_INTERESTED', 'ON_HOLD'].includes(status),
                  )
                  .map((status) => (
                    <option key={status} value={status}>
                      {label(status)}
                    </option>
                  ))}
              </select>
            </label>
            <label className="field">
              To
              <select
                aria-label={`Transition ${index + 1} to`}
                value={edge.to}
                onChange={(event) =>
                  setEdges(
                    edges.map((item, i) =>
                      i === index ? { ...item, to: event.target.value } : item,
                    ),
                  )
                }
              >
                {leadStatuses
                  .filter((status) => status !== 'NEW')
                  .map((status) => (
                    <option key={status} value={status}>
                      {label(status)}
                    </option>
                  ))}
              </select>
            </label>
            <button
              type="button"
              className="icon-button"
              aria-label={`Remove transition ${index + 1}`}
              onClick={() => setEdges(edges.filter((_, i) => i !== index))}
            >
              <Trash2 size={18} />
            </button>
          </div>
        ))}
      </fieldset>
      <button
        className="button secondary small"
        type="button"
        disabled={busy || edges.length >= 100}
        onClick={() => setEdges([...edges, { from: 'NEW', to: 'CONTACTED' }])}
      >
        <Plus size={15} />
        Add transition
      </button>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      <div className="modal-actions">
        <button className="button secondary" type="button" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
        <button className="button" disabled={busy}>
          {busy ? 'Saving…' : 'Save new workflow version'}
        </button>
      </div>
    </form>
  );
}
