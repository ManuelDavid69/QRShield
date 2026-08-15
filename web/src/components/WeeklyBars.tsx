import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CommunityStats } from "../services/api";

type WeeklyPoint = CommunityStats["weekly"][number];

interface WeeklyBarsProps {
  weekly: CommunityStats["weekly"];
}

interface WeeklyTooltipProps {
  active?: boolean;
  payload?: { payload?: WeeklyPoint }[];
}

function formatShortDate(isoDate: string): string {
  return `${isoDate.slice(8, 10)}/${isoDate.slice(5, 7)}`;
}

function WeeklyTooltip({ active, payload }: WeeklyTooltipProps) {
  const point = payload?.[0]?.payload;
  if (!active || !point) {
    return null;
  }

  return (
    <div className="chart-tooltip">
      <p>Semaine du {formatShortDate(point.week_start)}</p>
      <p>
        <strong>{point.count.toLocaleString("fr-FR")}</strong> signalements
      </p>
    </div>
  );
}

export default function WeeklyBars({ weekly }: WeeklyBarsProps) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={weekly} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--grid)" />
        <XAxis
          dataKey="week_start"
          tickFormatter={formatShortDate}
          tickLine={false}
          axisLine={{ stroke: "var(--grid)" }}
          minTickGap={24}
          tick={{ fill: "var(--muted)", fontSize: 12 }}
        />
        <YAxis
          allowDecimals={false}
          width={32}
          axisLine={false}
          tickLine={false}
          tick={{ fill: "var(--muted)", fontSize: 12 }}
        />
        <Tooltip content={<WeeklyTooltip />} cursor={{ fill: "var(--grid)", opacity: 0.5 }} />
        <Bar
          dataKey="count"
          fill="var(--accent)"
          radius={[4, 4, 0, 0]}
          maxBarSize={28}
          isAnimationActive={false}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
