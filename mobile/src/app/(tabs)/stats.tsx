import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";

import BarList from "@/components/BarList";
import PlaceList from "@/components/PlaceList";
import { reportStyles } from "@/components/ScanReport";
import WeeklyChart from "@/components/WeeklyChart";
import { colors } from "@/constants/colors";
import { useAuth } from "@/hooks/useAuth";
import { ApiError, getStats, type UserStats } from "@/services/api";
import { categoryLabels } from "@/utils/labels";
import { verdictColors, verdictLabels } from "@/utils/verdict";

export default function StatsScreen() {
  const { token, signOut } = useAuth();

  const [stats, setStats] = useState<UserStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (token === null) return;
    try {
      const data = await getStats(token);
      setStats(data);
      setError(null);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) {
        await signOut();
        return;
      }
      setError(cause instanceof Error ? cause.message : "Une erreur est survenue.");
    } finally {
      setRefreshing(false);
    }
  }, [token, signOut]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const verdictRows =
    stats === null
      ? []
      : stats.verdicts
          .filter((entry) => entry.verdict === "dangerous" || entry.verdict === "suspicious" || entry.verdict === "safe")
          .map((entry) => ({
            key: entry.verdict,
            label: verdictLabels[entry.verdict],
            count: entry.count,
            color: verdictColors[entry.verdict],
          }));

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void load();
          }}
          tintColor={colors.primary}
        />
      }
    >
      {stats === null && error === null ? <ActivityIndicator style={styles.loader} color={colors.primary} /> : null}
      {error !== null ? <Text style={styles.message}>{error}</Text> : null}

      {stats !== null && stats.total_scans === 0 ? (
        <Text style={styles.message}>Vos statistiques apparaîtront après votre premier scan.</Text>
      ) : null}

      {stats !== null && stats.total_scans > 0 ? (
        <>
          <View style={styles.cards}>
            <View style={[styles.card, styles.half]}>
              <Text style={styles.cardLabel}>Scans</Text>
              <Text style={styles.big}>{stats.total_scans}</Text>
            </View>
            <View style={[styles.card, styles.half]}>
              <Text style={styles.cardLabel}>QR codes à risque</Text>
              <Text style={[styles.big, stats.flagged_percent > 0 && styles.flagged]}>
                {`${stats.flagged_percent} %`}
              </Text>
              <Text style={styles.small}>{`${stats.flagged_scans} sur ${stats.total_scans}`}</Text>
            </View>
          </View>

          <WeeklyChart weeks={stats.weekly} />

          <BarList title="Verdicts" rows={verdictRows} />

          <BarList
            title="Types de QR codes"
            rows={stats.categories.map((entry) => ({
              key: entry.category,
              label: categoryLabels[entry.category],
              count: entry.count,
            }))}
          />

          <BarList
            title="Sites les plus scannés"
            rows={stats.top_domains.map((entry) => ({
              key: entry.domain,
              label: entry.domain,
              count: entry.count,
            }))}
          />

          <PlaceList places={stats.places} />
        </>
      ) : null}

      <TouchableOpacity style={reportStyles.secondaryButton} activeOpacity={0.8} onPress={() => void signOut()}>
        <Text style={reportStyles.secondaryButtonText}>Se déconnecter</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    gap: 14,
    paddingBottom: 32,
  },
  loader: {
    marginTop: 24,
  },
  message: {
    marginTop: 24,
    fontSize: 15,
    color: colors.textMuted,
    textAlign: "center",
  },
  cards: {
    flexDirection: "row",
    gap: 14,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 6,
  },
  half: {
    flex: 1,
  },
  cardLabel: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: colors.textMuted,
  },
  big: {
    fontSize: 30,
    fontWeight: "800",
    color: colors.text,
  },
  flagged: {
    color: colors.suspicious,
  },
  small: {
    fontSize: 12,
    color: colors.textMuted,
  },
});
