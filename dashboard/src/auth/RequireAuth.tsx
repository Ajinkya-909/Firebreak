import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuthState } from './context';

export function RequireAuth() {
  const { isLoaded, user } = useAuthState();
  const location = useLocation();
  if (!isLoaded) {
    return <div className="grid min-h-dvh place-items-center text-sm text-muted">Loading…</div>;
  }
  if (!user) return <Navigate to="/sign-in" replace state={{ from: location.pathname + location.search }} />;
  return <Outlet />;
}
