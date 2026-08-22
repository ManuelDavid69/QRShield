import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { reportStyles } from "@/components/ScanReport";
import { colors } from "@/constants/colors";
import { useAlerts } from "@/hooks/useAlerts";
import { useAuth } from "@/hooks/useAuth";
import { ApiError, getMe, type Account, type AppNotification } from "@/services/api";
import { formatScanDate } from "@/utils/labels";

export default function AccountScreen() {
  const { token, signOut } = useAuth();
  const [account, setAccount] = useState<Account | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { alerts, refresh, markRead } = useAlerts();

  function openAlert(alert: AppNotification) {
    void markRead(alert.id);
    if (alert.scan_id !== null) router.push({ pathname: "/scan/[id]", params: { id: alert.scan_id } });
  }

  useFocusEffect(
    useCallback(() => {
      if (token === null) return;
      void refresh();
      getMe(token)
        .then((me) => {
          setAccount(me);
          setError(null);
        })
        .catch((cause: unknown) => {
          if (cause instanceof ApiError && cause.status === 401) {
            void signOut();
            return;
          }
          setError(cause instanceof ApiError ? cause.message : "Une erreur est survenue.");
        });
    }, [token, signOut, refresh]),
  );

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={reportStyles.card}>
        <Text style={reportStyles.cardLabel}>Adresse e-mail</Text>
        {account !== null ? (
          <Text style={styles.email} selectable>
            {account.email}
          </Text>
        ) : error !== null ? (
          <Text style={styles.error}>{error}</Text>
        ) : (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        )}
        {account !== null ? (
          <Text style={styles.since}>
            Compte créé le {new Date(account.created_at).toLocaleDateString("fr-FR")}
          </Text>
        ) : null}
      </View>

      <View style={reportStyles.card}>
        <Text style={reportStyles.cardLabel}>Alertes</Text>
        {alerts.length === 0 ? <Text style={styles.since}>Aucune alerte pour le moment.</Text> : null}
        {alerts.map((alert) => (
          <TouchableOpacity
            key={alert.id}
            style={styles.alert}
            activeOpacity={0.8}
            onPress={() => openAlert(alert)}
          >
            <View style={[styles.dot, alert.read ? styles.dotRead : null]} />
            <View style={styles.alertTexts}>
              <Text style={styles.alertTitle}>{alert.title}</Text>
              <Text style={styles.alertBody}>{alert.body}</Text>
              <Text style={styles.since}>{formatScanDate(alert.created_at)}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={reportStyles.secondaryButton} activeOpacity={0.8} onPress={() => void signOut()}>
        <Text style={reportStyles.secondaryButtonText}>Se déconnecter</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    gap: 14,
  },
  email: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
  },
  since: {
    fontSize: 13,
    color: colors.textMuted,
  },
  error: {
    fontSize: 14,
    color: colors.dangerous,
  },
  alert: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 5,
    backgroundColor: colors.dangerous,
  },
  dotRead: {
    backgroundColor: colors.border,
  },
  alertTexts: {
    flex: 1,
    gap: 3,
  },
  alertTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  alertBody: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
  loader: {
    alignSelf: "flex-start",
  },
});
