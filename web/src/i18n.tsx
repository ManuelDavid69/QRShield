import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { ThreatType } from "./services/api";

export type Lang = "en" | "fr";

const STORAGE_KEY = "qrshield.lang";

const en = {
  documentTitle: "QRShield · Check a QR code before you open it",
  navChecks: "Checks",
  navExample: "Example",
  navMap: "Map",
  navPrivacy: "Privacy",
  title: "Check where a QR code leads before you open it",
  lead: "QRShield is a mobile app that follows a QR code to its real destination and tells you whether the link looks safe, suspicious or dangerous.",
  ctaCode: "Source code on GitHub",
  ctaMap: "See the map",
  byline: "A personal project by Manuel David, engineering student at CPE Lyon. The app is not on the App Store or Google Play yet.",
  heroAlt: "QRShield result screen showing a suspicious link with a score of 55 out of 100",
  checksTitle: "What it checks",
  checks: [
    { title: "Redirects.", text: "The server follows up to 8 redirects and only reads the headers. An address that resolves to a private IP is refused, so a QR code cannot use the server to reach an internal network." },
    { title: "Lookalike domains.", text: "Domains are compared to a list of brands with a Levenshtein distance, after replacing misleading characters: paypa1, amaz0n, or a Cyrillic а in аpple.com." },
    { title: "Reputation.", text: "Google Safe Browsing, VirusTotal and the domain's registration date through RDAP, since scam sites are often only a few days old." },
    { title: "Downloads.", text: "A link that points straight to an .apk, an .exe or a similar file is flagged." },
  ],
  checksLimit: "This remains an aid: a low score does not prove that a site is safe.",
  dangerAlt: "Result screen showing a dangerous link with a score of 100 out of 100",
  exampleTitle: "A real analysis",
  exampleText: "This is the API's response for a fake PayPal address. The reason messages are left out here, and the app displays them in French for now.",
  exampleScore: "Each clue has a weight: 10 for low, 25 for medium, 45 for high and 80 for critical. Here, 45 + 10 gives 55. A link is suspicious from 30 and dangerous from 60.",
  exampleSource: "Read the scoring code",
  afterTitle: "In the app",
  after: [
    { title: "History.", text: "Scans are saved to your account and can be filtered by verdict." },
    { title: "Statistics.", text: "Scans per week, share of risky codes, types of links and the places where you scan the most." },
    { title: "Alerts.", text: "A worker analyzes saved links again. If one becomes dangerous, the app tells you." },
  ],
  historyAlt: "History screen listing five scans with their verdicts",
  statsAlt: "Statistics screen showing scans per week, verdicts and QR code types",
  mapTitle: "Community map",
  mapIntro: "Suspicious and dangerous links reported by users, grouped by area.",
  demoNote: "The app has no public users yet, so the figures below are fictional.",
  unavailable: "The data is not available right now.",
  loading: "Loading the data…",
  reports: "reports",
  dangerousLinks: "dangerous links",
  areas: "areas",
  period: (days: number) => `Over the last ${days} days.`,
  perWeek: "Reports per week",
  threatType: "Type of threat",
  threats: { phishing: "Phishing", malware: "Malware downloads", other: "Other scams" } as Record<ThreatType, string>,
  privacyTitle: "Privacy",
  privacyIntro: "A public map must not reveal where people go, so reports are anonymous by design.",
  privacy: [
    { title: "No link to you.", text: "A report is not tied to your account or to your scan." },
    { title: "Approximate locations.", text: "Positions are rounded to a grid of about 1 km." },
    { title: "No isolated points.", text: "An area only appears once it has at least two reports." },
    { title: "Wi-Fi passwords.", text: "They are removed before a scan leaves your phone." },
  ],
  techTitle: "How it is built",
  tech: [
    "The backend is written in Python with FastAPI, and the data is stored in PostgreSQL with PostGIS for the map. I chose React Native with Expo for the app because I develop on Windows and can still build for Android and iOS.",
    "The project has 273 backend tests, 56 mobile tests and 29 end-to-end tests. Some bugs still only showed up on a real phone, and the README describes them.",
  ],
  techLink: "Read the full README",
  footer: "Manuel David, CPE Lyon",
  license: "MIT license",
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
  navChecks: "Vérifications",
  navExample: "Exemple",
  navMap: "Carte",
  navPrivacy: "Confidentialité",
  title: "Vérifiez où mène un QR code avant de l'ouvrir",
  lead: "QRShield est une application mobile qui suit un QR code jusqu'à sa vraie destination et indique si le lien semble sûr, suspect ou dangereux.",
  ctaCode: "Code source sur GitHub",
  ctaMap: "Voir la carte",
  byline: "Projet personnel de Manuel David, élève ingénieur à CPE Lyon. L'application n'est pas encore sur l'App Store ni sur Google Play.",
  heroAlt: "Écran de résultat de QRShield affichant un lien suspect avec un score de 55 sur 100",
  checksTitle: "Ce qui est vérifié",
  checks: [
    { title: "Redirections.", text: "Le serveur suit jusqu'à 8 redirections en lisant seulement les en-têtes. Une adresse qui pointe vers une IP privée est refusée, pour qu'un QR code ne puisse pas se servir du serveur afin d'atteindre un réseau interne." },
    { title: "Domaines trompeurs.", text: "Les domaines sont comparés à une liste de marques avec une distance de Levenshtein, après remplacement des caractères trompeurs : paypa1, amaz0n ou un а cyrillique dans аpple.com." },
    { title: "Réputation.", text: "Google Safe Browsing, VirusTotal et la date d'enregistrement du domaine via RDAP, car les sites d'arnaque n'ont souvent que quelques jours." },
    { title: "Téléchargements.", text: "Un lien qui mène directement à un fichier .apk, .exe ou équivalent est signalé." },
  ],
  checksLimit: "L'analyse reste une aide : un score faible ne prouve pas qu'un site est sûr.",
  dangerAlt: "Écran de résultat affichant un lien dangereux avec un score de 100 sur 100",
  exampleTitle: "Une vraie analyse",
  exampleText: "Voici la réponse de l'API pour une fausse adresse PayPal. Les messages explicatifs sont retirés ici, l'application les affiche à l'écran.",
  exampleScore: "Chaque indice a un poids : 10 pour faible, 25 pour moyen, 45 pour élevé et 80 pour critique. Ici, 45 + 10 donne 55. Un lien est suspect à partir de 30 et dangereux à partir de 60.",
  exampleSource: "Lire le code du score",
  afterTitle: "Dans l'application",
  after: [
    { title: "Historique.", text: "Les scans sont enregistrés sur votre compte et peuvent être filtrés par verdict." },
    { title: "Statistiques.", text: "Scans par semaine, part de codes à risque, types de liens et lieux où vous scannez le plus." },
    { title: "Alertes.", text: "Un worker analyse à nouveau les liens enregistrés. Si l'un d'eux devient dangereux, l'application vous prévient." },
  ],
  historyAlt: "Écran d'historique listant cinq scans et leurs verdicts",
  statsAlt: "Écran de statistiques affichant les scans par semaine, les verdicts et les types de QR codes",
  mapTitle: "Carte communautaire",
  mapIntro: "Les liens suspects et dangereux signalés par les utilisateurs, regroupés par zone.",
  demoNote: "L'application n'a pas encore d'utilisateurs publics, les chiffres ci-dessous sont donc fictifs.",
  unavailable: "Les données ne sont pas disponibles pour le moment.",
  loading: "Chargement des données…",
  reports: "signalements",
  dangerousLinks: "liens dangereux",
  areas: "zones",
  period: (days) => `Sur les ${days} derniers jours.`,
  perWeek: "Signalements par semaine",
  threatType: "Type de menace",
  threats: { phishing: "Hameçonnage", malware: "Logiciels malveillants", other: "Autres arnaques" },
  privacyTitle: "Confidentialité",
  privacyIntro: "Une carte publique ne doit pas révéler où passent les gens : les signalements sont donc anonymes dès leur conception.",
  privacy: [
    { title: "Aucun lien avec vous.", text: "Un signalement n'est rattaché ni à votre compte ni à votre scan." },
    { title: "Positions approximatives.", text: "Les positions sont arrondies à une maille d'environ 1 km." },
    { title: "Aucun point isolé.", text: "Une zone n'apparaît qu'à partir de deux signalements." },
    { title: "Mots de passe Wi-Fi.", text: "Ils sont retirés avant qu'un scan ne quitte votre téléphone." },
  ],
  techTitle: "Comment c'est construit",
  tech: [
    "Le backend est écrit en Python avec FastAPI, et les données sont stockées dans PostgreSQL avec PostGIS pour la carte. J'ai choisi React Native avec Expo pour l'application, car je développe sous Windows et je peux tout de même compiler pour Android et iOS.",
    "Le projet compte 273 tests backend, 56 tests mobiles et 29 tests de bout en bout. Certains bugs ne sont pourtant apparus que sur un vrai téléphone, et le README les décrit.",
  ],
  techLink: "Lire le README complet",
  footer: "Manuel David, CPE Lyon",
  license: "licence MIT",
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
