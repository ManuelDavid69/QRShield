import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { ThreatType } from "./services/api";

export type Lang = "en" | "fr";

const STORAGE_KEY = "qrshield.lang";

const en = {
  documentTitle: "QRShield · Fake QR codes reported in France",
  source: "Source code on GitHub",
  kicker: "A student security project",
  title: "Someone stuck a fake QR code on a parking meter. Would you have noticed?",
  lead: "I'm Manuel, a fourth-year computer science and networks student at CPE Lyon. We all scan QR codes without thinking, so I built an app that checks where a code really leads before you open it.",
  demoLabel: "Heads-up:",
  demoBefore: " nobody uses the app yet, so the numbers below are made up. The domains end in ",
  demoAfter: " so that no real site gets accused.",
  unavailable: "The data is not available right now.",
  loading: "Loading the data…",
  figuresLabel: "Key figures",
  reports: "reports",
  dangerousLinks: "dangerous links",
  areas: "areas",
  period: (days: number) => `over the last ${days} days`,
  whereTitle: "Where they were reported",
  whatTitle: "What the reports look like",
  perWeek: "Reports per week",
  threatType: "Type of threat",
  cities: "Most affected cities",
  domains: "Most reported domains",
  threats: { phishing: "Phishing", malware: "Malware downloads", other: "Other scams" } as Record<ThreatType, string>,
  scanTitle: "What happens when you scan",
  steps: [
    { title: "Follow the link", text: "The server follows every redirect to the real destination. It only reads headers, it never downloads the page." },
    { title: "Read the address", text: "paypa1.com, amaz0n-livraison.fr, a Cyrillic а in apple.com, the @ trick. A lot of scams are visible in the URL itself." },
    { title: "Ask around", text: "Google Safe Browsing, VirusTotal and the age of the domain. Scam sites are often only a few days old." },
    { title: "Give a verdict", text: "Every clue has a weight and they add up to a score out of 100. You see each reason, and you decide what to do." },
  ],
  privacyTitle: "How reports stay anonymous",
  privacyIntro: "A public map can easily show where people go, so I designed the table to make that impossible rather than promising not to look.",
  privacy: [
    "A report has no account, no email and no link back to the scan.",
    "Locations are snapped to a grid of about one kilometer.",
    "A zone only appears once it has at least two reports.",
    "Only the domain is kept, never the full link, and only the day, never the time.",
  ],
  bugsTitle: "Bugs only a real phone could find",
  bugsIntro: "All the automated tests were green. These three showed up when I tested on my actual phone, and they taught me more than the rest of the project.",
  bugs: [
    { title: "The Wi-Fi password showed up in plain text", text: "On Android, the camera library returns a reformatted version of Wi-Fi QR codes, without the WIFI: prefix. My unit tests used the raw text, so they all passed. I only saw it when I scanned a real code with my phone." },
    { title: "The camera kept running behind the other tabs", text: "I had paused it with a prop that Android silently ignores. The flashlight stayed on when I changed tabs, and that is how I noticed. The camera could still read QR codes in the background, so it now closes for real." },
    { title: "A safe verdict could show up on the wrong link", text: "If a new link arrived while a result was open, the screen kept the previous analysis. A phishing link ended up with a green verdict. It only happened through deep links, but that is exactly what an attacker would use." },
  ],
  footer: "Personal project by Manuel David, CPE Lyon.",
  scanCaption: "What the app shows after a scan",
  scanVerdict: "Suspicious link",
  scanLeadsTo: "This link leads to",
  scanReasons: [
    { level: "high", text: "paypa1-securite.top imitates paypal.com by swapping letters for lookalike characters." },
    { level: "low", text: "The .top extension is widely used by fraudulent sites." },
  ],
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
  mapCredit: "OpenStreetMap contributors",
  areaFallback: "Area",
};

type Messages = typeof en;

