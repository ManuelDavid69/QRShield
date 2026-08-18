import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import MapFrame from "@/components/MapFrame";
import { colors } from "@/constants/colors";
import { ApiError, getZones, type Zone } from "@/services/api";
import { buildMapHtml } from "@/utils/mapHtml";

export default function MapScreen() {
  const [zones, setZones] = useState<Zone[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      getZones()
        .then((list) => {
          setZones(list.zones);
          setError(null);
        })
        .catch((cause: unknown) => {
          setError(cause instanceof ApiError ? cause.message : "Une erreur est survenue.");
        });
    }, []),
  );

  const html = useMemo(() => (zones === null ? null : buildMapHtml(zones)), [zones]);

  if (html === null) {
    return (
      <View style={styles.centered}>
        {error !== null ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator color={colors.primary} />}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapFrame html={html} />
      <View style={styles.legend}>
        <View style={styles.legendRow}>
          <View style={[styles.dot, { backgroundColor: colors.dangerous }]} />
          <Text style={styles.legendText}>Majorité de liens dangereux</Text>
        </View>
        <View style={styles.legendRow}>
          <View style={[styles.dot, { backgroundColor: colors.suspicious }]} />
          <Text style={styles.legendText}>Majorité de liens suspects</Text>
        </View>
        <Text style={styles.note}>
          Signalements anonymes des 90 derniers jours. Une zone apparaît à partir de deux signalements.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: colors.background,
  },
  error: {
    fontSize: 15,
    textAlign: "center",
    color: colors.textMuted,
  },
  legend: {
    padding: 14,
    gap: 6,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: 14,
    color: colors.text,
  },
  note: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
  },
});
