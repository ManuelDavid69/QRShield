import { parseQrContent } from "@/utils/qrContent";
import type { Scan, ScanCategory } from "@/services/api";
import { locale, t } from "@/i18n";

export const categoryLabels = new Proxy({} as Record<ScanCategory, string>, {
  get: (_target, category) => t.categories[category as ScanCategory],
});

export function formatScanDate(iso: string): string {
  return new Date(iso).toLocaleString(locale(), {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatWeek(isoDate: string): string {
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString(locale(), {
    day: "2-digit",
    month: "2-digit",
  });
}

// Une page peut contenir un scan déjà reçu si un nouveau scan a décalé la pagination
export function mergeScans(current: Scan[], next: Scan[]): Scan[] {
  const known = new Set(current.map((scan) => scan.id));
  return [...current, ...next.filter((scan) => !known.has(scan.id))];
}

export function scanTitle(scan: Scan): string {
  if (scan.content_type === "wifi") {
    const ssid = parseQrContent(scan.content).wifi?.ssid;
    return ssid ? t.history.wifiTitle(ssid) : t.history.wifiNetwork;
  }
  return scan.analysis?.domain ?? scan.url ?? scan.content;
}

// Une barre à 0 % serait invisible : on impose un minimum lisible
export function barWidth(value: number, max: number): number {
  if (max <= 0) return 0;
  const percent = Math.round((value / max) * 100);
  if (value > 0) return Math.min(100, Math.max(2, percent));
  return 0;
}
