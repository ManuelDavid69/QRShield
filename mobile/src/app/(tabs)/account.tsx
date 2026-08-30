import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import PasswordPrompt from "@/components/PasswordPrompt";
import { reportStyles } from "@/components/ScanReport";
import { colors } from "@/constants/colors";
import { useAlerts } from "@/hooks/useAlerts";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { locale, t, type Lang } from "@/i18n";
import { alertText } from "@/i18n/reasons";
import {
  ApiError,
  createRecoveryCode,
  deleteAccount,
  getMe,
  type Account,
  type AppNotification,
} from "@/services/api";
import { formatScanDate } from "@/utils/labels";

const LANGUAGES: { lang: Lang; label: string }[] = [
  { lang: "fr", label: "Français" },
  { lang: "en", label: "English" },
];

export default function AccountScreen() {
  const { token, signOut, showRecoveryCode } = useAuth();
  const { lang, changeLanguage } = useLanguage();
  const [account, setAccount] = useState<Account | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<"recovery" | "delete" | null>(null);
  const { alerts, refresh, markRead } = useAlerts();

  function openAlert(alert: AppNotification) {
    void markRead(alert.id);
    if (alert.scan_id !== null) router.push({ pathname: "/scan/[id]", params: { id: alert.scan_id } });
  }

  useFocusEffect(
    useCallback(() => {
      if (token === null) return;
      void refresh();
      getMe(token)
        .then((me) => {
          setAccount(me);
          setError(null);
        })
        .catch((cause: unknown) => {
          if (cause instanceof ApiError && cause.status === 401) {
            void signOut();
            return;
          }
          setError(cause instanceof ApiError ? cause.message : t.common.error);
        });
    }, [token, signOut, refresh]),
  );

  function selectLanguage(next: Lang) {
    changeLanguage(next);
    // Le changement remonte toute l'appli : on revient sur cet écran une fois la navigation prête
    requestAnimationFrame(() => router.navigate("/account"));
  }

  async function generateCode(password: string) {
    if (token === null) return;
    const { recovery_code: code } = await createRecoveryCode(token, password);
    setPrompt(null);
    setAccount((current) => (current === null ? current : { ...current, has_recovery_code: true }));
    showRecoveryCode(code);
  }

  async function removeAccount(password: string) {
    if (token === null) return;
    await deleteAccount(token, password);
    setPrompt(null);
    await signOut();
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
      <View style={reportStyles.card}>
        <Text style={reportStyles.cardLabel}>{t.account.email}</Text>
        {account !== null ? (
          <Text style={styles.email} selectable>
            {account.email}
          </Text>
        ) : error !== null ? (
          <Text style={styles.error}>{error}</Text>
        ) : (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        )}
        {account !== null ? (
          <Text style={styles.since}>{t.account.createdOn(new Date(account.created_at).toLocaleDateString(locale()))}</Text>
        ) : null}
      </View>

      <View style={reportStyles.card}>
        <Text style={reportStyles.cardLabel}>{t.account.alerts}</Text>
        {alerts.length === 0 ? <Text style={styles.since}>{t.account.noAlerts}</Text> : null}
        {alerts.map((alert) => {
          const { title, body } = alertText(alert);
          return (
            <TouchableOpacity
              key={alert.id}
              style={styles.alert}
              activeOpacity={0.8}
              onPress={() => openAlert(alert)}
            >
              <View style={[styles.dot, alert.read ? styles.dotRead : null]} />
              <View style={styles.alertTexts}>
                <Text style={styles.alertTitle}>{title}</Text>
                <Text style={styles.alertBody}>{body}</Text>
                <Text style={styles.since}>{formatScanDate(alert.created_at)}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={reportStyles.card}>
        <Text style={reportStyles.cardLabel}>{t.account.language}</Text>
        <View style={styles.languages}>
          {LANGUAGES.map((option) => (
            <TouchableOpacity
              key={option.lang}
              style={[styles.language, lang === option.lang ? styles.languageActive : null]}
              activeOpacity={0.8}
              onPress={() => selectLanguage(option.lang)}
              accessibilityState={{ selected: lang === option.lang }}
            >
              <Text style={[styles.languageText, lang === option.lang ? styles.languageTextActive : null]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={reportStyles.card}>
        <Text style={reportStyles.cardLabel}>{t.recovery.cardLabel}</Text>
        {account !== null ? (
          <Text style={styles.since}>{account.has_recovery_code ? t.recovery.active : t.recovery.missing}</Text>
        ) : null}
        <TouchableOpacity style={reportStyles.secondaryButton} activeOpacity={0.8} onPress={() => setPrompt("recovery")}>
          <Text style={reportStyles.secondaryButtonText}>{t.recovery.generate}</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={reportStyles.secondaryButton} activeOpacity={0.8} onPress={() => void signOut()}>
        <Text style={reportStyles.secondaryButtonText}>{t.account.signOut}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.delete} activeOpacity={0.8} onPress={() => setPrompt("delete")}>
        <Text style={styles.deleteText}>{t.account.deleteAccount}</Text>
      </TouchableOpacity>

      {prompt === "recovery" ? (
        <PasswordPrompt
          title={t.recovery.promptTitle}
          message={t.recovery.promptText}
          confirmLabel={t.recovery.promptAction}
          onCancel={() => setPrompt(null)}
          onConfirm={generateCode}
        />
      ) : null}
      {prompt === "delete" ? (
        <PasswordPrompt
          title={t.account.deleteTitle}
          message={t.account.deleteText}
          confirmLabel={t.common.delete}
          destructive
          onCancel={() => setPrompt(null)}
          onConfirm={removeAccount}
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    gap: 14,
  },
  email: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text,
  },
  since: {
    fontSize: 13,
    color: colors.textMuted,
  },
  error: {
    fontSize: 14,
    color: colors.dangerous,
  },
  alert: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 5,
    backgroundColor: colors.dangerous,
  },
  dotRead: {
    backgroundColor: colors.border,
  },
  alertTexts: {
    flex: 1,
    gap: 3,
  },
  alertTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  alertBody: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
  loader: {
    alignSelf: "flex-start",
  },
  languages: {
    flexDirection: "row",
    gap: 8,
  },
  language: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
  },
  languageActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  languageText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  languageTextActive: {
    color: colors.primaryText,
  },
  delete: {
    alignItems: "center",
    paddingVertical: 14,
  },
  deleteText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.dangerous,
  },
});
