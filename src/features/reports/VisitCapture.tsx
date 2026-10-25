import { useRef, useState, type FormEvent } from 'react';
import type { RecordData } from '../../shared/types/api';
import { display, recordId } from '../../shared/lib/format';
import { errorMessage, request } from '../../shared/lib/api';
import { getLocation, uploadFile, validatePhoto } from '../../shared/lib/uploads';
import { Modal } from '../../shared/components/Modal';
import { FormField } from '../../shared/components/DynamicForm';
import { useAuth } from '../auth/auth-context';
export function VisitCapture({
  existing,
  onClose,
  onSaved,
}: {
  existing?: RecordData;
  onClose: () => void;
  onSaved: (record: RecordData) => void;
}) {
  const { user } = useAuth();
  const [leadId, setLeadId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const key = useRef(crypto.randomUUID());
  const uploaded = useRef(new Map<File, string>());
  const startInput = useRef<RecordData | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      if (existing) {
        if (!files.length || files.length > 5)
          throw new Error('Select between one and five photos.');
        files.forEach(validatePhoto);
      }
      const location = await getLocation();
      const clientCapturedAt = new Date().toISOString();
      if (!existing) {
        if (!startInput.current || startInput.current.leadId !== leadId) {
          if (startInput.current) key.current = crypto.randomUUID();
          startInput.current = { leadId, location, clientCapturedAt };
        }
        const result = await request<RecordData>('/sales-reports/visits', {
          method: 'POST',
          body: startInput.current,
          idempotencyKey: key.current,
        });
        onSaved(result.data);
      } else {
        const id = recordId(existing);
        const photoFileIds: string[] = [];
        for (const file of files) {
          let photoId = uploaded.current.get(file);
          if (!photoId) {
            photoId = await uploadFile(
              file,
              `/sales-reports/visits/${id}/photos/upload-intents`,
              (fileId) => `/sales-reports/visits/${id}/photos/${fileId}/confirm`,
              { contentType: file.type },
            );
            uploaded.current.set(file, photoId);
          }
          photoFileIds.push(photoId);
        }
        const nextFollowUpAt = String(form.get('nextFollowUpAt') ?? '');
        const result = await request<RecordData>(`/sales-reports/visits/${id}/complete`, {
          method: 'PATCH',
          body: {
            revision: existing.revision,
            location,
            clientCapturedAt,
            photoFileIds,
            discussionNotes: form.get('discussionNotes'),
            customerInterest: form.get('customerInterest'),
            installationReadiness: form.get('installationReadiness'),
            visitOutcome: form.get('visitOutcome'),
            requiredCapacityKw: form.get('requiredCapacityKw'),
            nextFollowUpAt: nextFollowUpAt ? new Date(nextFollowUpAt).toISOString() : null,
          },
        });
        onSaved(result.data);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={existing ? 'Complete site visit' : 'Start site visit'}
      onClose={onClose}
      busy={busy}
    >
      <p className="form-note">
        Your current location is captured when you submit. Completed visits require fresh photos and
        discussion notes.
      </p>
      {existing && (
        <p className="form-note">
          <strong>{display(existing.customerName)}</strong>
          <br />
          {display(existing.siteAddress)}
        </p>
      )}
      <form className="form-stack" onSubmit={(event) => void submit(event)}>
        {!existing ? (
          <FormField
            field={{
              name: 'leadId',
              label: 'Contact / assigned lead',
              lookup: `/leads?assignedTo=${encodeURIComponent(user?.id ?? '')}`,
              required: true,
              hint: 'Choose a lead assigned to you. If no contacts appear, ask your manager to assign a lead before starting a visit.',
            }}
            value={leadId}
            values={{}}
            disabled={busy}
            onChange={(value) => setLeadId(String(value))}
          />
        ) : (
          <fieldset className="form-grid" disabled={busy}>
            <label className="field full-width">
              Discussion notes
              <textarea name="discussionNotes" required minLength={3} maxLength={4000} rows={3} />
            </label>
            <label className="field">
              Contact interest
              <select name="customerInterest">
                {['UNKNOWN', 'INTERESTED', 'NOT_INTERESTED', 'UNDECIDED'].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <label className="field">
              Installation readiness
              <select name="installationReadiness">
                {['UNKNOWN', 'READY', 'NOT_READY'].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <label className="field">
              Visit outcome
              <select name="visitOutcome">
                {['COMPLETED', 'FOLLOW_UP_REQUIRED', 'CUSTOMER_UNAVAILABLE', 'NOT_INTERESTED'].map(
                  (value) => (
                    <option key={value}>{value}</option>
                  ),
                )}
              </select>
            </label>
            <label className="field">
              Required capacity (kW)
              <input name="requiredCapacityKw" required pattern="(0|[1-9]\d{0,7})(\.\d{1,2})?" />
            </label>
            <label className="field">
              Next follow-up
              <input name="nextFollowUpAt" type="datetime-local" />
            </label>
            <label className="field full-width">
              Visit photos (1–5)
              <input
                aria-label="Visit photos"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                multiple
                required
                onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
              />
            </label>
          </fieldset>
        )}
        {error && (
          <p className="inline-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button className="button secondary" type="button" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button className="button" disabled={busy}>
            {busy ? 'Submitting…' : existing ? 'Submit visit' : 'Start visit'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
