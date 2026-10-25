import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type BarShapeProps } from 'recharts';
import { axisTick, ChartTable, Legend, roundedTopPath, TooltipCard, type SeriesDef } from './ChartParts';

export interface VerdictDay {
  day: string; // short label, e.g. "Oct 14"
  incidents: number;
  noise: number;
}

const SERIES: SeriesDef[] = [
  { key: 'incidents', label: 'Incidents', color: 'var(--series-1)' },
  { key: 'noise', label: 'Filtered as noise', color: 'var(--series-2)' },
];

// The top-most non-empty segment of each stack gets the rounded data-end; the 2px stroke in the
// surface color is the gap between stacked segments.
function segment(seriesKey: 'incidents' | 'noise', color: string) {
  return function Segment(props: BarShapeProps) {
    const { x = 0, y = 0, width = 0, height = 0 } = props as { x?: number; y?: number; width?: number; height?: number };
    const d = props.payload as VerdictDay;
    const isTop = seriesKey === 'noise' || d.noise === 0;
    const path = isTop ? roundedTopPath(x, y, width, height) : `M${x},${y}h${width}v${height}h${-width}Z`;
    return path ? <path d={path} fill={color} stroke="var(--surface)" strokeWidth={2} /> : <g />;
  };
}

export function VerdictsChart({ data }: { data: VerdictDay[] }) {
  return (
    <div>
      <Legend series={SERIES} />
      <div className="mt-3 h-60">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -24 }} barCategoryGap="30%">
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis dataKey="day" tick={axisTick} tickLine={false} axisLine={{ stroke: 'var(--line-strong)' }} interval="preserveStartEnd" minTickGap={16} />
            <YAxis allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} />
            <Tooltip
              cursor={{ fill: 'var(--surface-2)' }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <TooltipCard
                    title={label}
                    rows={[...SERIES].reverse().map((s) => ({ label: s.label, value: (payload[0]!.payload as VerdictDay)[s.key as 'noise'], color: s.color }))}
                  />
                ) : null
              }
            />
            <Bar dataKey="incidents" stackId="v" maxBarSize={24} shape={segment('incidents', 'var(--series-1)')} isAnimationActive={false} />
            <Bar dataKey="noise" stackId="v" maxBarSize={24} shape={segment('noise', 'var(--series-2)')} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ChartTable
        caption="Triage verdicts per day"
        columns={['Day', 'Incidents', 'Noise']}
        rows={data.map((d) => [d.day, d.incidents, d.noise])}
      />
    </div>
  );
}
