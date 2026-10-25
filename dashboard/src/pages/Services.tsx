import { Plus, Server } from 'lucide-react';
import { useRef, useState, type FormEvent, type RefObject } from 'react';
import { ApiError } from '../api/client';
import { useCreateService, useServices, useUpdateService } from '../api/hooks';
import type { NewService, Service } from '../api/types';
import { Button, Card, Code, cx, EmptyState, ErrorState, Field, inputClass, PageHeader, Skeleton } from '../components/ui';
import { pct, timeAgo } from '../lib/format';

function EnabledSwitch({ service }: { service: Service }) {
  const update = useUpdateService();
  const on = update.isPending ? !service.enabled : service.enabled;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={`Monitor ${service.name}`}
      disabled={update.isPending}
      onClick={() => update.mutate({ id: service.id, body: { enabled: !service.enabled } })}
      className={cx('relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors', on ? 'bg-good' : 'bg-surface-3')}
    >
      <span className={cx('inline-block size-4 rounded-full bg-white shadow transition-transform', on ? 'translate-x-4.5' : 'translate-x-0.5')} />
    </button>
  );
}

const EMPTY = { name: '', promSelector: '', lokiSelector: '', githubRepo: '', slackChannel: '', sloTarget: '99.9', verifyImage: '', verifyCommand: '' };

function RegisterDialog({ dialogRef }: { dialogRef: RefObject<HTMLDialogElement | null> }) {
  const create = useCreateService();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof typeof EMPTY) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const close = () => {
    dialogRef.current?.close();
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const slo = Number(form.sloTarget) / 100;
    if (!(slo > 0 && slo < 1)) return setError('SLO target must be between 0 and 100 (exclusive).');
    const body: NewService = {
      name: form.name.trim(),
      promSelector: form.promSelector.trim(),
      lokiSelector: form.lokiSelector.trim(),
      githubRepo: form.githubRepo.trim() || null,
      slackChannel: form.slackChannel.trim() || null,
      sloTarget: slo,
      verifyImage: form.verifyImage.trim() || null,
      verifyCommand: form.verifyCommand.trim() || null,
    };
    create.mutate(body, {
      onSuccess: () => {
        setForm(EMPTY);
        close();
      },
      onError: (err) =>
        setError(
          err instanceof ApiError
            ? err.status === 409
              ? `A service named “${body.name}” already exists.`
              : (err.issue ?? err.message)
            : 'Something went wrong.',
        ),
    });
  };

  return (
    // Esc closes it (default close request); no light-dismiss, so a stray click can't discard typed input.
    <dialog
      ref={dialogRef}
      aria-labelledby="register-title"
      onClose={() => setError(null)}
      className="m-auto w-[min(36rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-black/50"
    >
      <form onSubmit={onSubmit}>
        <div className="border-b border-line px-6 py-4">
          <h2 id="register-title" className="text-base font-semibold">
            Register a service
          </h2>
          <p className="mt-0.5 text-xs text-ink-2">Firebreak creates a Temporal detection schedule for it right away.</p>
        </div>
        <div className="grid max-h-[65dvh] gap-4 overflow-y-auto px-6 py-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Name" hint="Lowercase letters, digits and dashes">
              <input required value={form.name} onChange={set('name')} className={inputClass} placeholder="checkout" pattern="[a-z0-9][a-z0-9\-]{0,62}" autoComplete="off" />
            </Field>
          </div>
          <Field label="Prometheus label matcher" hint={'Without braces, e.g. job="checkout"'}>
            <input required value={form.promSelector} onChange={set('promSelector')} className={cx(inputClass, 'font-mono text-xs')} placeholder='job="checkout"' />
          </Field>
          <Field label="Loki stream selector" hint="With braces">
            <input required value={form.lokiSelector} onChange={set('lokiSelector')} className={cx(inputClass, 'font-mono text-xs')} placeholder='{app="checkout"}' />
          </Field>
          <Field label="GitHub repo" hint="owner/repo, used by the changes investigator">
            <input value={form.githubRepo} onChange={set('githubRepo')} className={inputClass} placeholder="acme/checkout" />
          </Field>
          <Field label="Slack channel">
            <input value={form.slackChannel} onChange={set('slackChannel')} className={inputClass} placeholder="#inc-checkout" />
          </Field>
          <Field label="SLO target (%)">
            <input required inputMode="decimal" value={form.sloTarget} onChange={set('sloTarget')} className={inputClass} />
          </Field>
          <div />
          <Field label="Verify image" hint="Optional. Container image used to test fixes">
            <input value={form.verifyImage} onChange={set('verifyImage')} className={inputClass} placeholder="ghcr.io/acme/ci:latest" />
          </Field>
          <Field label="Verify command">
            <input value={form.verifyCommand} onChange={set('verifyCommand')} className={inputClass} placeholder="make test" />
          </Field>
        </div>
        {error && (
          <p role="alert" className="mx-6 mb-1 rounded-lg bg-surface-2 px-3 py-2 text-sm text-critical-ink">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2 border-t border-line px-6 py-4">
          <Button type="button" variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={create.isPending}>
            Register service
          </Button>
        </div>
      </form>
    </dialog>
  );
}

export function Services() {
  const services = useServices();
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <PageHeader
        title="Services"
        description="What Firebreak watches. Each enabled service is checked against its seasonal baseline every minute."
        actions={
          <Button variant="primary" icon={Plus} onClick={() => dialogRef.current?.showModal()}>
            Register service
          </Button>
        }
      />
      <Card className="overflow-hidden">
        {services.error ? (
          <ErrorState error={services.error} onRetry={() => services.refetch()} />
        ) : !services.data ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : services.data.length === 0 ? (
          <EmptyState icon={Server} title="No services yet">
            Register a service to start detection.
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="border-b border-line bg-surface-2 text-left text-xs text-ink-2">
                <tr>
                  <th scope="col" className="px-5 py-2.5 font-medium">Service</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Telemetry</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Notifications</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">SLO</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Fix verification</th>
                  <th scope="col" className="px-5 py-2.5 text-right font-medium">Monitoring</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {services.data.map((s) => (
                  <tr key={s.id}>
                    <td className="px-5 py-3">
                      <p className="font-medium text-ink">{s.name}</p>
                      <p className="text-xs text-muted">{s.githubRepo ?? 'No repo linked'} · updated {timeAgo(s.updatedAt)}</p>
                    </td>
                    <td className="space-y-1 px-3 py-3 text-xs">
                      <p><span className="mr-1.5 text-muted">prom</span><Code>{s.promSelector}</Code></p>
                      <p><span className="mr-1.5 text-muted">loki</span><Code>{s.lokiSelector}</Code></p>
                    </td>
                    <td className="px-3 py-3 text-xs text-ink-2">{s.slackChannel ?? <span className="text-muted">Default channel</span>}</td>
                    <td className="px-3 py-3 text-right text-ink-2 tabular">{pct(s.sloTarget, s.sloTarget >= 0.999 ? 2 : 1)}</td>
                    <td className="px-3 py-3 text-xs text-ink-2">
                      {s.verifyCommand ? <Code>{s.verifyCommand}</Code> : <span className="text-muted">Not configured</span>}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-xs text-ink-2">{s.enabled ? 'On' : 'Paused'}</span>
                        <EnabledSwitch service={s} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <RegisterDialog dialogRef={dialogRef} />
    </>
  );
}
