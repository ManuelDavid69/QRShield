import { StyleSheet, Text, View } from "react-native";

import { colors } from "@/constants/colors";
import { barWidth } from "@/utils/labels";

interface BarRow {
  key: string;
  label: string;
  count: number;
  color?: string;
}

interface BarListProps {
  title: string;
  rows: BarRow[];
}

export default function BarList({ title, rows }: BarListProps) {
  if (rows.length === 0) return null;

  const max = rows.reduce((acc, row) => Math.max(acc, row.count), 0);

  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>{title}</Text>
      {rows.map((row) => (
        <View key={row.key} style={styles.row}>
          <View style={styles.line}>
            <Text style={styles.label} numberOfLines={1}>
              {row.label}
            </Text>
            <Text style={styles.count}>{row.count}</Text>
          </View>
          <View style={styles.track}>
            <View
              style={[
                styles.fill,
                {
                  width: `${barWidth(row.count, max)}%`,
                  backgroundColor: row.color ?? colors.primary,
                },
              ]}
            />
          </View>
        </View>
      ))}
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
  row: {
    gap: 6,
  },
  line: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  label: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  count: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text,
  },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
    overflow: "hidden",
  },
  fill: {
    height: 8,
    borderRadius: 4,
  },
});
