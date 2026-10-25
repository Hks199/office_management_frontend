import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import {
  ApiError,
  clearSession,
  errorMessage,
  onSessionExpired,
  refreshSession,
  request,
  setCredentials,
} from '../../shared/lib/api';
import { AuthContext } from './auth-context';
import type { Profile } from '../../shared/types/api';

const profileSchema = z.object({
  id: z.string(),
  employeeCode: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string(),
  mobileNumber: z.string(),
  roleId: z.string(),
  branchId: z.string().nullable(),
  reportingManagerId: z.string().nullable(),
  grants: z.array(z.object({ permission: z.string(), scope: z.string() })),
});
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [startupError, setStartupError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const reset = useCallback(() => {
    clearSession();
    setUser(null);
    queryClient.clear();
  }, [queryClient]);
  const reload = useCallback(async () => {
    setLoading(true);
    setStartupError(null);
    try {
      await refreshSession();
      const result = await request('/auth/me');
      setUser(profileSchema.parse(result.data));
    } catch (error) {
      reset();
      if (!(error instanceof ApiError && error.status === 401))
        setStartupError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [reset]);
  useEffect(() => {
    // Initial state already represents startup; keep state writes after the network boundary.
    let active = true;
    void refreshSession()
      .then(() => request('/auth/me'))
      .then((result) => {
        if (active) setUser(profileSchema.parse(result.data));
      })
      .catch((error: unknown) => {
        if (!active) return;
        reset();
        if (!(error instanceof ApiError && error.status === 401))
          setStartupError(errorMessage(error));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    const unsubscribe = onSessionExpired(reset);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [reset]);
  useEffect(() => {
    if (!('BroadcastChannel' in window)) return;
    const channel = new BroadcastChannel('sunvika-session');
    channel.onmessage = (event: MessageEvent<unknown>) => {
      if (event.data === 'signed-out') reset();
    };
    return () => channel.close();
  }, [reset]);
  useEffect(() => {
    if (!user) return;
    const updateProfile = () => {
      if (document.visibilityState === 'visible')
        void request('/auth/me')
          .then((result) => setUser(profileSchema.parse(result.data)))
          .catch(() => {
            /* API client handles session expiry. */
          });
    };
    document.addEventListener('visibilitychange', updateProfile);
    return () => document.removeEventListener('visibilitychange', updateProfile);
  }, [user]);
  async function login(email: string, password: string) {
    reset();
    const result = await request('/auth/login', {
      method: 'POST',
      body: { email: email.trim().toLowerCase(), password },
      anonymous: true,
    });
    setCredentials(result.data);
    try {
      const me = await request('/auth/me');
      setUser(profileSchema.parse(me.data));
      setStartupError(null);
    } catch (error) {
      reset();
      throw error;
    }
  }
  async function logout(all = false) {
    // A failed server logout is surfaced so the user knows the cookie session is still active.
    await request(all ? '/auth/logout-all' : '/auth/logout', { method: 'POST', csrf: !all });
    reset();
    if ('BroadcastChannel' in window) {
      const channel = new BroadcastChannel('sunvika-session');
      channel.postMessage('signed-out');
      channel.close();
    }
  }
  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        startupError,
        reload,
        login,
        logout,
        can: (...permissions) =>
          permissions.every((permission) =>
            user?.grants.some((grant) => grant.permission === permission),
          ),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
