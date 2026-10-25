import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/auth-context';
import { request } from '../../shared/lib/api';
import { recordId } from '../../shared/lib/format';
import type { RecordData } from '../../shared/types/api';
import { DynamicForm } from '../../shared/components/DynamicForm';
import { Modal } from '../../shared/components/Modal';
import { ResultView } from '../../shared/components/ResultView';
import { useDisplayRecords } from '../../shared/lib/use-display-records';
import { recordFieldValue } from '../../shared/lib/record-display';
export function ProposalReview({ data }: { data: unknown }) {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<RecordData | null>(null);
  const [success, setSuccess] = useState('');
  const rows = useDisplayRecords(Array.isArray(data) ? (data as RecordData[]) : []);
  return (
    <>
      {success && (
        <p className="success-banner" role="status">
          {success}
        </p>
      )}
      <ResultView data={rows} />
      {can('leads:assign') &&
        rows
          .filter((row) => row.status === 'PENDING')
          .map((row) => (
            <button
              className="button secondary small"
              key={recordId(row)}
              onClick={() => setSelected(row)}
            >
              Review proposal to {recordFieldValue(row, 'proposedTo')}
            </button>
          ))}
      {selected && (
        <Modal title="Review assignment proposal" onClose={() => setSelected(null)}>
          <p className="form-note">
            Approval uses the lead revision recorded by the proposal. Expired proposals and stale
            revisions are rejected by the backend.
          </p>
          <DynamicForm
            fields={[
              {
                name: 'status',
                label: 'Decision',
                type: 'select',
                options: ['APPROVED', 'REJECTED'],
                required: true,
              },
              { name: 'reason', type: 'textarea', min: 3, max: 500, required: true },
            ]}
            onCancel={() => setSelected(null)}
            submitLabel="Submit decision"
            onSubmit={async (body) => {
              await request(`/lead-assignment-proposals/${recordId(selected)}`, {
                method: 'PATCH',
                body,
              });
              setSelected(null);
              setSuccess('Proposal decision saved.');
              await queryClient.invalidateQueries();
            }}
          />
        </Modal>
      )}
    </>
  );
}
