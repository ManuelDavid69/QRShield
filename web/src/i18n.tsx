import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { ThreatType } from "./services/api";

export type Lang = "en" | "fr";

const STORAGE_KEY = "qrshield.lang";

const en = {
  documentTitle: "QRShield · Check a QR code before you open it",
  navFeatures: "Features",
  navHow: "How it works",
  navMap: "Community map",
  navPrivacy: "Privacy",
  title: "Check where a QR code leads before you open it",
  lead: "QRShield scans a QR code, follows the link to its real destination and tells you whether it looks safe, suspicious or dangerous.",
  ctaCode: "View the code on GitHub",
  ctaMap: "See the map",
  availability: "The app is not on the App Store or Google Play yet.",
  heroAlt: "QRShield result screen showing a suspicious link with a score of 55 out of 100",
  featuresTitle: "What QRShield does",
  features: [
    { title: "Shows the real destination", text: "It follows every redirect and shows the address the link actually reaches." },
    { title: "Detects phishing", text: "It spots domains that imitate known brands, such as paypa1.com instead of paypal.com." },
    { title: "Checks known threats", text: "Every link is checked against Google Safe Browsing and VirusTotal." },
    { title: "Flags risky downloads", text: "It warns you when a link points directly to a file such as an .apk or an .exe." },
    { title: "Keeps your history", text: "Your scans are saved, with filters and personal statistics." },
    { title: "Sends alerts", text: "You are notified if a link you scanned is later found to be dangerous." },
  ],
  howTitle: "How it works",
  steps: [
    { title: "Scan", text: "Point your camera at the QR code. Nothing opens automatically." },
    { title: "Analyze", text: "The server follows the link, inspects the address and checks reputation services." },
    { title: "Decide", text: "You see a score out of 100 with the reasons, then choose whether to open the link." },
  ],
  screensTitle: "Inside the app",
  screensIntro: "Real screens from the app, which is in French for now.",
  screens: [
    { caption: "A dangerous link", alt: "Result screen showing a dangerous link with a score of 100 out of 100" },
    { caption: "Scan history", alt: "History screen listing five scans with their verdicts" },
    { caption: "Personal statistics", alt: "Statistics screen showing scans per week, verdicts and QR code types" },
  ],
  mapTitle: "Community map",
  mapIntro: "Suspicious and dangerous links reported by users, grouped by area.",
  demoNote: "Demo data: the app has no public users yet, so the figures below are fictional.",
  unavailable: "The data is not available right now.",
  loading: "Loading the data…",
  figuresLabel: "Key figures",
  reports: "reports",
  dangerousLinks: "dangerous links",
  areas: "areas",
  period: (days: number) => `Over the last ${days} days`,
  perWeek: "Reports per week",
  threatType: "Type of threat",
  threats: { phishing: "Phishing", malware: "Malware downloads", other: "Other scams" } as Record<ThreatType, string>,
  privacyTitle: "Privacy",
  privacyIntro: "A public map must not reveal where people go, so reports are anonymous by design.",
  privacy: [
    { title: "No link to you", text: "A report is not tied to your account or to your scan." },
    { title: "Approximate locations", text: "Positions are rounded to a grid of about 1 km." },
    { title: "No isolated points", text: "An area only appears once it has at least two reports." },
    { title: "Wi-Fi passwords stay private", text: "They are removed before a scan leaves your phone." },
  ],
  footer: "A project by Manuel David, CPE Lyon.",
  noData: "No data yet.",
  tableToggle: "Show the data as a table",
  tableCity: "City",
  tableReports: "Reports",
  tableDangerous: "Dangerous",
  legendDangerous: "Mostly dangerous links",
  legendSuspicious: "Mostly suspicious links",
  legendSize: "A bigger circle means more reports.",
  mapTooltip: (reports: number, dangerous: number) => `${reports} reports, ${dangerous} dangerous`,
  weekOf: (date: string) => `Week of ${date}`,
};

type Messages = typeof en;

