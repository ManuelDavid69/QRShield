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
// Version publiée sur GitHub Pages : pas de serveur, les données viennent d'un fichier
const STATIC_DEMO = import.meta.env.VITE_STATIC_DEMO === "true";

interface Snapshot {
  zones: ZoneList;
  stats: CommunityStats;
}

let snapshot: Promise<Snapshot> | null = null;

function loadSnapshot(): Promise<Snapshot> {
  snapshot ??= getJson<Snapshot>(`${import.meta.env.BASE_URL}demo-data.json`);
  return snapshot;
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Requête refusée (${response.status}) sur ${url}`);
  }
  return (await response.json()) as T;
}

export async function fetchZones(): Promise<ZoneList> {
  if (STATIC_DEMO) return (await loadSnapshot()).zones;
  return getJson<ZoneList>(`${API_URL}/community/zones`);
}

export async function fetchStats(): Promise<CommunityStats> {
  if (STATIC_DEMO) return (await loadSnapshot()).stats;
  return getJson<CommunityStats>(`${API_URL}/community/stats`);
}
