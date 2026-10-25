import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { Modal } from '../../shared/components/Modal';
import { errorMessage, request } from '../../shared/lib/api';
import { recordId } from '../../shared/lib/format';
import { validateStorageUrl } from '../../shared/lib/uploads';
import { ErrorState, Loading } from '../../shared/components/Feedback';
import type { RecordData } from '../../shared/types/api';
export function ExportDialog({
  kind,
  dashboardKind = 'overview',
  query,
  onClose,
}: {
  kind: 'dashboard' | 'leads';
  dashboardKind?: string;
  query: Record<string, unknown>;
  onClose: () => void;
}) {
  const [id, setId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [url, setUrl] = useState('');
  const base = kind === 'dashboard' ? '/dashboard/exports' : '/leads/exports';
  const job = useQuery({
    queryKey: ['export', base, id],
    queryFn: ({ signal }) => request<RecordData>(`${base}/${id}`, { signal }),
    enabled: Boolean(id),
    refetchInterval: (state) =>
      ['COMPLETED', 'FAILED', 'EXPIRED'].includes(String(state.state.data?.data.status))
        ? false
        : 3000,
    retry: false,
  });
  async function create() {
    setBusy(true);
    setError('');
    try {
      const result = await request<RecordData>(base, {
        method: 'POST',
        body: kind === 'dashboard' ? { kind: dashboardKind, query } : query,
      });
      setId(recordId(result.data));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  async function download() {
    setBusy(true);
    try {
      const result = await request<{ url: string }>(`${base}/${id}/download`);
      setUrl(validateStorageUrl(result.data.url));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="Export records" onClose={onClose} busy={busy}>
      <p className="form-note">
        Exports are generated in private storage using your current access. Large jobs depend on the
        backend export worker.
      </p>
      {!id ? (
        <button className="button" disabled={busy} onClick={() => void create()}>
          <Download size={17} />
          {busy ? 'Queueing…' : 'Generate CSV'}
        </button>
      ) : job.isError ? (
        <ErrorState error={job.error} retry={() => void job.refetch()} />
      ) : job.data?.data.status === 'COMPLETED' ? (
        url ? (
          <a
            className="button"
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            referrerPolicy="no-referrer"
          >
            Download CSV
          </a>
        ) : (
          <button className="button" disabled={busy} onClick={() => void download()}>
            Get download link
          </button>
        )
      ) : ['FAILED', 'EXPIRED'].includes(String(job.data?.data.status)) ? (
        <p role="alert" className="inline-error">
          The export failed or expired. Close this dialog and try again.
        </p>
      ) : (
        <Loading text="Preparing your export…" />
      )}
      {error && (
        <p role="alert" className="inline-error">
          {error}
        </p>
      )}
    </Modal>
  );
}
