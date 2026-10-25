import { useState, type FormEvent } from 'react';
import type { RecordData } from '../../shared/types/api';
import { FormField } from '../../shared/components/DynamicForm';
import { errorMessage, request } from '../../shared/lib/api';
import { recordId } from '../../shared/lib/format';

export function ImportAssignment({
  job,
  onSaved,
  onReviewRows,
}: {
  job: RecordData;
  onSaved: () => void;
  onReviewRows?: () => void;
}) {
  const [assignedTo, setAssignedTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (!assignedTo) throw new Error('Select a Telecaller.');
      await request(`/csv-imports/${recordId(job)}/confirm`, {
        method: 'POST',
        body: { assignedTo, revision: job.revision },
      });
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="form-stack" onSubmit={(event) => void submit(event)}>
      <h3>Assign imported contacts to a Telecaller</h3>
      {Number(job.acceptedRows) < 1 && (
        <div>
          <p className="inline-error">
            There are no valid new contacts to import. Review duplicate and rejected rows, correct
            the file, and upload it again.
          </p>
          {onReviewRows && (
            <button type="button" className="button secondary small" onClick={onReviewRows}>
              Review row errors
            </button>
          )}
        </div>
      )}
      <p className="form-note">
        Review Row preview, then select a Telecaller below. Only the {String(job.acceptedRows ?? 0)}{' '}
        valid, nonduplicate contacts will be imported and assigned. Existing contacts are unchanged.
      </p>
      <FormField
        field={{
          name: 'assignedTo',
          label: 'Telecaller',
          lookup: `/csv-imports/${recordId(job)}/assignees`,
          required: true,
          hint: 'Shows active Telecallers in this import’s branch that you are authorized to assign contacts to.',
        }}
        value={assignedTo}
        values={{}}
        disabled={busy}
        onChange={(value) => setAssignedTo(String(value))}
      />
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      <button className="button" disabled={busy || !assignedTo || Number(job.acceptedRows) < 1}>
        {busy ? 'Assigning…' : 'Assign Telecaller & import'}
      </button>
    </form>
  );
}
