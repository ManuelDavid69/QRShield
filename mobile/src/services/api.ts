import Constants from "expo-constants";

export type Verdict = "unknown" | "safe" | "suspicious" | "dangerous";
export type Severity = "info" | "low" | "medium" | "high" | "critical";
export type ScanCategory = "website" | "menu" | "payment" | "wifi" | "other";

export interface Reason {
  code: string;
  severity: Severity;
  message: string;
}

export interface Analysis {
  final_url: string | null;
  domain: string | null;
  score: number | null;
  verdict: Verdict;
  reasons: Reason[];
  redirect_chain: string[];
  analyzed_at: string | null;
}

export interface Scan {
  id: string;
  content: string;
  content_type: string;
  category: ScanCategory;
  url: string | null;
  verdict: Verdict;
  latitude: number | null;
  longitude: number | null;
  scanned_at: string;
  analysis: Analysis | null;
}

export interface ScanList {
  items: Scan[];
  total: number;
}

export interface ScanPosition {
  latitude: number;
  longitude: number;
}

export interface UserStats {
  total_scans: number;
  flagged_scans: number;
  flagged_percent: number;
  verdicts: { verdict: Verdict; count: number }[];
  categories: { category: ScanCategory; count: number }[];
  weekly: { week_start: string; count: number }[];
  places: (ScanPosition & { count: number })[];
  top_domains: { domain: string; count: number }[];
}

export interface Zone {
  latitude: number;
  longitude: number;
  reports: number;
  dangerous: number;
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  scan_id: string | null;
  created_at: string;
  read: boolean;
}

export interface Account {
  id: string;
  email: string;
  created_at: string;
}

export class ApiError extends Error {
  // status = 0 : le serveur n'a pas pu être joint
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

// L'analyse suit des redirections et interroge plusieurs services, elle peut prendre 15 s
const TIMEOUT_MS = 35_000;

function apiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  // Expo Go connaît l'adresse du PC : c'est celle du serveur de dev (ex. 192.168.1.13:8081)
  const host = Constants.expoConfig?.hostUri?.split(":")[0] ?? "127.0.0.1";
  return `http://${host}:8001`;
}

export function errorMessage(status: number, body: unknown): string {
  const detail = (body as { detail?: unknown } | null)?.detail;
  if (status === 422) {
    // FastAPI indique le champ refusé : le mot de passe est validé avant de chercher le compte
    const first = Array.isArray(detail) ? (detail[0] as { loc?: unknown[] } | undefined) : undefined;
    const field = first?.loc?.at(-1);
    if (field === "password") return "Le mot de passe doit contenir au moins 10 caractères.";
    if (field === "email") return "Cette adresse e-mail n'est pas valide.";
    return "Vérifiez les informations saisies.";
  }
  return typeof detail === "string" ? detail : "Le serveur a renvoyé une erreur.";
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}${path}`, { ...init, signal: controller.signal });
  } catch {
    throw new ApiError(0, "Impossible de joindre le serveur QRShield.");
  } finally {
    clearTimeout(timer);
  }

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(response.status, errorMessage(response.status, body));
  return body as T;
}

export async function login(email: string, password: string): Promise<string> {
  // OAuth2 impose un formulaire urlencoded, pas du JSON
  const form = new URLSearchParams({ username: email, password }).toString();
  const { access_token } = await request<{ access_token: string }>("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });
  return access_token;
}

export async function register(email: string, password: string): Promise<void> {
  await request("/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
}

function authHeader(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

export function createScan(token: string, content: string, position: ScanPosition | null): Promise<Scan> {
  return request<Scan>("/scans", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader(token) },
    body: JSON.stringify({ content, ...position }),
  });
}

export function listScans(
  token: string,
  options: { limit: number; offset: number; verdict?: Verdict },
): Promise<ScanList> {
  const params = new URLSearchParams({ limit: String(options.limit), offset: String(options.offset) });
  if (options.verdict !== undefined) params.set("verdict", options.verdict);
  return request<ScanList>(`/scans?${params.toString()}`, { headers: authHeader(token) });
}

export function getScan(token: string, id: string): Promise<Scan> {
  return request<Scan>(`/scans/${encodeURIComponent(id)}`, { headers: authHeader(token) });
}

export async function deleteScan(token: string, id: string): Promise<void> {
  await request(`/scans/${encodeURIComponent(id)}`, { method: "DELETE", headers: authHeader(token) });
}

export function getMe(token: string): Promise<Account> {
  return request<Account>("/auth/me", { headers: authHeader(token) });
}

export async function reportScan(token: string, id: string): Promise<void> {
  await request(`/scans/${encodeURIComponent(id)}/report`, { method: "POST", headers: authHeader(token) });
}

// Route publique : la carte ne dépend pas du compte
export function getZones(days = 90): Promise<{ zones: Zone[]; period_days: number }> {
  return request(`/community/zones?days=${days}`, {});
}

export function getNotifications(token: string): Promise<{ items: AppNotification[]; unread: number }> {
  return request("/notifications", { headers: authHeader(token) });
}

export async function markNotificationRead(token: string, id: string): Promise<void> {
  await request(`/notifications/${encodeURIComponent(id)}/read`, { method: "POST", headers: authHeader(token) });
}

export function getStats(token: string): Promise<UserStats> {
  return request<UserStats>("/stats/me", { headers: authHeader(token) });
}
