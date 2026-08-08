import type { Analysis, Scan } from "@/services/api";

import { barWidth, categoryLabels, mergeScans, scanTitle } from "../labels";

const analysis: Analysis = {
  final_url: "https://exemple.fr",
  domain: "exemple.fr",
  score: 92,
  verdict: "safe",
  reasons: [],
  redirect_chain: [],
  analyzed_at: "2025-01-06T09:30:05.000Z",
};

function makeScan(overrides: Partial<Scan>): Scan {
  return {
    id: "scan-1",
    content: "https://exemple.fr",
    content_type: "text/plain",
    category: "website",
    url: null,
    verdict: "unknown",
    latitude: null,
    longitude: null,
    scanned_at: "2025-01-06T09:30:00.000Z",
    analysis: null,
    ...overrides,
  } as Scan;
}

describe("categoryLabels", () => {
  it("donne un libellé pour chaque catégorie", () => {
    expect(categoryLabels.website).toBe("Sites web");
    expect(categoryLabels.menu).toBe("Menus");
    expect(categoryLabels.payment).toBe("Paiements");
    expect(categoryLabels.wifi).toBe("Wi-Fi");
    expect(categoryLabels.other).toBe("Autres");
  });
});

describe("scanTitle", () => {
  it("privilégie le domaine analysé", () => {
    expect(scanTitle(makeScan({ url: "https://exemple.fr/page", analysis }))).toBe("exemple.fr");
  });

  it("se rabat sur l'URL", () => {
    expect(scanTitle(makeScan({ url: "https://exemple.fr/page" }))).toBe("https://exemple.fr/page");
  });

  it("se rabat sur le contenu", () => {
    expect(scanTitle(makeScan({ url: null, content: "MENU DU JOUR" }))).toBe("MENU DU JOUR");
  });
});

describe("barWidth", () => {
  it("renvoie 0 pour une valeur nulle", () => {
    expect(barWidth(0, 10)).toBe(0);
  });

  it("renvoie le pourcentage entier", () => {
    expect(barWidth(5, 10)).toBe(50);
  });

  it("garde une largeur visible pour une petite valeur", () => {
    expect(barWidth(1, 1000)).toBe(2);
  });

  it("renvoie 0 quand le maximum est nul", () => {
    expect(barWidth(3, 0)).toBe(0);
  });
});

describe("mergeScans", () => {
  it("n'ajoute jamais deux fois le même scan", () => {
    const a = { id: "a" } as Scan;
    const b = { id: "b" } as Scan;
    const c = { id: "c" } as Scan;
    expect(mergeScans([a, b], [b, c]).map((scan) => scan.id)).toEqual(["a", "b", "c"]);
  });
});

describe("scanTitle pour un QR code Wi-Fi", () => {
  it("affiche le nom du réseau et pas le contenu brut", () => {
    const scan = { content_type: "wifi", content: "WIFI:T:WPA;S:MaBox_Test;P:***;;", analysis: null, url: null } as Scan;
    expect(scanTitle(scan)).toBe("Wi-Fi : MaBox_Test");
  });
});
