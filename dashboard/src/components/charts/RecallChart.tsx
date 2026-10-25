import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis, type BarShapeProps } from 'recharts';
import { humanize } from '../../lib/format';
import { axisTick, ChartTable, TooltipCard } from './ChartParts';

export interface RecallRow {
  faultType: string;
  detected: number;
  total: number;
  recall: number;
}

// Horizontal bar with a 4px rounded data-end and a square baseline.
function HBar(props: BarShapeProps) {
  const { x = 0, y = 0, width = 0, height = 0 } = props as { x?: number; y?: number; width?: number; height?: number };
  if (width <= 0) return <g />;
  const r = Math.min(4, height / 2, width);
  const d = `M${x},${y}H${x + width - r}Q${x + width},${y} ${x + width},${y + r}V${y + height - r}Q${x + width},${y + height} ${x + width - r},${y + height}H${x}Z`;
  return <path d={d} fill="var(--series-1)" />;
}

/** Single series (recall per fault type); the card title names it, so no legend. */
export function RecallChart({ data }: { data: RecallRow[] }) {
  const rows = data.map((d) => ({ ...d, label: humanize(d.faultType), pct: Math.round(d.recall * 100) }));
  return (
    <div>
      <div style={{ height: Math.max(120, rows.length * 40 + 30) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 48, bottom: 0, left: 8 }} barCategoryGap="35%">
            <CartesianGrid horizontal={false} stroke="var(--line)" />
            <XAxis type="number" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} unit="%" tick={axisTick} tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey="label" width={120} tick={{ ...axisTick, fill: 'var(--ink-2)' }} tickLine={false} axisLine={{ stroke: 'var(--line-strong)' }} />
            <Tooltip
              cursor={{ fill: 'var(--surface-2)' }}
              content={({ active, payload }) => {
                const d = active ? (payload?.[0]?.payload as (typeof rows)[number] | undefined) : undefined;
                return d ? (
                  <TooltipCard
                    title={d.label}
                    rows={[
                      { label: 'Recall', value: `${d.pct}%`, color: 'var(--series-1)' },
                      { label: 'Detected', value: `${d.detected} of ${d.total}` },
                    ]}
                  />
                ) : null;
              }}
            />
            <Bar dataKey="pct" maxBarSize={24} shape={HBar} isAnimationActive={false}>
              <LabelList dataKey="pct" position="right" formatter={(v: unknown) => `${v}%`} style={{ fill: 'var(--ink-2)', fontSize: 11 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ChartTable
        caption="Detection recall by fault type"
        columns={['Fault type', 'Detected', 'Injected', 'Recall']}
        rows={rows.map((r) => [r.label, r.detected, r.total, `${r.pct}%`])}
      />
    </div>
  );
}
