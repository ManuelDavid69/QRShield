// Pas de notifications système dans le navigateur : les tests E2E lisent cette liste
declare global {
  interface Window {
    __notifications?: { title: string; body: string }[];
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  return true;
}

export async function showNotification(title: string, body: string): Promise<void> {
  window.__notifications = [...(window.__notifications ?? []), { title, body }];
}

export function onNotificationOpened(): () => void {
  return () => undefined;
}

export function consumeOpenedNotification(): string | null {
  return null;
}
