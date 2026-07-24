import { router } from "expo-router";

import AuthForm from "@/components/AuthForm";
import { useAuth } from "@/hooks/useAuth";

export default function LoginScreen() {
  const { signIn } = useAuth();

  return (
    <AuthForm
      title="Connexion"
      subtitle="Connectez-vous pour analyser vos QR codes."
      submitLabel="Se connecter"
      onSubmit={signIn}
      footerLabel="Pas encore de compte ?"
      footerAction="Créer un compte"
      onFooterPress={() => router.replace("/register")}
    />
  );
}
