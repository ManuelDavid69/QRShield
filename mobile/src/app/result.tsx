import { router, useLocalSearchParams } from "expo-router";
import { Alert, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { colors } from "@/constants/colors";
import { isOpenableUrl, parseQrContent, typeLabels } from "@/utils/qrContent";

interface InfoRowProps {
  label: string;
  value: string;
}

function InfoRow({ label, value }: InfoRowProps) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} selectable>
        {value}
      </Text>
    </View>
  );
}

export default function ResultScreen() {
  const { data } = useLocalSearchParams<{ data?: string }>();
  const parsed = parseQrContent(data ?? "");

  const canOpen = parsed.type === "url" && parsed.url !== undefined && isOpenableUrl(parsed.url);
  const host = parsed.host ?? "";

  function handleOpen(url: string) {
    Alert.alert("Ouvrir ce lien ?", host || url, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Ouvrir",
        onPress: () => {
          void Linking.openURL(url).catch(() => {
            Alert.alert("Impossible d'ouvrir ce lien", "Aucune application ne peut gérer cette adresse.");
          });
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <StatusBar style="dark" />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Type</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{typeLabels[parsed.type]}</Text>
          </View>
        </View>

        {parsed.type === "url" && parsed.url !== undefined ? (
          <>
            <View style={styles.highlightCard}>
              <Text style={styles.cardLabel}>Ce lien mène vers</Text>
              <Text style={styles.hostText} selectable>
                {host}
              </Text>
              <Text style={styles.urlText} selectable>
                {parsed.url}
              </Text>
            </View>

            <View style={styles.neutralCard}>
              <Text style={styles.neutralTitle}>Analyse de sécurité</Text>
              <Text style={styles.neutralText}>
                L&apos;analyse automatique du lien n&apos;est pas encore disponible. Vérifiez que le
                domaine correspond bien au site attendu avant d&apos;ouvrir le lien.
              </Text>
            </View>
          </>
        ) : null}

        {parsed.type === "wifi" && parsed.wifi !== undefined ? (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Réseau Wi-Fi</Text>
            <InfoRow label="Nom du réseau" value={parsed.wifi.ssid.length > 0 ? parsed.wifi.ssid : "—"} />
            <InfoRow label="Sécurité" value={parsed.wifi.security} />
            <InfoRow label="Réseau masqué" value={parsed.wifi.hidden ? "Oui" : "Non"} />
            <InfoRow label="Mot de passe" value={parsed.wifi.hasPassword ? "Présent" : "Aucun"} />
          </View>
        ) : null}

        {parsed.type !== "url" && parsed.type !== "wifi" ? (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Contenu</Text>
            <Text style={styles.rawText} selectable>
              {parsed.raw.length > 0 ? parsed.raw : "Aucun contenu détecté."}
            </Text>
          </View>
        ) : null}

        <View style={styles.actions}>
          {canOpen && parsed.url !== undefined ? (
            <TouchableOpacity
              style={styles.primaryButton}
              activeOpacity={0.8}
              onPress={() => handleOpen(parsed.url as string)}
            >
              <Text style={styles.primaryButtonText}>Ouvrir le lien</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={styles.secondaryButton}
            activeOpacity={0.8}
            onPress={() => router.back()}
          >
            <Text style={styles.secondaryButtonText}>Scanner un autre QR code</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 20,
    paddingBottom: 32,
    gap: 16,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 8,
  },
  cardLabel: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: colors.textMuted,
  },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  badgeText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  highlightCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.primary,
    padding: 16,
    gap: 8,
  },
  hostText: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.text,
  },
  urlText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  neutralCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.unknown,
    padding: 16,
    gap: 6,
  },
  neutralTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  neutralText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    paddingVertical: 6,
  },
  infoLabel: {
    fontSize: 14,
    color: colors.textMuted,
  },
  infoValue: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
    textAlign: "right",
  },
  rawText: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
  },
  actions: {
    marginTop: 8,
    gap: 12,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.primaryText,
  },
  secondaryButton: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 16,
    alignItems: "center",
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
  },
});
