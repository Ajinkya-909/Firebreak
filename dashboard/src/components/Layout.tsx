import { Activity, FlaskConical, LayoutDashboard, LogOut, Menu, Monitor, Moon, Server, Sun, X } from 'lucide-react';
import { Suspense, useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { API_MODE } from '../api/client';
import { useIncidents } from '../api/hooks';
import { ACTIVE_STATUSES } from '../api/types';
import { useAuthState } from '../auth/context';
import { useTheme, type ThemeChoice } from '../lib/theme';
import { cx } from './ui';

export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="8" fill="var(--critical)" />
      <path
        d="M17.5 5c.6 4.2-1.6 6.1-3.6 8.3-1.6 1.8-2.9 3.6-2.9 6.2a5 5 0 0 0 10 0c0-1.5-.5-2.8-1.3-4 2.6.9 4.3 3.4 4.3 6.3A8 8 0 0 1 8 21.6c0-4.3 2.3-6.7 4.6-9C14.6 10.6 16.5 8.6 17.5 5Z"
        fill="#fff"
      />
    </svg>
  );
}

function ActiveCount() {
  const { data } = useIncidents({ limit: 200 });
  const n = data?.filter((i) => ACTIVE_STATUSES.includes(i.status)).length ?? 0;
  if (!n) return null;
  return (
    <span className="ml-auto rounded-full bg-critical px-1.5 py-px text-[11px] font-semibold text-white tabular" aria-label={`${n} active`}>
      {n}
    </span>
  );
}

const NAV = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/incidents', label: 'Incidents', icon: Activity, badge: true },
  { to: '/services', label: 'Services', icon: Server },
  { to: '/evaluation', label: 'Evaluation', icon: FlaskConical },
];

function Nav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Main" className="flex flex-col gap-0.5 px-3">
      {NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cx(
              'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
              isActive ? 'bg-surface-2 text-ink' : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
            )
          }
        >
          <item.icon className="size-4" aria-hidden />
          {item.label}
          {item.badge && <ActiveCount />}
        </NavLink>
      ))}
    </nav>
  );
}

const THEMES: Array<{ value: ThemeChoice; label: string; icon: typeof Sun }> = [
  { value: 'system', label: 'System', icon: Monitor },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
];

function UserMenu() {
  const { user, signOut, mode } = useAuthState();
  const { choice, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!user) return null;
  const initials = user.name.split(' ').map((p) => p[0]).join('').slice(0, 2);

  return (
    <div ref={ref} className="relative px-3">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-surface-2"
      >
        {user.imageUrl ? (
          <img src={user.imageUrl} alt="" className="size-7 rounded-full" />
        ) : (
          <span className="grid size-7 place-items-center rounded-full bg-accent-wash text-xs font-semibold text-accent-ink">{initials}</span>
        )}
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-ink">{user.name}</span>
          <span className="block truncate text-xs text-muted">{user.email}</span>
        </span>
      </button>
      {open && (
        <div className="absolute bottom-full left-3 right-3 mb-2 rounded-xl border border-line bg-surface p-3 shadow-lg">
          <p className="text-xs font-medium text-ink-2" id="theme-label">
            Theme
          </p>
          <div role="radiogroup" aria-labelledby="theme-label" className="mt-2 grid grid-cols-3 gap-1 rounded-lg bg-surface-2 p-1">
            {THEMES.map((t) => (
              <button
                key={t.value}
                type="button"
                role="radio"
                aria-checked={choice === t.value}
                onClick={() => setTheme(t.value)}
                className={cx(
                  'flex flex-col items-center gap-1 rounded-md py-1.5 text-[11px] font-medium',
                  choice === t.value ? 'bg-surface text-ink shadow-card' : 'text-ink-2 hover:text-ink',
                )}
              >
                <t.icon className="size-3.5" aria-hidden />
                {t.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => signOut()}
            className="mt-3 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-ink-2 hover:bg-surface-2 hover:text-ink"
          >
            <LogOut className="size-4" aria-hidden />
            Sign out{mode === 'demo' && ' of demo'}
          </button>
        </div>
      )}
    </div>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      <div className="flex items-center gap-2.5 px-5 pb-5 pt-5">
        <Logo className="size-7" />
        <span className="text-[15px] font-semibold tracking-tight text-ink">Firebreak</span>
      </div>
      <Nav onNavigate={onNavigate} />
      <div className="mt-auto pb-4">
        {API_MODE === 'mock' && (
          <p className="mx-5 mb-3 rounded-lg border border-dashed border-line-strong px-3 py-2 text-[11px] leading-snug text-ink-2">
            <span className="font-semibold text-ink">Demo data.</span> Responses come from an in-browser mock of the Firebreak API.
          </p>
        )}
        <UserMenu />
      </div>
    </>
  );
}

export function Layout() {
  const [drawer, setDrawer] = useState(false);
  const location = useLocation();
  useEffect(() => setDrawer(false), [location.pathname]);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[15rem_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line bg-surface lg:flex">
        <SidebarContent />
      </aside>

      {/* Phone/tablet: top bar + drawer */}
      <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-surface px-4 py-3 lg:hidden">
        <button type="button" onClick={() => setDrawer(true)} className="rounded-lg p-1.5 text-ink-2 hover:bg-surface-2" aria-label="Open menu">
          <Menu className="size-5" />
        </button>
        <Logo className="size-6" />
        <span className="font-semibold text-ink">Firebreak</span>
      </div>
      {drawer && (
        <div className="fixed inset-0 z-30 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawer(false)} aria-hidden />
          <aside className="relative flex h-full w-72 max-w-[85vw] flex-col bg-surface">
            <button
              type="button"
              onClick={() => setDrawer(false)}
              className="absolute right-3 top-4 rounded-lg p-1.5 text-ink-2 hover:bg-surface-2"
              aria-label="Close menu"
            >
              <X className="size-5" />
            </button>
            <SidebarContent onNavigate={() => setDrawer(false)} />
          </aside>
        </div>
      )}

      <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <div className="mx-auto max-w-7xl">
          <Suspense fallback={<div className="h-8 w-48 animate-pulse rounded-md bg-surface-2" aria-label="Loading page" />}>
            <Outlet />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
