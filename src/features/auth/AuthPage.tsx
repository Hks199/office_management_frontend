import { useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, LockKeyhole, ShieldCheck } from 'lucide-react';
import { z } from 'zod';
import { useAuth } from './auth-context';
import { errorMessage, request } from '../../shared/lib/api';
import { Loading } from '../../shared/components/Feedback';
import { BrandLogo } from '../../shared/components/BrandLogo';

export function AuthPage() {
  const { user, loading, login, startupError, reload } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const token = useRef('');
  const reset = pathname === '/reset-password';
  const invitation = pathname === '/accept-invitation';
  const forgot = pathname === '/forgot-password';
  const setup = reset || invitation;
  useLayoutEffect(() => {
    // Capture a single-use secret once, then remove it before any API request or navigation.
    if (setup && window.location.hash) {
      const fragment = window.location.hash.slice(1);
      token.current = fragment.startsWith('token=')
        ? (new URLSearchParams(fragment).get('token') ?? '')
        : fragment;
      window.history.replaceState(null, '', window.location.pathname);
    }
    return () => {
      token.current = '';
    };
  }, [setup]);
  if (loading) return <Loading />;
  if (user && !setup) return <Navigate to="/" replace />;
  const title = invitation
    ? 'Welcome to Sunvika.'
    : reset
      ? 'A fresh start.'
      : forgot
        ? 'Let’s get you back in.'
        : 'Welcome back.';
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setError('');
    setSuccess('');
    setBusy(true);
    try {
      const email = String(values.get('email') ?? '')
        .trim()
        .toLowerCase();
      const password = String(values.get('password') ?? '');
      if (setup) {
        z.string()
          .regex(
            /^[A-Za-z0-9_-]{43}$/,
            'This link is missing its token or is invalid. Request a new link.',
          )
          .parse(token.current);
        z.string()
          .min(12, 'Use at least 12 characters.')
          .max(128)
          .regex(/\S/, 'The password cannot contain only spaces.')
          .parse(password);
        if (password !== values.get('confirmPassword')) throw new Error('Passwords do not match.');
        const result = await request(`/auth${pathname}`, {
          method: 'POST',
          body: { token: token.current, newPassword: password },
          anonymous: true,
        });
        token.current = '';
        form.reset();
        setSuccess(result.message);
      } else {
        z.email('Enter a valid email address.').max(254).parse(email);
        if (forgot) {
          const result = await request('/auth/forgot-password', {
            method: 'POST',
            body: { email },
            anonymous: true,
          });
          setSuccess(result.message);
          form.reset();
        } else {
          await login(email, password);
          form.reset();
          navigate('/', { replace: true });
        }
      }
    } catch (err) {
      setError(err instanceof z.ZodError ? err.issues[0].message : errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-layout">
      <section className="auth-story">
        <Link to="/login" className="brand light">
          <BrandLogo />
        </Link>
        <div className="auth-story-content">
          <span className="eyebrow light-text">YOUR PEOPLE. YOUR PROGRESS.</span>
          <h1>
            Good work starts
            <br />
            with a connected
            <br />
            <em>workspace.</em>
          </h1>
          <p>
            Bring your teams, contact relationships, and everyday operations together in one place.
          </p>
          <div className="story-art" aria-hidden="true">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="art-card">
              <BrandLogo decorative />
              <span>Growing together.</span>
              <div className="art-bars">
                <i />
                <i />
                <i />
                <i />
                <i />
                <i />
              </div>
            </div>
            <span className="art-dot one" />
            <span className="art-dot two" />
          </div>
        </div>
        <footer>
          Sunvika office management <span>Built for better days.</span>
        </footer>
      </section>
      <section className="auth-panel">
        <div className="auth-form-wrap">
          <div className="auth-lock">
            <LockKeyhole size={24} />
          </div>
          <span className="eyebrow">YOUR WORKSPACE, CONNECTED</span>
          <h2>{title}</h2>
          <p className="muted">
            {setup
              ? 'Choose a strong password to secure your account.'
              : forgot
                ? 'Enter your work email to request a password reset link.'
                : 'Sign in with your work account to continue.'}
          </p>
          {startupError && (
            <div className="notice" role="status">
              {startupError}
              <button type="button" className="text-button" onClick={() => void reload()}>
                Retry connection
              </button>
            </div>
          )}
          {success ? (
            <div className="success-box" role="status">
              <ShieldCheck size={22} />
              <p>{success}</p>
              <Link className="button" to="/login">
                Back to sign in
                <ArrowRight size={16} />
              </Link>
            </div>
          ) : (
            <form onSubmit={(event) => void submit(event)} className="form-stack">
              {!setup && (
                <label className="field">
                  Work email
                  <input
                    name="email"
                    type="email"
                    autoComplete="username"
                    placeholder="you@sunvika.com"
                    maxLength={254}
                    required
                    disabled={busy}
                  />
                </label>
              )}
              {!forgot && (
                <>
                  <label className="field">
                    {setup ? 'New password' : 'Password'}
                    <span className="password-input">
                      <input
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete={setup ? 'new-password' : 'current-password'}
                        minLength={setup ? 12 : 1}
                        maxLength={128}
                        required
                        disabled={busy}
                      />
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </span>
                  </label>
                  {setup && (
                    <>
                      <p className="field-hint">
                        Use 12–128 characters. A unique passphrase works well.
                      </p>
                      <label className="field">
                        Confirm password
                        <input
                          name="confirmPassword"
                          type="password"
                          autoComplete="new-password"
                          minLength={12}
                          maxLength={128}
                          required
                          disabled={busy}
                        />
                      </label>
                    </>
                  )}
                </>
              )}
              {!forgot && !setup && (
                <Link className="forgot-link" to="/forgot-password">
                  Forgot password?
                </Link>
              )}
              {error && (
                <p className="inline-error" role="alert">
                  {error}
                </p>
              )}
              <button className="button auth-submit" disabled={busy}>
                {busy
                  ? 'Please wait…'
                  : setup
                    ? 'Set password'
                    : forgot
                      ? 'Send reset instructions'
                      : 'Sign in to workspace'}
                <ArrowRight size={17} />
              </button>
            </form>
          )}
          {(forgot || setup) && !success && (
            <Link className="back-link" to="/login">
              Back to sign in
            </Link>
          )}
          {!forgot && !setup && (
            <p className="auth-help">
              New to the team? Use the invitation sent to your work email.
            </p>
          )}
          <div className="auth-security">
            <ShieldCheck size={16} />
            Protected access · Authorized team members only
          </div>
        </div>
        <footer className="auth-footer">
          © {new Date().getFullYear()} Sunvika. All rights reserved.
        </footer>
      </section>
    </main>
  );
}
