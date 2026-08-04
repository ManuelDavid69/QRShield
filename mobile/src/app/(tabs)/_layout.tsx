import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router/js-tabs";
import type { ComponentProps } from "react";
import type { ColorValue } from "react-native";

import { colors } from "@/constants/colors";

type IconName = ComponentProps<typeof Ionicons>["name"];

function tabIcon(name: IconName) {
  return function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Ionicons name={name} color={color as string} size={size} />;
  };
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        headerStyle: { backgroundColor: colors.background },
        headerTitleAlign: "center",
        headerTintColor: colors.primary,
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Scanner", headerShown: false, tabBarIcon: tabIcon("scan-outline") }}
      />
      <Tabs.Screen name="history" options={{ title: "Historique", tabBarIcon: tabIcon("time-outline") }} />
      <Tabs.Screen name="stats" options={{ title: "Statistiques", tabBarIcon: tabIcon("stats-chart-outline") }} />
    </Tabs>
  );
}
