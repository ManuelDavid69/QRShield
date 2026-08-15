import { useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity } from "react-native";

import { reportStyles } from "@/components/ScanReport";
import { colors } from "@/constants/colors";
import { useAuth } from "@/hooks/useAuth";
import { ApiError, reportScan } from "@/services/api";

export default function ReportButton({ scanId }: { scanId: string }) {
  const { token, signOut } = useAuth();
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");

  async function send() {
    if (token === null) return;
    setStatus("sending");
    try {
      await reportScan(token, scanId);
      setStatus("done");
    } catch (error) {
      setStatus("idle");
      if (error instanceof ApiError && error.status === 401) {
        await signOut();
        return;
      }
      Alert.alert("Signalement impossible", error instanceof ApiError ? error.message : "Une erreur est survenue.");
    }
  }

  function confirm() {
    Alert.alert(
      "Signaler ce lien ?",
      "Le signalement est anonyme et aide les autres utilisateurs à repérer les QR codes piégés.",
      [
        { text: "Annuler", style: "cancel" },
        { text: "Signaler", style: "destructive", onPress: () => void send() },
      ],
    );
  }

  if (status === "done") {
    return <Text style={styles.done}>Merci, votre signalement a bien été enregistré.</Text>;
  }

  return (
    <TouchableOpacity
      style={reportStyles.secondaryButton}
      activeOpacity={0.8}
      disabled={status === "sending"}
      onPress={confirm}
    >
      {status === "sending" ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <Text style={reportStyles.secondaryButtonText}>Signaler ce lien</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  done: {
    fontSize: 14,
    textAlign: "center",
    color: colors.safe,
    paddingVertical: 8,
  },
});
