import { setCurrentLang, t } from "@/i18n";
import { MESSAGES } from "@/i18n/messages";
import { alertText, reasonText, serverErrorText } from "@/i18n/reasons";
import type { AppNotification, Reason } from "@/services/api";

const lookalike: Reason = {
  code: "brand_lookalike",
  severity: "high",
  message: "Le domaine paypa1.com imite paypal.com en remplaçant des lettres par des caractères qui leur ressemblent.",
  params: { domain: "paypa1.com", official: "paypal.com" },
};

const alert: AppNotification = {
  id: "1",
  title: "Lien reclassé dangereux",
  body: "Un lien que vous avez scanné (exemple.top) est maintenant considéré comme dangereux.",
  scan_id: null,
  created_at: "2026-11-03T10:00:00Z",
  read: false,
};

function keysOf(value: object): string[] {
  return Object.entries(value).flatMap(([key, child]) =>
    typeof child === "object" && child !== null ? keysOf(child as object).map((k) => `${key}.${k}`) : [key],
  );
}

describe("traduction", () => {
  afterEach(() => setCurrentLang("fr"));

  it("couvre les mêmes clés dans les deux langues", () => {
    expect(keysOf(MESSAGES.en).sort()).toEqual(keysOf(MESSAGES.fr).sort());
  });

  it("garde le message du serveur en français", () => {
    expect(reasonText(lookalike)).toBe(lookalike.message);
  });

  it("traduit une raison à partir de son code et de ses valeurs", () => {
    setCurrentLang("en");
    expect(reasonText(lookalike)).toContain("imitates paypal.com");
  });

  it("garde le français pour une ancienne analyse sans valeurs", () => {
    setCurrentLang("en");
    expect(reasonText({ ...lookalike, params: undefined })).toBe(lookalike.message);
  });

  it("garde le message pour un code inconnu", () => {
    setCurrentLang("en");
    expect(reasonText({ ...lookalike, code: "inconnu" })).toBe(lookalike.message);
  });

  it("traduit les menaces Safe Browsing", () => {
    setCurrentLang("en");
    const reason: Reason = {
      code: "safe_browsing",
      severity: "critical",
      message: "x",
      params: { threats: "SOCIAL_ENGINEERING,MALWARE" },
    };
    expect(reasonText(reason)).toContain("(phishing, malware)");
  });

  it("traduit les alertes de reclassement à l'affichage", () => {
    expect(alertText(alert).body).toBe(alert.body);
    setCurrentLang("en");
    expect(alertText(alert).body).toContain("A link you scanned (exemple.top)");
  });

  it("traduit les erreurs connues du serveur", () => {
    setCurrentLang("en");
    expect(serverErrorText("Mot de passe incorrect")).toBe("Incorrect password");
    expect(serverErrorText("Erreur inconnue")).toBe("Erreur inconnue");
  });

  it("met à jour les textes quand la langue change", () => {
    expect(t.nav.history).toBe("Historique");
    setCurrentLang("en");
    expect(t.nav.history).toBe("History");
  });
});
