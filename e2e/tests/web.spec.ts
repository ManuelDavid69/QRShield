import { expect, test } from "@playwright/test";

import { apiContext } from "./helpers";

test.describe("Page web publique", () => {
  test("affiche les vrais chiffres de l'API, sans erreur", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));

    const api = await apiContext();
    const stats = await (await api.get("/community/stats")).json();
    await api.dispose();

    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Les QR codes piégés signalés en France");
    await expect(page.getByText("les chiffres affichés sont fictifs", { exact: false })).toBeVisible();

    const figures = page.locator(".figure-value");
    await expect(figures.nth(0)).toHaveText(String(stats.total_reports));
    await expect(figures.nth(1)).toHaveText(String(stats.dangerous_reports));
    await expect(figures.nth(2)).toHaveText(String(stats.zones));
    expect(errors).toEqual([]);
  });

  test("la carte charge ses tuiles et une zone par cercle", async ({ page }) => {
    const api = await apiContext();
    const { zones } = await (await api.get("/community/zones")).json();
    await api.dispose();

    await page.goto("/");
    await expect(page.locator("path.leaflet-interactive")).toHaveCount(zones.length);
    await expect
      .poll(() =>
        page.locator(".leaflet-tile").evaluateAll((tiles) =>
          tiles.filter((tile) => (tile as HTMLImageElement).naturalWidth > 0).length,
        ),
      )
      .toBeGreaterThan(3);

    const circle = page.locator("path.leaflet-interactive").first();
    await circle.dispatchEvent("mouseover");
    await expect(page.locator(".leaflet-tooltip")).toContainText("signalements, dont");
  });

  test("le tableau remplace la carte pour qui ne peut pas la lire", async ({ page }) => {
    await page.goto("/");
    await page.getByText("Voir les données sous forme de tableau").click();
    await expect(page.locator("table tbody tr").first()).toBeVisible();
  });

  test("le graphique a une barre par semaine et une infobulle", async ({ page }) => {
    await page.goto("/");
    const bars = page.locator(".recharts-bar-rectangle");
    await expect(bars.first()).toBeVisible();
    await bars.nth(3).hover();
    await expect(page.getByText("Semaine du", { exact: false })).toBeVisible();
  });

  test("aucun défilement horizontal sur téléphone", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto("/");
    await expect(page.locator("path.leaflet-interactive").first()).toBeAttached();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
  });
});
