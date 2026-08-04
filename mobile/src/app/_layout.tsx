import { Stack } from "expo-router";
import { View } from "react-native";

import { colors } from "@/constants/colors";
import { AuthProvider, useAuth } from "@/hooks/useAuth";

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
        <Stack.Screen name="result" options={{ title: "Résultat du scan", presentation: "card" }} />
        <Stack.Screen name="scan/[id]" options={{ title: "Détail du scan" }} />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="register" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <Navigator />
    </AuthProvider>
  );
}
