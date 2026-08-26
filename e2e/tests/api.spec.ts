import { expect, test, type APIRequestContext } from "@playwright/test";

import { apiContext, communityTotal, createAccount, deleteAllScans, PASSWORD, QR, uniqueEmail } from "./helpers";

test.describe.serial("API sur la vraie pile Docker", () => {
  let token: string;
  let api: APIRequestContext;
  let initialTotal: number;

  test.beforeAll(async () => {
    initialTotal = await communityTotal();
    token = await createAccount(uniqueEmail("api"));
    api = await apiContext(token);
  });

  test.afterAll(async () => {
    await deleteAllScans(token);
    await api.dispose();
    expect(await communityTotal()).toBe(initialTotal);
  });

  const scan = async (content: string, extra: object = {}) => {
    const response = await api.post("/scans", { data: { content, ...extra }, timeout: 60_000 });
    expect(response.status()).toBe(201);
    return response.json();
  };

  test("les services de réputation répondent pour de vrai", async () => {
    const body = await scan(QR.dangerous);
    expect(body.verdict).toBe("dangerous");
    expect(body.analysis.domain).toBe("testsafebrowsing.appspot.com");
    const codes = body.analysis.reasons.map((reason: { code: string }) => reason.code);
    expect(codes).toContain("safe_browsing");
    expect(JSON.stringify(body)).toContain("hameçonnage");
  });

  for (const target of ["http://127.0.0.1:5432/", "http://169.254.169.254/latest/meta-data"]) {
    test(`SSRF : ${target} n'est jamais contacté`, async () => {
      const body = await scan(target);
      const codes = body.analysis.reasons.map((reason: { code: string }) => reason.code);
      expect(codes).toContain("private_address");
      expect(body.verdict).toBe("dangerous");
    });
  }

  test("un mot de passe Wi-Fi envoyé en clair n'est jamais conservé", async () => {
    const body = await scan(QR.wifi);
    expect(JSON.stringify(body)).not.toContain("MonMotDePasseSecret123");
  });

  test("les routes publiques ne révèlent aucune donnée personnelle", async () => {
    await scan(QR.suspicious, { latitude: 45.764, longitude: 4.836 });
    const anonymous = await apiContext();
    for (const path of ["/community/zones", "/community/stats"]) {
      const response = await anonymous.get(path);
      expect(response.status()).toBe(200);
      const text = await response.text();
      for (const forbidden of ["user_id", "reporter_hash", "email", "paypa1-securite.top/login"]) {
        expect(text).not.toContain(forbidden);
      }
    }
    await anonymous.dispose();
  });

  test("un refresh token volé puis rejoué coupe la session", async () => {
    const email = uniqueEmail("session");
    const anonymous = await apiContext();
    await anonymous.post("/auth/register", { data: { email, password: PASSWORD } });
    const login = await (await anonymous.post("/auth/login", { form: { username: email, password: PASSWORD } })).json();
    const refresh = (refresh_token: string) => anonymous.post("/auth/refresh", { data: { refresh_token } });

    const renewed = await refresh(login.refresh_token);
    expect(renewed.status()).toBe(200);
    const { refresh_token: latest } = await renewed.json();

    expect((await refresh(login.refresh_token)).status()).toBe(401);
    expect((await refresh(latest)).status()).toBe(401);
    await anonymous.dispose();
  });

  test("les données d'un utilisateur restent privées", async () => {
    const anonymous = await apiContext();
    expect((await anonymous.get("/scans")).status()).toBe(401);
    expect((await anonymous.get("/stats/me")).status()).toBe(401);
    await anonymous.dispose();

    const mine = await scan(QR.safe);
    const other = await apiContext(await createAccount(uniqueEmail("autre")));
    expect((await other.get(`/scans/${mine.id}`)).status()).toBe(404);
    expect((await other.delete(`/scans/${mine.id}`)).status()).toBe(404);
    expect((await other.post(`/scans/${mine.id}/report`)).status()).toBe(404);
    await other.dispose();
  });
});
