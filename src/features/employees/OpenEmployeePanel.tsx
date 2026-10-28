import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { LogIn } from 'lucide-react';
import { useAuth } from '../auth/auth-context';
import { request, errorMessage } from '../../shared/lib/api';

export function OpenEmployeePanel({ employeeId }: { employeeId: string }) {
  const { user, can, openEmployeePanel } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const availability = useQuery({
    queryKey: ['employee-panel-availability', user?.id, employeeId],
    queryFn: ({ signal }) =>
      request<{ allowed: boolean }>(`/auth/employee-panels/${employeeId}/availability`, { signal }),
    enabled: Boolean(
      user && user.id !== employeeId && !user.employeePanel && can('users:open_panel'),
    ),
    retry: false,
  });
  if (!availability.data?.data.allowed || user?.employeePanel) return null;
  return (
    <div className="employee-panel-action">
      <button
        className="button secondary small"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          setError('');
          void openEmployeePanel(employeeId)
            .then(() => navigate('/', { replace: true }))
            .catch((failure: unknown) => setError(errorMessage(failure)))
            .finally(() => setBusy(false));
        }}
      >
        <LogIn size={16} />
        {busy ? 'Opening panel…' : 'Open employee panel'}
      </button>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
