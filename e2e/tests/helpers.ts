import { request, type APIRequestContext } from "@playwright/test";

export const API_URL = "http://127.0.0.1:8000";
export const PASSWORD = "motdepasse-e2e-solide";

export const QR = {
  safe: "https://www.wikipedia.org",
  suspicious: "https://paypa1-securite.top/login",
  dangerous: "http://testsafebrowsing.appspot.com/s/phishing.html",
  wifi: "WIFI:T:WPA;S:MaBox_Test;P:MonMotDePasseSecret123;;",
  text: "Bonjour QRShield",
};

export function uniqueEmail(prefix: string): string {
  return `e2e-${prefix}-${Date.now()}@test.fr`;
}

export async function apiContext(token?: string): Promise<APIRequestContext> {
  return request.newContext({
    baseURL: API_URL,
    extraHTTPHeaders: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

export async function createAccount(email: string): Promise<string> {
  const api = await apiContext();
  const created = await api.post("/auth/register", { data: { email, password: PASSWORD } });
  if (created.status() !== 201) throw new Error(`inscription : ${created.status()}`);
  const login = await api.post("/auth/login", { form: { username: email, password: PASSWORD } });
  const { access_token: token } = (await login.json()) as { access_token: string };
  await api.dispose();
  return token;
}

// Les signalements sont anonymes : ils ne disparaissent qu'avec les scans, pas avec le compte
export async function deleteAllScans(token: string): Promise<void> {
  const api = await apiContext(token);
  const list = await (await api.get("/scans?limit=100")).json();
  for (const scan of list.items as { id: string }[]) {
    await api.delete(`/scans/${scan.id}`);
  }
  await api.dispose();
}

export async function communityTotal(): Promise<number> {
  const api = await apiContext();
  const stats = await (await api.get("/community/stats")).json();
  await api.dispose();
  return stats.total_reports as number;
}
