import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router/js-tabs";
import type { ComponentProps } from "react";
import type { ColorValue } from "react-native";

import { colors } from "@/constants/colors";
import { useAlerts } from "@/hooks/useAlerts";

type IconName = ComponentProps<typeof Ionicons>["name"];

function tabIcon(name: IconName) {
  return function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Ionicons name={name} color={color as string} size={size} />;
  };
}

export default function TabsLayout() {
  const { unread } = useAlerts();

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
      <Tabs.Screen name="map" options={{ title: "Carte communautaire", tabBarLabel: "Carte", tabBarIcon: tabIcon("map-outline") }} />
      <Tabs.Screen name="stats" options={{ title: "Statistiques", tabBarLabel: "Stats", tabBarIcon: tabIcon("stats-chart-outline") }} />
      <Tabs.Screen
        name="account"
        options={{
          title: "Compte",
          tabBarIcon: tabIcon("person-outline"),
          tabBarBadge: unread > 0 ? unread : undefined,
        }}
      />
    </Tabs>
  );
}
