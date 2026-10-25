import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { axisTick, ChartTable, TooltipCard } from './ChartParts';

export interface MttrDay {
  day: string;
  minutes: number | null; // median time to resolve; null when nothing resolved that day
  resolved: number;
}

/** Single series: the card title names it, so there is no legend box. */
export function MttrChart({ data }: { data: MttrDay[] }) {
  const lastIdx = data.findLastIndex((d) => d.minutes != null);
  return (
    <div>
      <div className="h-60">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 12, right: 12, bottom: 0, left: -20 }}>
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis dataKey="day" tick={axisTick} tickLine={false} axisLine={{ stroke: 'var(--line-strong)' }} interval="preserveStartEnd" minTickGap={16} />
            <YAxis tick={axisTick} tickLine={false} axisLine={false} unit="m" />
            <Tooltip
              cursor={{ stroke: 'var(--line-strong)', strokeWidth: 1 }}
              content={({ active, payload, label }) => {
                const d = active ? (payload?.[0]?.payload as MttrDay | undefined) : undefined;
                return d ? (
                  <TooltipCard
                    title={label}
                    rows={[
                      { label: 'Median time to resolve', value: d.minutes == null ? 'n/a' : `${d.minutes}m`, color: 'var(--series-1)' },
                      { label: 'Resolved', value: d.resolved },
                    ]}
                  />
                ) : null;
              }}
            />
            <Line
              type="monotone"
              dataKey="minutes"
              stroke="var(--series-1)"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              connectNulls
              isAnimationActive={false}
              dot={(p: { cx?: number; cy?: number; index?: number }) =>
                p.index === lastIdx && p.cx != null && p.cy != null ? (
                  <circle key="end" cx={p.cx} cy={p.cy} r={4} fill="var(--series-1)" stroke="var(--surface)" strokeWidth={2} />
                ) : (
                  <g key={p.index} />
                )
              }
              activeDot={{ r: 5, fill: 'var(--series-1)', stroke: 'var(--surface)', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <ChartTable
        caption="Median time to resolve per day"
        columns={['Day', 'Median (min)', 'Resolved']}
        rows={data.map((d) => [d.day, d.minutes ?? '—', d.resolved])}
      />
    </div>
  );
}
