import * as Notifications from "expo-notifications";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

// Notification locale : les notifications à distance demandent une build dédiée et Firebase
export async function showNotification(title: string, body: string, scanId?: string | null): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: { title, body, data: scanId ? { scanId } : {} },
    trigger: null,
  });
}

export function onNotificationOpened(handler: (scanId: string) => void): () => void {
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const scanId = response.notification.request.content.data?.scanId;
    if (typeof scanId === "string") handler(scanId);
  });
  return () => subscription.remove();
}
