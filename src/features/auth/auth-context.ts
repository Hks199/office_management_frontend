import { createContext, useContext } from 'react';
import type { Profile } from '../../shared/types/api';
export interface AuthContextValue {
  user: Profile | null;
  loading: boolean;
  startupError: string | null;
  reload: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: (all?: boolean) => Promise<void>;
  can: (...permissions: string[]) => boolean;
}
export const AuthContext = createContext<AuthContextValue | null>(null);
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('AuthProvider missing');
  return context;
}
