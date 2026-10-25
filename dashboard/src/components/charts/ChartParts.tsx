import { useId, useState, type ReactNode } from 'react';
import { cx } from '../ui';

export interface SeriesDef {
  key: string;
  label: string;
  color: string; // CSS var reference, e.g. var(--series-1)
}

/** Legend above the plot; identity never relies on color alone. */
export function Legend({ series }: { series: SeriesDef[] }) {
  if (series.length < 2) return null;
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
      {series.map((s) => (
        <li key={s.key} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: s.color }} aria-hidden />
          {s.label}
        </li>
      ))}
    </ul>
  );
}

export function TooltipCard({ title, rows }: { title: ReactNode; rows: Array<{ label: string; value: ReactNode; color?: string }> }) {
  return (
    <div className="min-w-36 rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-medium text-ink">{title}</p>
      {rows.map((r) => (
        <p key={r.label} className="flex items-center justify-between gap-4 text-ink-2">
          <span className="flex items-center gap-1.5">
            {r.color && <span className="size-2 rounded-sm" style={{ background: r.color }} aria-hidden />}
            {r.label}
          </span>
          <span className="font-medium text-ink tabular">{r.value}</span>
        </p>
      ))}
    </div>
  );
}

/** Every chart ships a table view for screen readers, print, and exact values. */
export function ChartTable({ caption, columns, rows }: { caption: string; columns: string[]; rows: Array<Array<ReactNode>> }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="mt-3">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="text-xs font-medium text-accent-ink hover:underline"
      >
        {open ? 'Hide table' : 'Show as table'}
      </button>
      <div id={id} hidden={!open} className="mt-2 max-h-64 overflow-auto rounded-lg border border-line">
        <table className="w-full text-xs">
          <caption className="sr-only">{caption}</caption>
          <thead className="sticky top-0 bg-surface-2 text-left text-ink-2">
            <tr>
              {columns.map((c, i) => (
                <th key={c} scope="col" className={cx('px-3 py-1.5 font-medium', i > 0 && 'text-right')}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r, ri) => (
              <tr key={ri}>
                {r.map((cell, ci) => (
                  <td key={ci} className={cx('px-3 py-1.5 text-ink', ci > 0 && 'text-right tabular')}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Column path with a 4px rounded data-end and a square baseline. */
export function roundedTopPath(x: number, y: number, w: number, h: number, r = 4): string {
  if (h <= 0 || w <= 0) return '';
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

export const axisTick = { fill: 'var(--muted)', fontSize: 11 };
