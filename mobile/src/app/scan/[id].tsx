import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";

import ScanReport, { reportStyles } from "@/components/ScanReport";
import { colors } from "@/constants/colors";
import { useAuth } from "@/hooks/useAuth";
import { ApiError, deleteScan, getScan, type Scan } from "@/services/api";
import { formatScanDate } from "@/utils/labels";
import { parseQrContent } from "@/utils/qrContent";

export default function ScanDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { token, signOut } = useAuth();

  const [scan, setScan] = useState<Scan | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token === null) return;
    let cancelled = false;
    getScan(token, id)
      .then((data) => {
        if (!cancelled) setScan(data);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        if (cause instanceof ApiError && cause.status === 401) {
          void signOut();
          return;
        }
        setError(cause instanceof Error ? cause.message : "Une erreur est survenue.");
      });
    return () => {
      cancelled = true;
    };
  }, [token, id, signOut]);

  const parsed = useMemo(() => (scan === null ? null : parseQrContent(scan.content)), [scan]);

  const handleDelete = useCallback(() => {
    Alert.alert("Supprimer ce scan ?", "Il disparaîtra de votre historique et de vos statistiques.", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: () => {
          if (token === null) return;
          void deleteScan(token, id)
            .then(() => router.back())
            .catch((cause: unknown) => {
              Alert.alert(
                "Suppression impossible",
                cause instanceof Error ? cause.message : "Une erreur est survenue.",
              );
            });
        },
      },
    ]);
  }, [token, id, router]);

  if (error !== null) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  if (scan === null || parsed === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <ScanReport
        parsed={parsed}
        analysis={scan.analysis}
        analyzing={false}
        header={
          <View style={reportStyles.card}>
            <Text style={reportStyles.cardLabel}>Scanné le</Text>
            <Text style={styles.date}>{formatScanDate(scan.scanned_at)}</Text>
          </View>
        }
        footer={
          <TouchableOpacity style={reportStyles.secondaryButton} activeOpacity={0.8} onPress={handleDelete}>
            <Text style={styles.deleteText}>Supprimer ce scan</Text>
          </TouchableOpacity>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
    padding: 24,
  },
  error: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: "center",
  },
  date: {
    fontSize: 17,
    fontWeight: "600",
    color: colors.text,
  },
  deleteText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.dangerous,
  },
});