const fr: Messages = {
  documentTitle: "QRShield · Vérifiez un QR code avant de l'ouvrir",
  navFeatures: "Fonctionnalités",
  navHow: "Fonctionnement",
  navMap: "Carte communautaire",
  navPrivacy: "Confidentialité",
  title: "Vérifiez où mène un QR code avant de l'ouvrir",
  lead: "QRShield scanne un QR code, suit le lien jusqu'à sa vraie destination et vous indique s'il semble sûr, suspect ou dangereux.",
  ctaCode: "Voir le code sur GitHub",
  ctaMap: "Voir la carte",
  availability: "L'application n'est pas encore disponible sur l'App Store ni sur Google Play.",
  heroAlt: "Écran de résultat de QRShield affichant un lien suspect avec un score de 55 sur 100",
  featuresTitle: "Ce que fait QRShield",
  features: [
    { title: "Montre la vraie destination", text: "L'application suit chaque redirection et affiche l'adresse réellement atteinte." },
    { title: "Détecte le phishing", text: "Elle repère les domaines qui imitent des marques connues, comme paypa1.com au lieu de paypal.com." },
    { title: "Vérifie les menaces connues", text: "Chaque lien est contrôlé auprès de Google Safe Browsing et de VirusTotal." },
    { title: "Signale les téléchargements risqués", text: "Elle vous prévient quand un lien mène directement à un fichier .apk ou .exe." },
    { title: "Conserve votre historique", text: "Vos scans sont enregistrés, avec des filtres et des statistiques personnelles." },
    { title: "Envoie des alertes", text: "Vous êtes prévenu si un lien scanné est reconnu comme dangereux par la suite." },
  ],
  howTitle: "Comment ça fonctionne",
  steps: [
    { title: "Scanner", text: "Visez le QR code avec la caméra. Rien ne s'ouvre automatiquement." },
    { title: "Analyser", text: "Le serveur suit le lien, examine l'adresse et interroge les services de réputation." },
    { title: "Décider", text: "Vous voyez un score sur 100 et ses raisons, puis vous choisissez d'ouvrir le lien ou non." },
  ],
  screensTitle: "Aperçu de l'application",
  screensIntro: "De vrais écrans de l'application.",
  screens: [
    { caption: "Un lien dangereux", alt: "Écran de résultat affichant un lien dangereux avec un score de 100 sur 100" },
    { caption: "L'historique des scans", alt: "Écran d'historique listant cinq scans et leurs verdicts" },
    { caption: "Les statistiques personnelles", alt: "Écran de statistiques affichant les scans par semaine, les verdicts et les types de QR codes" },
  ],
  mapTitle: "Carte communautaire",
  mapIntro: "Les liens suspects et dangereux signalés par les utilisateurs, regroupés par zone.",
  demoNote: "Données de démonstration : l'application n'a pas encore d'utilisateurs publics, les chiffres ci-dessous sont donc fictifs.",
  unavailable: "Les données ne sont pas disponibles pour le moment.",
  loading: "Chargement des données…",
  figuresLabel: "Chiffres clés",
  reports: "signalements",
  dangerousLinks: "liens dangereux",
  areas: "zones",
  period: (days) => `Sur les ${days} derniers jours`,
  perWeek: "Signalements par semaine",
  threatType: "Type de menace",
  threats: { phishing: "Hameçonnage", malware: "Logiciels malveillants", other: "Autres arnaques" },
  privacyTitle: "Confidentialité",
  privacyIntro: "Une carte publique ne doit pas révéler où passent les gens : les signalements sont donc anonymes dès leur conception.",
  privacy: [
    { title: "Aucun lien avec vous", text: "Un signalement n'est rattaché ni à votre compte ni à votre scan." },
    { title: "Positions approximatives", text: "Les positions sont arrondies à une maille d'environ 1 km." },
    { title: "Aucun point isolé", text: "Une zone n'apparaît qu'à partir de deux signalements." },
    { title: "Mots de passe Wi-Fi protégés", text: "Ils sont retirés avant qu'un scan ne quitte votre téléphone." },
  ],
  footer: "Un projet de Manuel David, CPE Lyon.",
  noData: "Pas encore de données.",
  tableToggle: "Voir les données sous forme de tableau",
  tableCity: "Ville",
  tableReports: "Signalements",
  tableDangerous: "Dangereux",
  legendDangerous: "Majorité de liens dangereux",
  legendSuspicious: "Majorité de liens suspects",
  legendSize: "Plus le cercle est grand, plus il y a de signalements.",
  mapTooltip: (reports, dangerous) => `${reports} signalements, dont ${dangerous} dangereux`,
  weekOf: (date) => `Semaine du ${date}`,
};

const MESSAGES: Record<Lang, Messages> = { en, fr };

function initialLang(): Lang {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "fr") return saved;
  } catch {
    // Stockage bloqué (navigation privée) : on se rabat sur la langue du navigateur
  }
  return navigator.language.toLowerCase().startsWith("fr") ? "fr" : "en";
}

interface LangState {
  lang: Lang;
  locale: string;
  t: Messages;
  setLang: (lang: Lang) => void;
}

const LangContext = createContext<LangState | null>(null);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = MESSAGES[lang].documentTitle;
  }, [lang]);

  const value = useMemo(
    () => ({
      lang,
      locale: lang === "fr" ? "fr-FR" : "en-US",
      t: MESSAGES[lang],
      setLang: (next: Lang) => {
        setLangState(next);
        try {
          window.localStorage.setItem(STORAGE_KEY, next);
        } catch {
          // Le choix tiendra jusqu'à la fermeture de la page
        }
      },
    }),
    [lang],
  );

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang(): LangState {
  const context = useContext(LangContext);
  if (context === null) throw new Error("useLang doit être utilisé dans LangProvider");
  return context;
}
