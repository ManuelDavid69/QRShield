import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";

import { colors } from "@/constants/colors";
import { AlertsProvider } from "@/hooks/useAlerts";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { LanguageProvider } from "@/hooks/useLanguage";
import RecoveryCodeModal from "@/components/RecoveryCodeModal";
import { t } from "@/i18n";

function Navigator() {
  const { token, ready } = useAuth();

  if (!ready) {
    return <View style={{ flex: 1, backgroundColor: colors.scannerBackground }} />;
  }

  const signedIn = token !== null;
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTitleAlign: "center",
        headerTintColor: colors.primary,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="result" options={{ title: t.nav.result, presentation: "card" }} />
        <Stack.Screen name="scan/[id]" options={{ title: t.nav.scanDetail }} />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="register" options={{ headerShown: false }} />
        <Stack.Screen name="reset-password" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <AlertsProvider>
          {/* Sans réglage, les icônes suivent le thème du téléphone : blanches sur fond clair en mode sombre */}
          <StatusBar style="dark" />
          <Navigator />
          <RecoveryCodeModal />
        </AlertsProvider>
      </AuthProvider>
    </LanguageProvider>
  );
}
