import { useQuery } from '@tanstack/react-query';
import { Modal } from '../../shared/components/Modal';
import { DynamicForm } from '../../shared/components/DynamicForm';
import { ErrorState, Loading } from '../../shared/components/Feedback';
import { request } from '../../shared/lib/api';
import { recordId } from '../../shared/lib/format';
import type { RecordData } from '../../shared/types/api';

export function BranchBdoAssignment({
  branch,
  onClose,
  onSaved,
}: {
  branch: RecordData;
  onClose: () => void;
  onSaved: () => void;
}) {
  const role = useQuery({
    queryKey: ['branch-assignment-bdo-role'],
    queryFn: async ({ signal }) => {
      const response = await request<RecordData[]>(
        '/roles?limit=100&sortBy=createdAt&sortOrder=asc&isActive=true',
        { signal },
      );
      const found = response.data.find((entry) => entry.code === 'BDO');
      if (!found)
        throw new Error(
          'The active BDO role is unavailable. Ask an administrator to review the role configuration.',
        );
      return recordId(found);
    },
  });
  return (
    <Modal title="Assign BDO primary branch" onClose={onClose}>
      <p className="form-note">
        Assign {String(branch.branchName)} as a BDO's primary branch so they can create their first
        team member here. This assignment signs the BDO out; they must sign in again to receive the
        updated access.
      </p>
      {role.isPending ? (
        <Loading />
      ) : role.isError ? (
        <ErrorState error={role.error} retry={() => void role.refetch()} />
      ) : (
        <DynamicForm
          fields={[
            {
              name: 'employeeId',
              label: 'BDO',
              lookup: '/employees?roleId=' + role.data + '&isActive=true',
              required: true,
            },
            {
              name: 'reason',
              label: 'Assignment reason',
              type: 'textarea',
              required: true,
              min: 3,
              max: 500,
            },
          ]}
          onCancel={onClose}
          submitLabel="Assign primary branch"
          onSubmit={async (input) => {
            const employee = (await request<RecordData>('/employees/' + String(input.employeeId)))
              .data;
            if (
              employee.roleId !== role.data ||
              employee.isActive !== true ||
              !employee.reportingManagerId
            )
              throw new Error('Choose an active BDO with a valid reporting manager.');
            await request('/employees/' + recordId(employee) + '/branch', {
              method: 'PATCH',
              body: {
                revision: employee.revision,
                branchId: recordId(branch),
                reportingManagerIds:
                  Array.isArray(employee.reportingManagerIds) && employee.reportingManagerIds.length
                    ? employee.reportingManagerIds
                    : [employee.reportingManagerId],
                reason: input.reason,
              },
            });
            onSaved();
          }}
        />
      )}
    </Modal>
  );
}
