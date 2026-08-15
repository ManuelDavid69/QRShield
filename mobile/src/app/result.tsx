import { router, useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import ReportButton from "@/components/ReportButton";
import ScanReport, { reportStyles } from "@/components/ScanReport";
import { colors } from "@/constants/colors";
import { useScanAnalysis } from "@/hooks/useScanAnalysis";
import { parseQrContent } from "@/utils/qrContent";

export default function ResultScreen() {
  const { data } = useLocalSearchParams<{ data?: string }>();
  const parsed = useMemo(() => parseQrContent(data ?? ""), [data]);
  const { state, retry } = useScanAnalysis(parsed);

  const isUrl = parsed.type === "url";
  const analysis = state.status === "done" ? state.scan.analysis : null;

  const header = (
    <>
      {isUrl && state.status === "loading" ? (
        <View style={styles.loadingCard}>
          <ActivityIndicator color={colors.primary} />
          <View style={styles.loadingTexts}>
            <Text style={styles.title}>Analyse du lien en cours</Text>
            <Text style={styles.text}>Vérification des redirections et des bases de sites dangereux.</Text>
          </View>
        </View>
      ) : null}

      {state.status === "error" ? (
        <View style={styles.errorCard}>
          <Text style={styles.title}>{isUrl ? "Analyse indisponible" : "Scan non enregistré"}</Text>
          <Text style={styles.text}>
            {state.message}
            {isUrl ? " Vérifiez que le domaine correspond bien au site attendu avant d'ouvrir le lien." : ""}
          </Text>
          <TouchableOpacity activeOpacity={0.8} onPress={retry}>
            <Text style={styles.retryText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <StatusBar style="dark" />
      <ScanReport
        parsed={parsed}
        analysis={analysis}
        analyzing={state.status === "loading"}
        header={header}
        footer={
          <>
            {isUrl && state.status === "done" ? <ReportButton scanId={state.scan.id} /> : null}
            <TouchableOpacity style={reportStyles.secondaryButton} activeOpacity={0.8} onPress={() => router.back()}>
              <Text style={reportStyles.secondaryButtonText}>Scanner un autre QR code</Text>
            </TouchableOpacity>
          </>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
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
  errorCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.unknown,
    padding: 16,
    gap: 6,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  text: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  retryText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.primary,
    marginTop: 4,
  },
});
