import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useLang } from "../i18n";
import type { CommunityStats } from "../services/api";

type WeeklyPoint = CommunityStats["weekly"][number];

interface WeeklyBarsProps {
  weekly: CommunityStats["weekly"];
}

interface WeeklyTooltipProps {
  active?: boolean;
  payload?: { payload?: WeeklyPoint }[];
}

function formatShortDate(isoDate: string, locale: string): string {
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString(locale, { month: "short", day: "numeric" });
}

function WeeklyTooltip({ active, payload }: WeeklyTooltipProps) {
  const { locale, t } = useLang();
  const point = payload?.[0]?.payload;
  if (!active || !point) {
    return null;
  }

  return (
    <div className="chart-tooltip">
      <p>{t.weekOf(formatShortDate(point.week_start, locale))}</p>
      <p>
        <strong>{point.count.toLocaleString(locale)}</strong> {t.reports}
      </p>
    </div>
  );
}

export default function WeeklyBars({ weekly }: WeeklyBarsProps) {
  const { locale } = useLang();

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={weekly} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--grid)" />
        <XAxis
          dataKey="week_start"
          tickFormatter={(value: string) => formatShortDate(value, locale)}
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
          radius={[2, 2, 0, 0]}
          maxBarSize={28}
          isAnimationActive={false}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
