import { router } from "expo-router";

import AuthForm from "@/components/AuthForm";
import { useAuth } from "@/hooks/useAuth";

export default function RegisterScreen() {
  const { signUp } = useAuth();

  return (
    <AuthForm
      title="Créer un compte"
      subtitle="Votre historique de scans reste lié à votre compte."
      submitLabel="Créer mon compte"
      passwordHint="10 caractères minimum."
      onSubmit={signUp}
      footerLabel="Déjà un compte ?"
      footerAction="Se connecter"
      onFooterPress={() => router.replace("/login")}
    />
  );
}
