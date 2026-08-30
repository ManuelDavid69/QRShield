import { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity } from "react-native";

import { reportStyles } from "@/components/ScanReport";
import { colors } from "@/constants/colors";
import { useAuth } from "@/hooks/useAuth";
import { ApiError, reportScan } from "@/services/api";
import { confirmDialog, notify } from "@/utils/dialog";
import { t } from "@/i18n";

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
      notify(t.reporting.failed, error instanceof ApiError ? error.message : t.common.error);
    }
  }

  function confirm() {
    confirmDialog({
      title: t.reporting.title,
      message: t.reporting.text,
      confirmLabel: t.reporting.confirm,
      destructive: true,
      onConfirm: () => void send(),
    });
  }

  if (status === "done") {
    return <Text style={styles.done}>{t.reporting.done}</Text>;
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
        <Text style={reportStyles.secondaryButtonText}>{t.reporting.action}</Text>
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
