import { lazy, Suspense, useMemo, useState, type ReactNode } from 'react';
import { configureApiAuth } from '../api/client';
import { AuthContext, CLERK_KEY, DEMO_CREDENTIALS, type AuthState, type AuthUser } from './context';

const STORAGE_KEY = 'firebreak.demoSession';

function readDemoSession(): AuthUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

function writeDemoSession(user: AuthUser | null) {
  try {
    if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage blocked (private mode, previews): the session just won't survive a reload.
  }
}

/** Demo sign-in: fixed credentials, session kept in this browser. Pairs with the mock API. */
function DemoAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(readDemoSession);

  const value = useMemo<AuthState>(() => {
    configureApiAuth({ getToken: async () => null, userId: user?.id ?? 'anonymous' });
    return {
      mode: 'demo',
      isLoaded: true,
      user,
      signIn: async (email, password) => {
        await new Promise((r) => setTimeout(r, 400));
        if (email.trim().toLowerCase() !== DEMO_CREDENTIALS.email || password !== DEMO_CREDENTIALS.password) {
          throw new Error('Those aren’t the demo credentials. Use the ones shown below the form.');
        }
        const next = { id: 'user_demo', name: 'Demo Engineer', email: DEMO_CREDENTIALS.email };
        writeDemoSession(next);
        setUser(next);
      },
      signOut: async () => {
        writeDemoSession(null);
        setUser(null);
      },
    };
  }, [user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

const ClerkAuthProvider = lazy(() => import('./clerk'));

export function AuthProvider({ children }: { children: ReactNode }) {
  if (!CLERK_KEY) return <DemoAuthProvider>{children}</DemoAuthProvider>;
  return (
    <Suspense fallback={<div className="grid min-h-dvh place-items-center text-sm text-muted">Loading…</div>}>
      <ClerkAuthProvider>{children}</ClerkAuthProvider>
    </Suspense>
  );
}
