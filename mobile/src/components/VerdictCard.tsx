import { StyleSheet, Text, View } from "react-native";

import { colors } from "@/constants/colors";
import type { Verdict } from "@/services/api";
import { verdictAdvice, verdictColors, verdictLabels } from "@/utils/verdict";

interface VerdictCardProps {
  verdict: Verdict;
  score: number | null;
}

export default function VerdictCard({ verdict, score }: VerdictCardProps) {
  const tint = verdictColors[verdict];
  // Annote le type car ViewStyle["width"] n'accepte que `${number}%`
  const fillWidth: `${number}%` = `${score ?? 0}%`;

  return (
    <View
      style={[styles.card, { borderColor: tint }]}
      accessibilityLabel={
        score === null
          ? verdictLabels[verdict]
          : `${verdictLabels[verdict]}, score ${score} sur 100`
      }
    >
      <View style={styles.header}>
        <Text style={[styles.label, { color: tint }]}>{verdictLabels[verdict]}</Text>
        {score !== null ? <Text style={[styles.score, { color: tint }]}>{score}/100</Text> : null}
      </View>

      {score !== null ? (
        <View style={styles.track}>
          <View style={[styles.fill, { width: fillWidth, backgroundColor: tint }]} />
        </View>
      ) : null}

      <Text style={styles.advice}>{verdictAdvice[verdict]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 2,
    padding: 16,
    gap: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  label: {
    flex: 1,
    fontSize: 20,
    fontWeight: "700",
  },
  score: {
    fontSize: 15,
    fontWeight: "700",
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
  advice: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
});
