import { router, useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import ReasonList from "@/components/ReasonList";
import RedirectChain from "@/components/RedirectChain";
import VerdictCard from "@/components/VerdictCard";
import { colors } from "@/constants/colors";
import { useScanAnalysis } from "@/hooks/useScanAnalysis";
import type { Verdict } from "@/services/api";
import { isOpenableUrl, parseQrContent, typeLabels } from "@/utils/qrContent";
import { hostOf, verdictAdvice } from "@/utils/verdict";

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

function confirmOpen(url: string, host: string, verdict: Verdict) {
  const risky = verdict === "dangerous" || verdict === "suspicious";
  const title = verdict === "dangerous" ? "Lien dangereux" : verdict === "suspicious" ? "Lien suspect" : "Ouvrir ce lien ?";
  const message = risky ? `${host}\n\n${verdictAdvice[verdict]}` : host;

  Alert.alert(title, message, [
    { text: "Annuler", style: "cancel" },
    {
      text: risky ? "Ouvrir quand même" : "Ouvrir",
      style: risky ? "destructive" : "default",
      onPress: () => {
        void Linking.openURL(url).catch(() => {
          Alert.alert("Impossible d'ouvrir ce lien", "Aucune application ne peut gérer cette adresse.");
        });
      },
    },
  ]);
}

export default function ResultScreen() {
  const { data } = useLocalSearchParams<{ data?: string }>();
  const parsed = useMemo(() => parseQrContent(data ?? ""), [data]);
  const { state, retry } = useScanAnalysis(parsed);

  const analysis = state.status === "done" ? state.scan.analysis : null;
  const verdict: Verdict = analysis?.verdict ?? "unknown";

  // On ouvre la destination analysée : le lien de départ pourrait rediriger ailleurs au second passage
  const targetUrl = analysis?.final_url ?? parsed.url;
  // Le domaine calculé par le serveur prime : c'est celui qui a réellement été analysé
  const host = analysis?.domain ?? (targetUrl ? hostOf(targetUrl) : null) ?? parsed.host ?? "";

  const isUrl = parsed.type === "url" && targetUrl !== undefined && targetUrl !== null;
  // Pas d'ouverture possible avant la fin de l'analyse
  const canOpen = isUrl && state.status !== "loading" && isOpenableUrl(targetUrl);
  const risky = verdict === "dangerous" || verdict === "suspicious";

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <StatusBar style="dark" />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {isUrl && state.status === "loading" ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator color={colors.primary} />
            <View style={styles.loadingTexts}>
              <Text style={styles.neutralTitle}>Analyse du lien en cours</Text>
              <Text style={styles.neutralText}>Vérification des redirections et des bases de sites dangereux.</Text>
            </View>
          </View>
        ) : null}

        {isUrl && analysis !== null ? <VerdictCard verdict={verdict} score={analysis.score} /> : null}

        {state.status === "error" ? (
          <View style={styles.neutralCard}>
            <Text style={styles.neutralTitle}>{isUrl ? "Analyse indisponible" : "Scan non enregistré"}</Text>
            <Text style={styles.neutralText}>
              {state.message}
              {isUrl ? " Vérifiez que le domaine correspond bien au site attendu avant d'ouvrir le lien." : ""}
            </Text>
            <TouchableOpacity activeOpacity={0.8} onPress={retry}>
              <Text style={styles.retryText}>Réessayer</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Type</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{typeLabels[parsed.type]}</Text>
          </View>
        </View>

        {isUrl ? (
          <View style={styles.highlightCard}>
            <Text style={styles.cardLabel}>Ce lien mène vers</Text>
            <Text style={styles.hostText} selectable>
              {host}
            </Text>
            <Text style={styles.urlText} selectable>
              {targetUrl}
            </Text>
          </View>
        ) : null}

        {analysis !== null ? <ReasonList reasons={analysis.reasons} /> : null}
        {analysis !== null ? <RedirectChain chain={analysis.redirect_chain} /> : null}

        {parsed.type === "wifi" && parsed.wifi !== undefined ? (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Réseau Wi-Fi</Text>
            <InfoRow label="Nom du réseau" value={parsed.wifi.ssid.length > 0 ? parsed.wifi.ssid : "Inconnu"} />
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
          {canOpen ? (
            <TouchableOpacity
              // Pour un lien à risque, le bouton passe en second plan
              style={risky ? styles.riskyButton : styles.primaryButton}
              activeOpacity={0.8}
              onPress={() => confirmOpen(targetUrl, host, verdict)}
            >
              <Text style={risky ? styles.riskyButtonText : styles.primaryButtonText}>
                {risky ? "Ouvrir quand même" : "Ouvrir le lien"}
              </Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity style={styles.secondaryButton} activeOpacity={0.8} onPress={() => router.back()}>
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
  loadingCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  loadingTexts: {
    flex: 1,
    gap: 4,
  },
  retryText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.primary,
    marginTop: 4,
  },
  riskyButton: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.dangerous,
    paddingVertical: 16,
    alignItems: "center",
  },
  riskyButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.dangerous,
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
