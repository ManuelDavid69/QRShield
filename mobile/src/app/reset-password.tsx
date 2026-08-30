import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors } from "@/constants/colors";
import { useAuth } from "@/hooks/useAuth";
import { t } from "@/i18n";
import { ApiError, resetPassword } from "@/services/api";

export default function ResetPasswordScreen() {
  const { showRecoveryCode } = useAuth();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const disabled = submitting || email.trim().length === 0 || code.trim().length === 0 || password.length === 0;

  async function submit() {
    setError(null);
    setSubmitting(true);
    try {
      const { recovery_code: newCode } = await resetPassword(email.trim(), code.trim(), password);
      // L'ancien code vient d'être consommé : le nouveau doit être noté tout de suite
      showRecoveryCode(newCode);
      router.replace("/login");
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : t.common.error);
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{t.auth.resetTitle}</Text>
        <Text style={styles.subtitle}>{t.auth.resetSubtitle}</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder={t.auth.email}
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
        />
        <TextInput
          style={styles.input}
          value={code}
          onChangeText={setCode}
          placeholder={t.auth.recoveryCode}
          placeholderTextColor={colors.textMuted}
          autoCapitalize="characters"
          autoCorrect={false}
        />
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder={t.auth.newPassword}
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          autoCapitalize="none"
        />
        <Text style={styles.hint}>{t.auth.passwordHint}</Text>
        {error !== null ? <Text style={styles.error}>{error}</Text> : null}
        <TouchableOpacity
          style={[styles.button, disabled ? styles.disabled : null]}
          disabled={disabled}
          onPress={() => void submit()}
          accessibilityRole="button"
        >
          {submitting ? (
            <ActivityIndicator color={colors.primaryText} />
          ) : (
            <Text style={styles.buttonText}>{t.auth.resetAction}</Text>
          )}
        </TouchableOpacity>
        <Text style={styles.link} onPress={() => router.replace("/login")} accessibilityRole="button">
          {t.auth.backToLogin}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    gap: 12,
    padding: 24,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "700",
  },
  subtitle: {
    marginBottom: 8,
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    fontSize: 16,
  },
  hint: {
    color: colors.textMuted,
    fontSize: 13,
  },
  error: {
    color: colors.dangerous,
    fontSize: 14,
  },
  button: {
    alignItems: "center",
    marginTop: 8,
    paddingVertical: 16,
    backgroundColor: colors.primary,
    borderRadius: 14,
  },
  disabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: colors.primaryText,
    fontSize: 16,
    fontWeight: "600",
  },
  link: {
    marginTop: 4,
    textAlign: "center",
    color: colors.primary,
    fontSize: 14,
    fontWeight: "600",
  },
});
