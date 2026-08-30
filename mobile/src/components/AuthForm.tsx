import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors } from "@/constants/colors";
import { ApiError } from "@/services/api";
import { t } from "@/i18n";

interface AuthFormProps {
  title: string;
  subtitle: string;
  submitLabel: string;
  passwordHint?: string;
  onSubmit: (email: string, password: string) => Promise<void>;
  footerLabel: string;
  footerAction: string;
  onFooterPress: () => void;
  secondaryAction?: string;
  onSecondaryPress?: () => void;
}

export default function AuthForm({
  title,
  subtitle,
  submitLabel,
  passwordHint,
  onSubmit,
  footerLabel,
  footerAction,
  onFooterPress,
  secondaryAction,
  onSecondaryPress,
}: AuthFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const disabled = submitting || email.trim().length === 0 || password.length === 0;

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(email.trim(), password);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t.common.error);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.brand}>QRShield</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>

          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder={t.auth.email}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
          />

          <View>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder={t.auth.password}
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password"
              textContentType="password"
            />
            {passwordHint ? <Text style={styles.hint}>{passwordHint}</Text> : null}
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.button, disabled && styles.buttonDisabled]}
            onPress={() => {
              void handleSubmit();
            }}
            disabled={disabled}
            accessibilityRole="button"
          >
            {submitting ? (
              <ActivityIndicator color={colors.primaryText} />
            ) : (
              <Text style={styles.buttonText}>{submitLabel}</Text>
            )}
          </TouchableOpacity>

          {secondaryAction ? (
            <Text style={styles.secondary} onPress={onSecondaryPress} accessibilityRole="button">
              {secondaryAction}
            </Text>
          ) : null}

          <View style={styles.footer}>
            <Text style={styles.footerLabel}>{footerLabel} </Text>
            <Text style={styles.footerAction} onPress={onFooterPress} accessibilityRole="button">
              {footerAction}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
    gap: 12,
  },
  brand: {
    color: colors.primary,
    fontSize: 32,
    fontWeight: "800",
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "700",
    marginTop: 8,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: colors.text,
    fontSize: 16,
  },
  hint: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 6,
  },
  error: {
    color: colors.dangerous,
    fontSize: 14,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: colors.primaryText,
    fontSize: 16,
    fontWeight: "600",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 4,
  },
  footerLabel: {
    color: colors.textMuted,
    fontSize: 14,
  },
  secondary: {
    textAlign: "center",
    color: colors.primary,
    fontSize: 14,
    fontWeight: "600",
  },
  footerAction: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "600",
  },
});
