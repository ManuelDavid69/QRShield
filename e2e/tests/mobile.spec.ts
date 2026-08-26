import { expect, test, type Browser, type Page, type Request } from "@playwright/test";

import { communityTotal, deleteAllScans, PASSWORD, QR, uniqueEmail } from "./helpers";

// Le vrai code de l'application, dans un navigateur au format téléphone, contre la vraie API.
// La lecture par la caméra est remplacée par un accès direct à l'écran de résultat.
test.describe.serial("Parcours complet dans l'application", () => {
  const email = uniqueEmail("mobile");
  const problems: string[] = [];
  let page: Page;
  let initialTotal: number;

  const scan = (content: string) => page.goto(`/result?data=${encodeURIComponent(content)}`);

  // Répond à la prochaine fenêtre de confirmation et renvoie son texte
  const nextDialog = (answer: "accept" | "dismiss") =>
    new Promise<string>((resolve) => {
      page.once("dialog", async (dialog) => {
        const text = dialog.message();
        await dialog[answer]();
        resolve(text);
      });
    });

  const tab = (name: string) => page.getByRole("tab", { name, exact: false }).or(page.getByRole("link", { name, exact: false }));

  async function token(): Promise<string> {
    return page.evaluate(() => window.localStorage.getItem("qrshield.access_token") ?? "");
  }

  test.beforeAll(async ({ browser }: { browser: Browser }) => {
    initialTotal = await communityTotal();
    const context = await browser.newContext({
      baseURL: "http://localhost:8082",
      viewport: { width: 390, height: 800 },
      geolocation: { latitude: 45.76412, longitude: 4.83568 },
      permissions: ["geolocation", "camera"],
    });
    page = await context.newPage();
    page.on("console", (message) => {
      if (message.type() === "error" && !message.text().includes("Failed to load resource")) {
        problems.push(message.text());
      }
    });
    page.on("pageerror", (error) => problems.push(error.message));
  });

  test.afterAll(async () => {
    const current = await token();
    if (current) await deleteAllScans(current);
    await page.context().close();
    expect(await communityTotal()).toBe(initialTotal);
  });

  test("inscription : un mot de passe trop court est expliqué", async () => {
    await page.goto("/");
    await expect(page.getByText("Connexion", { exact: true })).toBeVisible();
    await page.getByText("Créer un compte", { exact: true }).click();
    await page.getByPlaceholder("Adresse e-mail").fill(email);
    await page.getByPlaceholder("Mot de passe").fill("court");
    await page.getByText("Créer mon compte", { exact: true }).click();
    await expect(page.getByText("Le mot de passe doit contenir au moins 10 caractères.")).toBeVisible();
  });

  test("inscription réussie : les cinq onglets apparaissent", async () => {
    await page.getByPlaceholder("Mot de passe").fill(PASSWORD);
    await page.getByText("Créer mon compte", { exact: true }).click();
    for (const name of ["Scanner", "Historique", "Carte", "Stats", "Compte"]) {
      await expect(tab(name).first()).toBeVisible();
    }
  });

  test("déconnexion, e-mail déjà pris, mauvais mot de passe, puis connexion", async () => {
    await tab("Compte").first().click();
    await expect(page.getByText(email)).toBeVisible();
    await page.getByText("Se déconnecter", { exact: true }).click();

    await page.getByText("Créer un compte", { exact: true }).click();
    await page.getByPlaceholder("Adresse e-mail").fill(email);
    await page.getByPlaceholder("Mot de passe").fill(PASSWORD);
    await page.getByText("Créer mon compte", { exact: true }).click();
    await expect(page.getByText("Un compte existe déjà avec cet email")).toBeVisible();

    await page.getByText("Se connecter", { exact: true }).click();
    await page.getByPlaceholder("Adresse e-mail").fill(email);
    await page.getByPlaceholder("Mot de passe").fill("mauvais-mot-de-passe");
    await page.locator("text=Se connecter").last().click();
    await expect(page.getByText("Email ou mot de passe incorrect")).toBeVisible();

    await page.getByPlaceholder("Mot de passe").fill(PASSWORD);
    await page.locator("text=Se connecter").last().click();
    await expect(tab("Historique").first()).toBeVisible();
  });

  test("la session survit à un redémarrage de l'application", async () => {
    await page.reload();
    await expect(tab("Historique").first()).toBeVisible();
  });

  test("jeton d'accès expiré : la session se renouvelle sans se reconnecter", async () => {
    const before = await page.evaluate(() => window.localStorage.getItem("qrshield.refresh_token"));
    await page.evaluate(() => window.localStorage.setItem("qrshield.access_token", "jeton-expire"));
    await page.reload();
    await tab("Compte").first().click();
    await expect(page.getByText(email)).toBeVisible();
    const after = await page.evaluate(() => window.localStorage.getItem("qrshield.refresh_token"));
    expect(after).not.toBe(before);
    expect(await token()).not.toBe("jeton-expire");
  });

  test("lien sûr : verdict vert, position arrondie à 100 mètres", async () => {
    const sent = page.waitForRequest((request: Request) => request.url().endsWith("/scans") && request.method() === "POST");
    await scan(QR.safe);
    const body = (await sent).postDataJSON();
    expect(body.latitude).toBe(45.764);
    expect(body.longitude).toBe(4.836);

    await expect(page.getByText("Aucun danger détecté")).toBeVisible();
    await expect(page.getByText("0/100", { exact: true })).toBeVisible();
    await expect(page.getByText("wikipedia.org", { exact: true })).toBeVisible();
    await expect(page.getByText("Ouvrir le lien")).toBeVisible();
  });

  test("signalement : annuler ne fait rien, confirmer enregistre", async () => {
    const before = await communityTotal();
    await expect(page.getByText("Signaler ce lien")).toBeVisible();

    let dialog = nextDialog("dismiss");
    await page.getByText("Signaler ce lien").click();
    expect(await dialog).toContain("Signaler ce lien ?");
    await expect(page.getByText("Signaler ce lien")).toBeVisible();
    expect(await communityTotal()).toBe(before);

    dialog = nextDialog("accept");
    await page.getByText("Signaler ce lien").click();
    await dialog;
    await expect(page.getByText("Merci, votre signalement a bien été enregistré.")).toBeVisible();
    expect(await communityTotal()).toBe(before + 1);
  });

  test("lien suspect : score, raisons et bouton en second plan", async () => {
    await scan(QR.suspicious);
    await expect(page.getByText("Lien suspect")).toBeVisible();
    await expect(page.getByText("55/100")).toBeVisible();
    await expect(page.getByText("paypa1-securite.top", { exact: true })).toBeVisible();
    await expect(page.getByText("imite paypal.com", { exact: false })).toBeVisible();
    await expect(page.getByText("Ouvrir quand même")).toBeVisible();
    await expect(page.getByText("Ouvrir le lien")).toHaveCount(0);
  });

  test("lien dangereux : traduit, et l'ouverture exige une confirmation", async () => {
    await scan(QR.dangerous);
    await expect(page.getByText("Lien dangereux")).toBeVisible();
    await expect(page.getByText("100/100")).toBeVisible();
    await expect(page.getByText("testsafebrowsing.appspot.com", { exact: true })).toBeVisible();
    await expect(page.getByText("hameçonnage", { exact: false })).toBeVisible();

    const dialog = nextDialog("dismiss");
    await page.getByText("Ouvrir quand même").click();
    expect(await dialog).toContain("Lien dangereux");
    await expect(page).toHaveURL(/result/);
  });

  test("Wi-Fi : le mot de passe ne quitte jamais le téléphone", async () => {
    const sent = page.waitForRequest((request: Request) => request.url().endsWith("/scans") && request.method() === "POST");
    await scan(QR.wifi);
    expect((await sent).postData()).not.toContain("MonMotDePasseSecret123");

    await expect(page.getByText("MaBox_Test")).toBeVisible();
    await expect(page.getByText("********")).toBeVisible();
    await expect(page.getByText("MonMotDePasseSecret123")).toHaveCount(0);
    await expect(page.getByText("Signaler ce lien")).toHaveCount(0);
  });

  test("texte : pas de bouton de signalement", async () => {
    await scan(QR.text);
    await expect(page.getByText("Bonjour QRShield")).toBeVisible();
    await expect(page.getByText("Texte", { exact: true })).toBeVisible();
    await expect(page.getByText("Signaler ce lien")).toHaveCount(0);
  });

  test("historique : filtres justes et aucun doublon", async () => {
    await page.goto("/history");
    await expect(page.getByText("Bonjour QRShield")).toBeVisible();
    await expect(page.getByText("Wi-Fi : MaBox_Test")).toBeVisible();

    await page.getByText("Dangereux", { exact: true }).click();
    await expect(page.getByText("100/100")).toHaveCount(1);
    await expect(page.getByText("Bonjour QRShield")).toHaveCount(0);

    await page.getByText("Suspects", { exact: true }).click();
    await expect(page.getByText("55/100")).toHaveCount(1);

    await page.getByText("Sûrs", { exact: true }).click();
    await expect(page.getByText("0/100", { exact: true })).toHaveCount(1);

    // Des changements rapides d'onglet et de filtre provoquaient les doublons
    await page.getByText("Tous", { exact: true }).click();
    await tab("Stats").first().click();
    await tab("Historique").first().click();
    await expect(page.getByText("Bonjour QRShield")).toHaveCount(1);
    await expect(page.getByText("100/100")).toHaveCount(1);
  });

  test("statistiques : chiffres exacts", async () => {
    await tab("Stats").first().click();
    await expect(page.getByText("40 %")).toBeVisible();
    await expect(page.getByText("2 sur 5")).toBeVisible();
    await expect(page.getByText("Scans par semaine")).toBeVisible();
    await expect(page.getByText("Lieux où vous scannez le plus")).toBeVisible();
  });

  test("carte : un cercle par zone, une bulle au toucher, aucun lien", async () => {
    await tab("Carte").first().click();
    const map = page.frameLocator('iframe[title="Carte communautaire"]');
    const circles = map.locator("path.leaflet-interactive");
    await expect(circles.first()).toBeAttached();
    expect(await circles.count()).toBeGreaterThan(10);

    await circles.first().dispatchEvent("click");
    await expect(map.locator(".leaflet-popup-content")).toContainText("signalements, dont");
    await expect(map.locator(".leaflet-control-attribution")).toContainText("OpenStreetMap");
    await expect(map.locator(".leaflet-control-attribution a")).toHaveCount(0);
    await expect(page.getByText("Majorité de liens dangereux")).toBeVisible();
  });

  test("suppression : annuler garde le scan, confirmer retire aussi le signalement", async () => {
    const before = await communityTotal();
    await tab("Historique").first().click();
    await page.getByText("0/100", { exact: true }).first().click();
    await expect(page.getByText("Signaler ce lien")).toBeVisible();

    let dialog = nextDialog("dismiss");
    await page.getByText("Supprimer ce scan").click();
    await dialog;
    await expect(page.getByText("Supprimer ce scan")).toBeVisible();

    dialog = nextDialog("accept");
    await page.getByText("Supprimer ce scan").click();
    await dialog;
    await expect(page.getByText("Bonjour QRShield")).toBeVisible();
    await expect(page.getByText("0/100", { exact: true })).toHaveCount(0);
    await expect.poll(communityTotal).toBe(before - 1);
  });

  test("aucune erreur pendant tout le parcours", () => {
    expect(problems).toEqual([]);
  });
});