const fr: Messages = {
  documentTitle: "QRShield · QR codes piégés signalés en France",
  source: "Code source sur GitHub",
  kicker: "Un projet étudiant en cybersécurité",
  title: "Quelqu'un a collé un faux QR code sur un horodateur. L'auriez-vous remarqué ?",
  lead: "Je suis Manuel, étudiant en 4e année d'informatique et réseaux à CPE Lyon. On scanne tous des QR codes sans réfléchir, alors j'ai créé une application qui vérifie où ils mènent vraiment avant de les ouvrir.",
  demoLabel: "À noter :",
  demoBefore: " personne n'utilise encore l'application, les chiffres ci-dessous sont donc fictifs. Les domaines se terminent par ",
  demoAfter: " pour ne mettre en cause aucun vrai site.",
  unavailable: "Les données ne sont pas disponibles pour le moment.",
  loading: "Chargement des données…",
  figuresLabel: "Chiffres clés",
  reports: "signalements",
  dangerousLinks: "liens dangereux",
  areas: "zones",
  period: (days) => `sur les ${days} derniers jours`,
  whereTitle: "Où ont-ils été signalés ?",
  whatTitle: "Ce que montrent les signalements",
  perWeek: "Signalements par semaine",
  threatType: "Type de menace",
  cities: "Villes les plus touchées",
  domains: "Domaines les plus signalés",
  threats: { phishing: "Hameçonnage", malware: "Logiciels malveillants", other: "Autres arnaques" },
  scanTitle: "Ce qui se passe quand vous scannez",
  steps: [
    { title: "Suivre le lien", text: "Le serveur suit chaque redirection jusqu'à la vraie destination. Il lit seulement les en-têtes et ne télécharge jamais la page." },
    { title: "Lire l'adresse", text: "paypa1.com, amaz0n-livraison.fr, un а cyrillique dans apple.com, l'astuce du @. Beaucoup d'arnaques se voient dans l'URL." },
    { title: "Se renseigner", text: "Google Safe Browsing, VirusTotal et l'âge du domaine. Les sites d'arnaque n'ont souvent que quelques jours." },
    { title: "Donner un verdict", text: "Chaque indice a un poids, et le total donne un score sur 100. Vous voyez chaque raison, et c'est vous qui décidez." },
  ],
  privacyTitle: "Comment les signalements restent anonymes",
  privacyIntro: "Une carte publique peut facilement révéler où passent les gens. J'ai donc conçu la table pour que ce soit impossible, plutôt que de promettre de ne pas regarder.",
  privacy: [
    "Un signalement n'a ni compte, ni e-mail, ni lien vers le scan d'origine.",
    "La position est ramenée à une maille d'environ un kilomètre.",
    "Une zone n'apparaît qu'à partir de deux signalements.",
    "Seul le domaine est conservé, jamais le lien complet, et seul le jour, jamais l'heure.",
  ],
  bugsTitle: "Les bugs que seul un vrai téléphone a révélés",
  bugsIntro: "Tous les tests automatiques étaient au vert. Ces trois problèmes sont apparus en testant sur mon téléphone, et ils m'ont appris plus que le reste du projet.",
  bugs: [
    { title: "Le mot de passe Wi-Fi s'affichait en clair", text: "Sur Android, la bibliothèque de la caméra renvoie une version reformatée des QR codes Wi-Fi, sans le préfixe WIFI:. Mes tests unitaires utilisaient le texte brut et passaient tous. Je ne l'ai vu qu'en scannant un vrai code avec mon téléphone." },
    { title: "La caméra continuait de tourner derrière les autres onglets", text: "Je la mettais en pause avec une propriété qu'Android ignore sans rien dire. La lampe restait allumée en changeant d'onglet, et c'est comme ça que je l'ai remarqué. La caméra pouvait encore lire des QR codes en arrière-plan : elle se ferme maintenant vraiment." },
    { title: "Un verdict sûr pouvait s'afficher sur le mauvais lien", text: "Si un nouveau lien arrivait alors qu'un résultat était ouvert, l'écran gardait l'analyse précédente. Un lien de phishing s'est retrouvé avec un verdict vert. Ça n'arrivait que par lien profond, mais c'est justement ce qu'un attaquant utiliserait." },
  ],
  footer: "Projet personnel de Manuel David, CPE Lyon.",
  scanCaption: "Ce que l'application affiche après un scan",
  scanVerdict: "Lien suspect",
  scanLeadsTo: "Ce lien mène vers",
  scanReasons: [
    { level: "high", text: "Le domaine paypa1-securite.top imite paypal.com en remplaçant des lettres par des caractères qui leur ressemblent." },
    { level: "low", text: "L'extension .top est très utilisée par les sites frauduleux." },
  ],
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
  mapCredit: "contributeurs OpenStreetMap",
  areaFallback: "Zone",
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
