import { useEffect, useState } from 'react';
import { Camera } from 'lucide-react';
import { request, errorMessage } from '../../shared/lib/api';
import { recordId } from '../../shared/lib/format';
import { validateStorageUrl } from '../../shared/lib/uploads';
import type { RecordData } from '../../shared/types/api';
import { Modal } from '../../shared/components/Modal';
export function EvidencePhotos({
  record,
  kind,
}: {
  record: RecordData;
  kind: 'attendance' | 'visits';
}) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!url) return;
    const timeout = window.setTimeout(() => setUrl(''), 55_000);
    return () => window.clearTimeout(timeout);
  }, [url]);
  const id = recordId(record);
  const photos =
    kind === 'attendance'
      ? [
          { name: 'Check-in photo', path: `/attendance/${id}/photos/check-in` },
          ...(record.checkOutPhotoFileId
            ? [{ name: 'Check-out photo', path: `/attendance/${id}/photos/check-out` }]
            : []),
        ]
      : Array.isArray(record.photoFileIds)
        ? (record.photoFileIds as string[]).map((fileId, index) => ({
            name: `Visit photo ${index + 1}`,
            path: `/sales-reports/visits/${id}/photos/${fileId}/download`,
          }))
        : [];
  async function view(path: string) {
    setBusy(true);
    setError('');
    setUrl('');
    try {
      const response = await request<{ url: string }>(path);
      setUrl(validateStorageUrl(response.data.url));
      setOpen(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="evidence-photos">
      <h3>Private photo evidence</h3>
      <div className="detail-actions">
        {photos.length ? (
          photos.map((photo) => (
            <button
              key={photo.path}
              className="button secondary small"
              disabled={busy}
              onClick={() => void view(photo.path)}
            >
              <Camera size={15} />
              {busy ? 'Loading…' : photo.name}
            </button>
          ))
        ) : (
          <p className="form-note">No submitted photo evidence.</p>
        )}
      </div>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      {open && (
        <Modal
          title="Private photo evidence"
          onClose={() => {
            setOpen(false);
            setUrl('');
          }}
        >
          {url ? (
            <img
              className="evidence-image"
              src={url}
              alt="Submitted attendance or site visit evidence"
              referrerPolicy="no-referrer"
              onError={() => {
                setUrl('');
                setError('The photo link expired or could not be loaded. Request it again.');
              }}
            />
          ) : (
            <p className="form-note">
              This short-lived photo link expired. Close the viewer and request it again.
            </p>
          )}
        </Modal>
      )}
    </section>
  );
}
