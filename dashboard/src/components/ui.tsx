import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  CircleDot,
  Clock3,
  FlaskConical,
  Info,
  Loader2,
  Search,
  VolumeX,
  type LucideIcon,
} from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { ApiError } from '../api/client';
import type { IncidentStatus, Severity } from '../api/types';

export const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ');

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cx('rounded-xl border border-line bg-surface shadow-card', className)}>{children}</section>;
}

export function CardHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-ink">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-ink-2">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  variant = 'secondary',
  size = 'md',
  loading,
  icon: Icon,
  className,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: 'sm' | 'md'; loading?: boolean; icon?: LucideIcon }) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60',
        size === 'sm' ? 'h-8 px-2.5 text-xs' : 'h-9 px-3.5 text-sm',
        variant === 'primary' && 'bg-ink text-page hover:opacity-90',
        variant === 'secondary' && 'border border-line-strong bg-surface text-ink hover:bg-surface-2',
        variant === 'ghost' && 'text-ink-2 hover:bg-surface-2 hover:text-ink',
        variant === 'danger' && 'border border-line-strong bg-surface text-critical-ink hover:bg-surface-2',
        className,
      )}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : Icon && <Icon className="size-4" aria-hidden />}
      {children}
    </button>
  );
}

// Severity is a state: reserved status colors, always with an icon and a label.
const SEVERITY: Record<Severity, { icon: LucideIcon; color: string; label: string }> = {
  SEV1: { icon: AlertOctagon, color: 'text-critical', label: 'SEV1' },
  SEV2: { icon: AlertTriangle, color: 'text-serious', label: 'SEV2' },
  SEV3: { icon: Info, color: 'text-warning', label: 'SEV3' },
};

export function SeverityBadge({ severity }: { severity: Severity | null }) {
  if (!severity) return <span className="text-xs text-muted">—</span>;
  const s = SEVERITY[severity];
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-1.5 py-0.5 text-xs font-semibold text-ink">
      <s.icon className={cx('size-3.5', s.color)} aria-hidden strokeWidth={2.5} />
      {s.label}
    </span>
  );
}

const STATUS: Record<IncidentStatus, { icon: LucideIcon; label: string; tone: string; spin?: boolean }> = {
  triaging: { icon: Loader2, label: 'Triaging', tone: 'text-accent', spin: true },
  open: { icon: CircleDot, label: 'Open', tone: 'text-critical' },
  investigating: { icon: Search, label: 'Investigating', tone: 'text-accent' },
  verifying: { icon: FlaskConical, label: 'Verifying fix', tone: 'text-accent' },
  awaiting_recovery: { icon: Clock3, label: 'Awaiting recovery', tone: 'text-serious' },
  resolved: { icon: CheckCircle2, label: 'Resolved', tone: 'text-good' },
  noise: { icon: VolumeX, label: 'Noise', tone: 'text-muted' },
};

export function StatusBadge({ status }: { status: IncidentStatus }) {
  const s = STATUS[status];
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-ink-2">
      <s.icon className={cx('size-3.5', s.tone, s.spin && 'animate-spin')} aria-hidden />
      {s.label}
    </span>
  );
}

export const statusLabel = (s: IncidentStatus) => STATUS[s].label;

export function StatTile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: 'critical' | 'good';
}) {
  return (
    <Card className="px-5 py-4">
      <p className="text-xs font-medium text-ink-2">{label}</p>
      <p className={cx('mt-1.5 text-2xl font-semibold tracking-tight', tone === 'critical' ? 'text-critical-ink' : 'text-ink')}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </Card>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-pulse rounded-md bg-surface-2', className)} aria-hidden />;
}

export function EmptyState({ icon: Icon = CircleDashed, title, children }: { icon?: LucideIcon; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <Icon className="size-6 text-muted" aria-hidden />
      <p className="mt-3 text-sm font-medium text-ink">{title}</p>
      {children && <div className="mt-1 max-w-sm text-sm text-ink-2">{children}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof ApiError ? error.message : error instanceof Error ? error.message : 'Something went wrong';
  return (
    <div role="alert" className="flex flex-col items-center px-6 py-10 text-center">
      <AlertTriangle className="size-6 text-critical" aria-hidden />
      <p className="mt-3 text-sm font-medium text-ink">Couldn’t load this data</p>
      <p className="mt-1 text-sm text-ink-2">{message}</p>
      {onRetry && (
        <Button className="mt-4" size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function Code({ children }: { children: ReactNode }) {
  return <code className="rounded bg-code px-1.5 py-0.5 font-mono text-[0.8em] text-ink">{children}</code>;
}

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-ink">{label}</span>
      <div className="mt-1">{children}</div>
      {error ? <span className="mt-1 block text-xs text-critical-ink">{error}</span> : hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export const inputClass =
  'block h-9 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink placeholder:text-muted focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30';
