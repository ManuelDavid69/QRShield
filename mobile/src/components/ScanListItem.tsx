import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { colors } from "@/constants/colors";
import type { Scan } from "@/services/api";
import { formatScanDate, scanTitle } from "@/utils/labels";
import { verdictColors, verdictLabels } from "@/utils/verdict";

interface ScanListItemProps {
  scan: Scan;
  onPress: () => void;
}

export default function ScanListItem({ scan, onPress }: ScanListItemProps) {
  const score = scan.analysis?.score;
  const verdictColor = verdictColors[scan.verdict];

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.8} onPress={onPress}>
      <View style={[styles.dot, { backgroundColor: verdictColor }]} />
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {scanTitle(scan)}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {`${verdictLabels[scan.verdict]} · ${formatScanDate(scan.scanned_at)}`}
        </Text>
      </View>
      {score !== null && score !== undefined ? (
        <Text style={[styles.score, { color: verdictColor }]}>{`${score}/100`}</Text>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  body: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textMuted,
  },
  score: {
    fontSize: 13,
    fontWeight: "700",
  },
});
