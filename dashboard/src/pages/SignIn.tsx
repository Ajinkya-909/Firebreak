import { Activity, BrainCircuit, KeyRound, Timer } from 'lucide-react';
import { lazy, Suspense, useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { DEMO_CREDENTIALS, useAuthState } from '../auth/context';
import { Logo } from '../components/Layout';
import { Button, Field, inputClass } from '../components/ui';

const ClerkSignInPanel = lazy(() => import('../auth/clerk').then((m) => ({ default: m.ClerkSignInPanel })));

const POINTS = [
  { icon: Activity, title: 'Statistics first', body: 'Seasonal z-scores over Prometheus and Loki filter anomalies before any LLM call.' },
  { icon: BrainCircuit, title: 'AI triage and root cause', body: 'ADK agents correlate signals, recall past incidents, and propose a verified fix.' },
  { icon: Timer, title: 'Two reports per incident', body: 'An initial report within about 2 minutes, a final report once metrics recover.' },
];

function DemoForm() {
  const { signIn } = useAuthState();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await signIn!(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError((err as Error).message);
      setPending(false);
    }
  };

  return (
    <div className="w-full max-w-sm">
      <h2 className="text-lg font-semibold text-ink">Sign in to the dashboard</h2>
      <p className="mt-1 text-sm text-ink-2">This is a demo. Data comes from a mock of the Firebreak API.</p>

      <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
        <Field label="Email">
          <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="you@company.com" />
        </Field>
        <Field label="Password">
          <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
        </Field>
        {error && (
          <p role="alert" className="rounded-lg bg-surface-2 px-3 py-2 text-sm text-critical-ink">
            {error}
          </p>
        )}
        <Button type="submit" variant="primary" loading={pending} className="w-full">
          Sign in
        </Button>
      </form>

      <div className="mt-6 rounded-xl border border-dashed border-line-strong p-4">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-ink">
          <KeyRound className="size-3.5" aria-hidden />
          Demo credentials
        </p>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          <dt className="text-muted">Email</dt>
          <dd className="font-mono text-ink">{DEMO_CREDENTIALS.email}</dd>
          <dt className="text-muted">Password</dt>
          <dd className="font-mono text-ink">{DEMO_CREDENTIALS.password}</dd>
        </dl>
        <Button
          size="sm"
          className="mt-3"
          onClick={() => {
            setEmail(DEMO_CREDENTIALS.email);
            setPassword(DEMO_CREDENTIALS.password);
            setError(null);
          }}
        >
          Fill in demo credentials
        </Button>
      </div>
      <p className="mt-6 text-xs text-muted">
        To use real sign-in, set <span className="font-mono">VITE_CLERK_PUBLISHABLE_KEY</span> and the dashboard switches to Clerk.
      </p>
    </div>
  );
}

export function SignIn() {
  const { mode, user, isLoaded } = useAuthState();
  if (isLoaded && user) return <Navigate to="/" replace />;

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <section className="hidden flex-col justify-between border-r border-line bg-surface px-12 py-10 lg:flex">
        <div className="flex items-center gap-2.5">
          <Logo className="size-8" />
          <span className="text-lg font-semibold tracking-tight text-ink">Firebreak</span>
        </div>
        <div className="max-w-md">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight text-ink">Catch incidents before your users do.</h1>
          <ul className="mt-8 space-y-6">
            {POINTS.map((p) => (
              <li key={p.title} className="flex gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-2">
                  <p.icon className="size-4 text-ink-2" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-semibold text-ink">{p.title}</p>
                  <p className="mt-0.5 text-sm text-ink-2">{p.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-muted">Temporal · Google ADK · Supermemory · Postgres</p>
      </section>

      <section className="flex flex-col items-center justify-center px-4 py-12 sm:px-8">
        <div className="mb-8 flex items-center gap-2.5 lg:hidden">
          <Logo className="size-8" />
          <span className="text-lg font-semibold tracking-tight text-ink">Firebreak</span>
        </div>
        {mode === 'clerk' ? (
          <Suspense fallback={<p className="text-sm text-muted">Loading sign-in…</p>}>
            <ClerkSignInPanel />
          </Suspense>
        ) : (
          <DemoForm />
        )}
      </section>
    </div>
  );
}
