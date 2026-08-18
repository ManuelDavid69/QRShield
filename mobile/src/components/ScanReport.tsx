import type { ReactNode } from "react";
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import ReasonList from "@/components/ReasonList";
import RedirectChain from "@/components/RedirectChain";
import VerdictCard from "@/components/VerdictCard";
import { colors } from "@/constants/colors";
import type { Analysis, Verdict } from "@/services/api";
import { confirmDialog, notify } from "@/utils/dialog";
import { isOpenableUrl, typeLabels, type ParsedQr } from "@/utils/qrContent";
import { hostOf, verdictAdvice } from "@/utils/verdict";

// Longueur fixe : afficher une étoile par caractère révélerait la taille du mot de passe
const MASKED_PASSWORD = "********";

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

  confirmDialog({
    title,
    message,
    confirmLabel: risky ? "Ouvrir quand même" : "Ouvrir",
    destructive: risky,
    onConfirm: () => {
      void Linking.openURL(url).catch(() => {
        notify("Impossible d'ouvrir ce lien", "Aucune application ne peut gérer cette adresse.");
      });
    },
  });
}

interface ScanReportProps {
  parsed: ParsedQr;
  analysis: Analysis | null;
  // true tant que l'analyse tourne : aucune ouverture possible avant la fin
  analyzing: boolean;
  header?: ReactNode;
  footer?: ReactNode;
}

export default function ScanReport({ parsed, analysis, analyzing, header, footer }: ScanReportProps) {
  const verdict: Verdict = analysis?.verdict ?? "unknown";

  // On ouvre la destination analysée : le lien de départ pourrait rediriger ailleurs au second passage
  const targetUrl = analysis?.final_url ?? parsed.url;
  // Le domaine calculé par le serveur prime : c'est celui qui a réellement été analysé
  const host = analysis?.domain ?? (targetUrl ? hostOf(targetUrl) : null) ?? parsed.host ?? "";

  const isUrl = parsed.type === "url" && targetUrl !== undefined && targetUrl !== null;
  const canOpen = isUrl && !analyzing && isOpenableUrl(targetUrl);
  const risky = verdict === "dangerous" || verdict === "suspicious";

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      {header}

      {isUrl && analysis !== null ? <VerdictCard verdict={verdict} score={analysis.score} /> : null}

      <View style={reportStyles.card}>
        <Text style={reportStyles.cardLabel}>Type</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{typeLabels[parsed.type]}</Text>
        </View>
      </View>

      {isUrl ? (
        <View style={styles.highlightCard}>
          <Text style={reportStyles.cardLabel}>Ce lien mène vers</Text>
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
        <View style={reportStyles.card}>
          <Text style={reportStyles.cardLabel}>Réseau Wi-Fi</Text>
          <InfoRow label="Nom du réseau" value={parsed.wifi.ssid.length > 0 ? parsed.wifi.ssid : "Inconnu"} />
          <InfoRow label="Sécurité" value={parsed.wifi.security} />
          <InfoRow label="Réseau masqué" value={parsed.wifi.hidden ? "Oui" : "Non"} />
          <InfoRow label="Mot de passe" value={parsed.wifi.hasPassword ? MASKED_PASSWORD : "Aucun"} />
        </View>
      ) : null}

      {parsed.type !== "url" && parsed.type !== "wifi" ? (
        <View style={reportStyles.card}>
          <Text style={reportStyles.cardLabel}>Contenu</Text>
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
        {footer}
      </View>
    </ScrollView>
  );
}

export const reportStyles = StyleSheet.create({
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

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 20,
    paddingBottom: 32,
    gap: 16,
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
});
