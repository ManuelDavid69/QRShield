import { router } from "expo-router";

import AuthForm from "@/components/AuthForm";
import { useAuth } from "@/hooks/useAuth";
import { t } from "@/i18n";

export default function RegisterScreen() {
  const { signUp } = useAuth();

  return (
    <AuthForm
      title={t.auth.createAccount}
      subtitle={t.auth.registerSubtitle}
      submitLabel={t.auth.registerAction}
      passwordHint={t.auth.passwordHint}
      onSubmit={signUp}
      footerLabel={t.auth.hasAccount}
      footerAction={t.auth.loginAction}
      onFooterPress={() => router.replace("/login")}
    />
  );
}
