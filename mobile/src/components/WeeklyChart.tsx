import { StyleSheet, Text, View } from "react-native";

import { colors } from "@/constants/colors";
import { formatWeek } from "@/utils/labels";

interface WeeklyChartProps {
  weeks: { week_start: string; count: number }[];
}

export default function WeeklyChart({ weeks }: WeeklyChartProps) {
  const max = weeks.reduce((acc, week) => Math.max(acc, week.count), 0);
  const first = weeks.length > 0 ? weeks[0] : null;
  const last = weeks.length > 0 ? weeks[weeks.length - 1] : null;

  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>Scans par semaine</Text>
      <View style={styles.chart}>
        {weeks.map((week) => {
          const ratio = max === 0 ? 0 : week.count / max;
          return (
            <View key={week.week_start} style={styles.column}>
              <Text style={styles.count}>{week.count > 0 ? week.count : ""}</Text>
              <View style={styles.track}>
                <View
                  style={[
                    styles.bar,
                    { height: `${ratio * 100}%`, minHeight: week.count > 0 ? 2 : 0 },
                  ]}
                />
              </View>
            </View>
          );
        })}
      </View>
      <View style={styles.axis}>
        <Text style={styles.week}>{first === null ? "" : formatWeek(first.week_start)}</Text>
        <Text style={styles.week}>{last === null ? "" : formatWeek(last.week_start)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 12,
  },
  cardLabel: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: colors.textMuted,
  },
  chart: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 120,
    gap: 4,
  },
  column: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  count: {
    fontSize: 11,
    color: colors.textMuted,
    height: 16,
  },
  track: {
    width: "100%",
    height: 100,
    justifyContent: "flex-end",
  },
  bar: {
    width: "100%",
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  axis: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  week: {
    fontSize: 11,
    color: colors.textMuted,
  },
});
