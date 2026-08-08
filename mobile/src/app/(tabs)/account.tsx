import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { reportStyles } from "@/components/ScanReport";
import { colors } from "@/constants/colors";
import { useAuth } from "@/hooks/useAuth";
import { ApiError, getMe, type Account } from "@/services/api";

export default function AccountScreen() {
  const { token, signOut } = useAuth();
  const [account, setAccount] = useState<Account | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (token === null) return;
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
    }, [token, signOut]),
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
  loader: {
    alignSelf: "flex-start",
  },
});
