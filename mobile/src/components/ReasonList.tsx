import { StyleSheet, Text, View } from "react-native";

import { colors } from "@/constants/colors";
import { reasonText } from "@/i18n/reasons";
import type { Reason } from "@/services/api";
import { severityColors } from "@/utils/verdict";
import { t } from "@/i18n";

interface ReasonListProps {
  reasons: Reason[];
}

export default function ReasonList({ reasons }: ReasonListProps) {
  if (reasons.length === 0) return null;

  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>{t.report.findings}</Text>
      {reasons.map((reason) => (
        <View key={reason.code} style={styles.row}>
          <View style={[styles.dot, { backgroundColor: severityColors[reason.severity] }]} />
          <Text style={styles.message}>{reasonText(reason)}</Text>
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
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 5,
  },
  message: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
});
