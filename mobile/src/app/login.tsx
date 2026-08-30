import { router } from "expo-router";

import AuthForm from "@/components/AuthForm";
import { useAuth } from "@/hooks/useAuth";
import { t } from "@/i18n";

export default function LoginScreen() {
  const { signIn } = useAuth();

  return (
    <AuthForm
      title={t.auth.loginTitle}
      subtitle={t.auth.loginSubtitle}
      submitLabel={t.auth.loginAction}
      onSubmit={signIn}
      footerLabel={t.auth.noAccount}
      footerAction={t.auth.createAccount}
      secondaryAction={t.auth.forgotPassword}
      onSecondaryPress={() => router.push("/reset-password")}
      onFooterPress={() => router.replace("/register")}
    />
  );
}
