import { router } from "expo-router";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState } from "react-native";

import { useAuth } from "@/hooks/useAuth";
import { getNotifications, getZones, markNotificationRead, type AppNotification } from "@/services/api";
import { getScanPosition } from "@/services/location";
import { onNotificationOpened, requestNotificationPermission, showNotification } from "@/services/notifications";
import { loadValue, saveValue } from "@/services/tokenStorage";
import { reportsNearby, shouldAlert } from "@/utils/zoneAlert";

const LAST_SEEN_KEY = "qrshield.last_notification_at";
const LAST_ZONE_ALERT_KEY = "qrshield.last_zone_alert_at";
const REFRESH_MS = 60_000;
const ZONE_DAYS = 7;

interface AlertsState {
  alerts: AppNotification[];
  unread: number;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
}

const AlertsContext = createContext<AlertsState | null>(null);

async function checkZone(): Promise<void> {
  const position = await getScanPosition({ ask: false });
  if (position === null) return;

  const { zones } = await getZones(ZONE_DAYS);
  const reports = reportsNearby(position, zones);
  const stored = await loadValue(LAST_ZONE_ALERT_KEY);
  const now = Date.now();
  if (!shouldAlert(reports, stored === null ? null : Number(stored), now)) return;

  await saveValue(LAST_ZONE_ALERT_KEY, String(now));
  await showNotification(
    "QR codes piégés près de vous",
    `${reports} signalements cette semaine dans votre secteur. Vérifiez les QR codes avant de les scanner.`,
  );
}

export function AlertsProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [alerts, setAlerts] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const busy = useRef(false);

  const refresh = useCallback(async () => {
    if (token === null || busy.current) return;
    busy.current = true;
    try {
      const list = await getNotifications(token);
      setAlerts(list.items);
      setUnread(list.unread);

      // Seules les alertes plus récentes que la dernière consultation deviennent des notifications
      const lastSeen = (await loadValue(LAST_SEEN_KEY)) ?? "";
      const fresh = list.items.filter((alert) => !alert.read && alert.created_at > lastSeen);
      for (const alert of fresh) {
        await showNotification(alert.title, alert.body, alert.scan_id);
      }
      if (list.items.length > 0) await saveValue(LAST_SEEN_KEY, list.items[0].created_at);

      await checkZone();
    } catch {
      // Le serveur peut être injoignable : on réessaiera au prochain passage
    } finally {
      busy.current = false;
    }
  }, [token]);

  const markRead = useCallback(
    async (id: string) => {
      if (token === null) return;
      await markNotificationRead(token, id);
      setAlerts((current) => current.map((alert) => (alert.id === id ? { ...alert, read: true } : alert)));
      setUnread((count) => Math.max(0, count - 1));
    },
    [token],
  );

  useEffect(() => {
    if (token === null) return;

    void requestNotificationPermission().then(refresh);
    const timer = setInterval(() => void refresh(), REFRESH_MS);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh();
    });
    const stopListening = onNotificationOpened((scanId) => {
      router.push({ pathname: "/scan/[id]", params: { id: scanId } });
    });

    return () => {
      clearInterval(timer);
      subscription.remove();
      stopListening();
    };
  }, [token, refresh]);

  // Après une déconnexion, rien du compte précédent ne reste affiché
  const value = useMemo(
    () => ({ alerts: token ? alerts : [], unread: token ? unread : 0, refresh, markRead }),
    [token, alerts, unread, refresh, markRead],
  );
  return <AlertsContext.Provider value={value}>{children}</AlertsContext.Provider>;
}

export function useAlerts(): AlertsState {
  const context = useContext(AlertsContext);
  if (context === null) throw new Error("useAlerts doit être utilisé dans AlertsProvider");
  return context;
}
