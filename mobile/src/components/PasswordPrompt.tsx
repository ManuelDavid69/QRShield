import { useState } from "react";
import { ActivityIndicator, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { colors } from "@/constants/colors";
import { t } from "@/i18n";
import { ApiError } from "@/services/api";

interface PasswordPromptProps {
  title: string;
  message: string;
  confirmLabel: string;
  destructive?: boolean;
  onCancel: () => void;
  onConfirm: (password: string) => Promise<void>;
}

// Alert.prompt n'existe que sur iOS
export default function PasswordPrompt({
  title,
  message,
  confirmLabel,
  destructive,
  onCancel,
  onConfirm,
}: PasswordPromptProps) {
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setError(null);
    setSubmitting(true);
    try {
      await onConfirm(password);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : t.common.error);
      setSubmitting(false);
    }
  }

  const disabled = submitting || password.length === 0;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.text}>{message}</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder={t.auth.password}
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            autoCapitalize="none"
            autoFocus
          />
          {error !== null ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancel} activeOpacity={0.8} onPress={onCancel}>
              <Text style={styles.cancelText}>{t.common.cancel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirm, destructive ? styles.destructive : null, disabled ? styles.disabled : null]}
              activeOpacity={0.8}
              disabled={disabled}
              onPress={() => void confirm()}
            >
              {submitting ? (
                <ActivityIndicator color={colors.primaryText} />
              ) : (
                <Text style={styles.confirmText}>{confirmLabel}</Text>
              )}
            </TouchableOpacity>
          </View>
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
    fontSize: 19,
    fontWeight: "700",
  },
  text: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
  },
  input: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    fontSize: 16,
  },
  error: {
    color: colors.dangerous,
    fontSize: 14,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
  },
  cancel: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
  },
  cancelText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
  },
  confirm: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 13,
    backgroundColor: colors.primary,
    borderRadius: 12,
  },
  destructive: {
    backgroundColor: colors.dangerous,
  },
  disabled: {
    opacity: 0.5,
  },
  confirmText: {
    color: colors.primaryText,
    fontSize: 15,
    fontWeight: "600",
  },
});
