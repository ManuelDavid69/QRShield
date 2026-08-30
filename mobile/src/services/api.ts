import Constants from "expo-constants";

import { t } from "@/i18n";
import { serverErrorText } from "@/i18n/reasons";
import { loadRefreshToken, saveTokens } from "@/services/tokenStorage";

export type Verdict = "unknown" | "safe" | "suspicious" | "dangerous";
export type Severity = "info" | "low" | "medium" | "high" | "critical";
export type ScanCategory = "website" | "menu" | "payment" | "wifi" | "other";

export interface Reason {
  code: string;
  severity: Severity;
  message: string;
  params?: Record<string, string>;
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
  has_recovery_code: boolean;
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

// L'analyse peut prendre 15 s, et un hébergement gratuit met environ une minute à se réveiller
const TIMEOUT_MS = 80_000;

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
    if (field === "password" || field === "new_password") return t.api.passwordLength;
    if (field === "email") return t.api.invalidEmail;
    return t.api.invalidInput;
  }
  return typeof detail === "string" ? serverErrorText(detail) : t.api.serverError;
}

interface TokenPair {
  access_token: string;
  refresh_token: string;
}

let sessionListener: (accessToken: string) => void = () => undefined;
let refreshing: Promise<string | null> | null = null;

export function onSessionRefreshed(listener: (accessToken: string) => void): void {
  sessionListener = listener;
}

async function renewSession(): Promise<string | null> {
  const refreshToken = await loadRefreshToken();
  if (refreshToken === null) return null;
  try {
    const pair = await request<TokenPair>("/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    await saveTokens(pair.access_token, pair.refresh_token);
    sessionListener(pair.access_token);
    return pair.access_token;
  } catch (error) {
    // Hors connexion, la session reste valable : seul un refus du serveur y met fin
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

// Un jeton déjà utilisé coupe la session : plusieurs requêtes refusées en même temps
// doivent donc partager un seul renouvellement
function renewOnce(): Promise<string | null> {
  refreshing ??= renewSession().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

async function request<T>(path: string, init: RequestInit, canRenew = true): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}${path}`, { ...init, signal: controller.signal });
  } catch {
    throw new ApiError(0, t.api.unreachable);
  } finally {
    clearTimeout(timer);
  }

  const headers = init.headers as Record<string, string> | undefined;
  if (response.status === 401 && canRenew && headers?.Authorization) {
    const accessToken = await renewOnce();
    if (accessToken !== null) {
      return request<T>(path, { ...init, headers: { ...headers, Authorization: `Bearer ${accessToken}` } }, false);
    }
  }

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(response.status, errorMessage(response.status, body));
  return body as T;
}

export async function login(email: string, password: string): Promise<TokenPair> {
  // OAuth2 impose un formulaire urlencoded, pas du JSON
  const form = new URLSearchParams({ username: email, password }).toString();
  return request<TokenPair>("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });
}

export async function logout(refreshToken: string): Promise<void> {
  await request("/auth/logout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
}

export function register(email: string, password: string): Promise<{ recovery_code: string }> {
  return request("/auth/register", {
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

export function resetPassword(email: string, code: string, password: string): Promise<{ recovery_code: string }> {
  return request("/auth/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, recovery_code: code, new_password: password }),
  });
}

export function createRecoveryCode(token: string, password: string): Promise<{ recovery_code: string }> {
  return request("/auth/recovery-code", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader(token) },
    body: JSON.stringify({ password }),
  });
}

export async function deleteAccount(token: string, password: string): Promise<void> {
  await request("/auth/delete-account", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader(token) },
    body: JSON.stringify({ password }),
  });
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
