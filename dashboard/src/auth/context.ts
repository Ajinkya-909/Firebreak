import { createContext, useContext } from 'react';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  imageUrl?: string;
}

export interface AuthState {
  mode: 'demo' | 'clerk';
  isLoaded: boolean;
  user: AuthUser | null;
  /** Demo mode only: check the demo credentials. Clerk renders its own sign-in UI. */
  signIn?: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthState | null>(null);

export function useAuthState(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthState must be used inside <AuthProvider>');
  return ctx;
}

export const CLERK_KEY: string | undefined = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || undefined;

export const DEMO_CREDENTIALS = { email: 'demo@firebreak.dev', password: 'firebreak-demo' };
