export type ThreatType = "phishing" | "malware" | "other";

export interface Zone {
  latitude: number;
  longitude: number;
  reports: number;
  dangerous: number;
}

export interface ZoneList {
  zones: Zone[];
  period_days: number;
}

export interface CommunityStats {
  period_days: number;
  total_reports: number;
  dangerous_reports: number;
  zones: number;
  threats: { threat: ThreatType; count: number }[];
  weekly: { week_start: string; count: number }[];
  top_domains: { domain: string; reports: number }[];
  top_zones: Zone[];
}

const API_URL = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000";

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`);
  if (!response.ok) {
    throw new Error(`Requête refusée (${response.status}) sur ${path}`);
  }
  return (await response.json()) as T;
}

export function fetchZones(): Promise<ZoneList> {
  return getJson<ZoneList>("/community/zones");
}

export function fetchStats(): Promise<CommunityStats> {
  return getJson<CommunityStats>("/community/stats");
}
