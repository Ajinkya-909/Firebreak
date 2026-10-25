// Loaded only when VITE_CLERK_PUBLISHABLE_KEY is set, so demo mode never downloads Clerk.
import { ClerkProvider, SignIn, useAuth, useClerk, useUser } from '@clerk/react';
import { useMemo, type ReactNode } from 'react';
import { configureApiAuth } from '../api/client';
import { AuthContext, CLERK_KEY, type AuthState, type AuthUser } from './context';

/** Adapts Clerk's hooks to the app's AuthState and hands the session token to the API client. */
function ClerkBridge({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const clerk = useClerk();

  const value = useMemo<AuthState>(() => {
    const authUser: AuthUser | null =
      isSignedIn && user
        ? {
            id: user.id,
            name: user.fullName ?? user.username ?? 'Signed-in user',
            email: user.primaryEmailAddress?.emailAddress ?? '',
            imageUrl: user.imageUrl,
          }
        : null;
    configureApiAuth({ getToken: () => getToken(), userId: authUser?.id ?? 'anonymous' });
    return { mode: 'clerk', isLoaded, user: authUser, signOut: () => clerk.signOut() };
  }, [isLoaded, isSignedIn, user, getToken, clerk]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default function ClerkAuthProvider({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider publishableKey={CLERK_KEY!} afterSignOutUrl="/sign-in">
      <ClerkBridge>{children}</ClerkBridge>
    </ClerkProvider>
  );
}

export function ClerkSignInPanel() {
  return <SignIn routing="hash" fallbackRedirectUrl="/" />;
}
