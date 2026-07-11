import { Stack } from "expo-router";

import { colors } from "@/constants/colors";

export default function RootLayout() {
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
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="result" options={{ title: "Résultat du scan", presentation: "card" }} />
    </Stack>
  );
}
