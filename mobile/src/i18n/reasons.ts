import { getLang, t } from "@/i18n";
import type { AppNotification, Reason } from "@/services/api";

type Params = Record<string, string>;

const THREATS: Record<string, string> = {
  MALWARE: "malware",
  SOCIAL_ENGINEERING: "phishing",
  UNWANTED_SOFTWARE: "unwanted software",
  POTENTIALLY_HARMFUL_APPLICATION: "harmful application",
};

const ENGLISH: Record<string, (p: Params) => string | null> = {
  brand_impersonation: (p) =>
    p.domain ? `The domain ${p.domain} uses the name "${p.brand}" but does not belong to ${p.brand} (official site: ${p.official}).` : null,
  brand_homograph: (p) =>
    p.shown ? `The domain displays as "${p.shown}" but some letters come from another alphabet: it imitates ${p.official}.` : null,
  brand_lookalike: (p) =>
    p.domain ? `The domain ${p.domain} imitates ${p.official} by replacing letters with similar-looking characters.` : null,
  brand_typo: (p) => (p.domain ? `The domain ${p.domain} is very close to ${p.official}, within one or two letters.` : null),
  brand_in_subdomain: (p) =>
    p.domain ? `The address starts with "${p.brand}", but the site that opens is actually ${p.domain}.` : null,
  invalid_url: () => "The address is malformed.",
  userinfo_trick: (p) =>
    p.host ? `The address contains an "@": everything before it is ignored, and the link really leads to ${p.host}.` : null,
  ip_address: () => "The link uses an IP address instead of a domain name, which legitimate sites almost never do.",
  punycode: (p) =>
    p.shown ? `The domain name contains non-Latin characters (${p.shown}), a technique used to visually imitate another site.` : null,
  suspicious_tld: (p) => (p.tld ? `The .${p.tld} extension is widely used by fraudulent sites.` : null),
  many_subdomains: () => "The address has an unusual number of subdomains, often to hide the real site.",
  no_https: () => "The connection to the site is not encrypted (HTTP).",
  dangerous_download: (p) =>
    p.ext
      ? `The link directly downloads a .${p.ext} file. An app or program installed from a QR code can take control of the phone.`
      : "The site directly returns a file to install. An app installed from a QR code can take control of the phone.",
  url_shortener: (p) => (p.domain ? `The link goes through a URL shortener (${p.domain}) that hides its real destination.` : null),
  domain_change: (p) => (p.from ? `The link redirects from ${p.from} to another site: ${p.to}.` : null),
  many_redirects: (p) => (p.count ? `The link goes through ${p.count} redirects before reaching its destination.` : null),
  non_http_redirect: (p) =>
    p.target ? `The site redirects to a "${p.target}:" address that can open an app or trigger an action on the phone.` : null,
  private_address: () => "The link points to a local or reserved network address, which makes no sense for a QR code shown in public.",
  redirect_abuse: () => "The link keeps redirecting endlessly, a technique used to escape analysis.",
  tls_error: () => "The site's security certificate is invalid: the connection cannot be trusted.",
  unreachable: () => "The site could not be reached, so the analysis is partial.",
  safe_browsing: (p) => {
    if (!p.threats) return null;
    const labels = p.threats.split(",").map((threat) => THREATS[threat] ?? threat);
    return `This link is listed as dangerous by Google Safe Browsing (${labels.join(", ")}).`;
  },
  virustotal: (p) => {
    if (!p.malicious) return null;
    const suspicious = p.suspicious !== "0" ? ` and ${p.suspicious} as suspicious.` : ".";
    return `${p.malicious} antivirus engines on VirusTotal flag this link as malicious${suspicious}`;
  },
  new_domain: (p) =>
    p.domain ? `The site ${p.domain} was created only ${p.age} day(s) ago. Scam sites are often brand new, as they get shut down quickly.` : null,
  recent_domain: (p) => (p.domain ? `The site ${p.domain} is less than three months old (${p.age} days).` : null),
  community_reports: (p) => (p.count ? `${p.count} QRShield users reported this site.` : null),
  community_domain: (p) => (p.domain ? `Other links on ${p.domain} have already been classified as dangerous.` : null),
};

// Les analyses enregistrées avant la traduction n'ont pas de valeurs : on garde le message français
export function reasonText(reason: Reason): string {
  if (getLang() === "fr") return reason.message;
  return ENGLISH[reason.code]?.(reason.params ?? {}) ?? reason.message;
}

// Le serveur ne stocke pas la langue de la personne : l'alerte se traduit à l'affichage
export function alertText(alert: AppNotification): { title: string; body: string } {
  const domain = /\(([^)]+)\)/.exec(alert.body)?.[1];
  if (getLang() === "fr" || domain === undefined) return { title: alert.title, body: alert.body };
  return { title: t.alerts.reclassifiedTitle, body: t.alerts.reclassifiedBody(domain) };
}

const SERVER_ERRORS: Record<string, string> = {
  "Un compte existe déjà avec cet email": "An account already exists with this email",
  "Email ou mot de passe incorrect": "Incorrect email or password",
  "Mot de passe incorrect": "Incorrect password",
  "E-mail ou code de secours incorrect": "Incorrect email or recovery code",
  "Trop de requêtes, réessayez dans un instant.": "Too many requests, try again in a moment.",
  "Session expirée": "Session expired",
  "Scan introuvable": "Scan not found",
};

export function serverErrorText(detail: string): string {
  return getLang() === "fr" ? detail : (SERVER_ERRORS[detail] ?? detail);
}
