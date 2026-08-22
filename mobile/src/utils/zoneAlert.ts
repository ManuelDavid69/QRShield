import type { ScanPosition, Zone } from "@/services/api";

export const ALERT_RADIUS_KM = 5;
export const ALERT_MIN_REPORTS = 5;
export const ALERT_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function distanceKm(a: ScanPosition, b: ScanPosition): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.latitude)) * Math.cos(toRadians(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

// Calculé sur le téléphone à partir des zones publiques : le serveur ne connaît pas la position
export function reportsNearby(position: ScanPosition, zones: Zone[]): number {
  return zones
    .filter((zone) => distanceKm(position, zone) <= ALERT_RADIUS_KM)
    .reduce((total, zone) => total + zone.reports, 0);
}

export function shouldAlert(reports: number, lastAlertAt: number | null, now: number): boolean {
  if (reports < ALERT_MIN_REPORTS) return false;
  return lastAlertAt === null || now - lastAlertAt >= ALERT_COOLDOWN_MS;
}
