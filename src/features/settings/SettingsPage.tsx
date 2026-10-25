import { useState } from 'react';
import { KeyRound, LogOut, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import { errorMessage, request } from '../../shared/lib/api';
import { Modal } from '../../shared/components/Modal';
import { label } from '../../shared/lib/format';
export function SettingsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [changing, setChanging] = useState(false);
  const [revoke, setRevoke] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function revokeAll() {
    setBusy(true);
    setError('');
    try {
      await logout(true);
      navigate('/login', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">ACCOUNT</span>
          <h1>Your profile & security</h1>
          <p>Keep your account details and access in view.</p>
        </div>
      </div>
      <div className="settings-grid">
        <section className="panel">
          <div className="panel-heading">
            <h2>Profile</h2>
            <ShieldCheck size={19} />
          </div>
          <dl className="record-details">
            <div>
              <dt>Name</dt>
              <dd>
                {user?.firstName} {user?.lastName}
              </dd>
            </div>
            <div>
              <dt>Employee code</dt>
              <dd>{user?.employeeCode}</dd>
            </div>
            <div>
              <dt>Work email</dt>
              <dd>{user?.email}</dd>
            </div>
            <div>
              <dt>Mobile</dt>
              <dd>{user?.mobileNumber}</dd>
            </div>
          </dl>
          <p className="form-note">
            Contact your administrator to update employee profile details.
          </p>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2>Account security</h2>
            <KeyRound size={19} />
          </div>
          <div className="security-options">
            <div>
              <h3>Password</h3>
              <p>Use a unique password of at least 12 characters.</p>
              <button className="button secondary small" onClick={() => setChanging(true)}>
                Change password
              </button>
            </div>
            <div>
              <h3>Active sessions</h3>
              <p>Sign out every device associated with your account.</p>
              <button className="button secondary small" onClick={() => setRevoke(true)}>
                <LogOut size={15} />
                Sign out all devices
              </button>
            </div>
          </div>
        </section>
      </div>
      <section className="panel grants-panel">
        <div className="panel-heading">
          <h2>Your assigned access</h2>
          <span className="muted">Enforced by the server</span>
        </div>
        <div className="grant-chips">
          {user?.grants.map((grant, index) => (
            <span key={index}>
              {grant.permission}
              <small>{label(grant.scope)}</small>
            </span>
          ))}
        </div>
      </section>
      {changing && (
        <Modal title="Change password" onClose={() => setChanging(false)}>
          <p className="form-note">
            Changing your password revokes your sessions. You’ll need to sign in again.
          </p>
          <PasswordForm
            onCancel={() => setChanging(false)}
            onSaved={async () => {
              // The password endpoint has already revoked every server session.
              window.location.replace('/login');
            }}
          />
        </Modal>
      )}
      {revoke && (
        <Modal title="Sign out all devices?" onClose={() => setRevoke(false)} busy={busy}>
          <p className="form-note">This will end all active sessions, including this one.</p>
          {error && (
            <p className="inline-error" role="alert">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <button className="button secondary" disabled={busy} onClick={() => setRevoke(false)}>
              Cancel
            </button>
            <button className="button" disabled={busy} onClick={() => void revokeAll()}>
              {busy ? 'Signing out…' : 'Sign out all devices'}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
function PasswordForm({
  onCancel,
  onSaved,
}: {
  onCancel: () => void;
  onSaved: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <form
      className="form-stack"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const newPassword = String(form.get('newPassword'));
        if (newPassword !== form.get('confirm')) {
          setError('Passwords do not match.');
          return;
        }
        if (!/\S/.test(newPassword)) {
          setError('The password cannot contain only spaces.');
          return;
        }
        setBusy(true);
        setError('');
        void request('/auth/change-password', {
          method: 'POST',
          body: { currentPassword: form.get('currentPassword'), newPassword },
        })
          .then(onSaved)
          .catch((err: unknown) => setError(errorMessage(err)))
          .finally(() => setBusy(false));
      }}
    >
      <label className="field">
        Current password
        <input
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          maxLength={128}
          required
          disabled={busy}
        />
      </label>
      <label className="field">
        New password
        <input
          name="newPassword"
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={128}
          required
          disabled={busy}
        />
      </label>
      <label className="field">
        Confirm new password
        <input
          name="confirm"
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={128}
          required
          disabled={busy}
        />
      </label>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      <div className="modal-actions">
        <button type="button" className="button secondary" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
        <button className="button" disabled={busy}>
          {busy ? 'Changing password…' : 'Change password'}
        </button>
      </div>
    </form>
  );
}
