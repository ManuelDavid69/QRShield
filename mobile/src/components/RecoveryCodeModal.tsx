import { Modal, Share, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { colors } from "@/constants/colors";
import { useAuth } from "@/hooks/useAuth";
import { t } from "@/i18n";

export default function RecoveryCodeModal() {
  const { recoveryCode, dismissRecoveryCode } = useAuth();

  return (
    <Modal visible={recoveryCode !== null} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card} accessibilityViewIsModal>
          <Text style={styles.title}>{t.recovery.title}</Text>
          <Text style={styles.text}>{t.recovery.text}</Text>
          <Text style={styles.code} selectable>
            {recoveryCode}
          </Text>
          <TouchableOpacity
            style={styles.secondary}
            activeOpacity={0.8}
            onPress={() => void Share.share({ message: recoveryCode ?? "" }).catch(() => undefined)}
          >
            <Text style={styles.secondaryText}>{t.recovery.share}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.primary} activeOpacity={0.8} onPress={dismissRecoveryCode}>
            <Text style={styles.primaryText}>{t.recovery.done}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
  },
  card: {
    gap: 12,
    padding: 20,
    backgroundColor: colors.surface,
    borderRadius: 16,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "700",
  },
  text: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
  },
  code: {
    paddingVertical: 14,
    textAlign: "center",
    color: colors.text,
    backgroundColor: colors.background,
    borderRadius: 10,
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 1,
  },
  primary: {
    alignItems: "center",
    paddingVertical: 14,
    backgroundColor: colors.primary,
    borderRadius: 12,
  },
  primaryText: {
    color: colors.primaryText,
    fontSize: 16,
    fontWeight: "600",
  },
  secondary: {
    alignItems: "center",
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
  },
  secondaryText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
});
