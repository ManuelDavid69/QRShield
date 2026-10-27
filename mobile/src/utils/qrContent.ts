export type QrContentType = "url" | "wifi" | "email" | "phone" | "sms" | "geo" | "contact" | "text";

export interface WifiInfo {
  ssid: string;
  security: string;
  hidden: boolean;
  hasPassword: boolean;
}

export interface ParsedQr {
  type: QrContentType;
  raw: string;
  url?: string;
  host?: string;
  wifi?: WifiInfo;
}

// Doit rester aligné avec la regex du backend : un vrai nom d'hôte uniquement.
const BARE_URL_RE = /^(?:[a-z0-9-]+\.)+[a-z]{2,}(?::\d{1,5})?(?:[/?#]\S*)?$/i;

const WIFI_NO_PASSWORD = "Aucune";

function splitFields(payload: string): string[] {
  const fields: string[] = [];
  let current = "";

  for (let index = 0; index < payload.length; index += 1) {
    const char = payload[index];
    if (char === "\\" && index + 1 < payload.length) {
      // On conserve la séquence pour ne pas couper sur un ";" échappé.
      current += char + payload[index + 1];
      index += 1;
    } else if (char === ";") {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  fields.push(current);
  return fields;
}

function unescapeValue(value: string): string {
  let result = "";

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (char === "\\" && index + 1 < value.length) {
      result += value[index + 1];
      index += 1;
    } else {
      result += char;
    }
  }

  return result;
}

function parseWifi(raw: string): WifiInfo {
  const payload = raw.slice(raw.indexOf(":") + 1);
  let ssid = "";
  let security = "";
  let hidden = false;
  let hasPassword = false;

  for (const field of splitFields(payload)) {
    const separator = field.indexOf(":");
    if (separator <= 0) continue;

    const key = field.slice(0, separator).trim().toUpperCase();
    const value = unescapeValue(field.slice(separator + 1));

    switch (key) {
      case "S":
        ssid = value;
        break;
      case "T":
        security = value.trim();
        break;
      case "H":
        hidden = value.trim().toLowerCase() === "true";
        break;
      case "P":
        // Le mot de passe n'est jamais conservé, seule sa présence nous intéresse.
        hasPassword = value.length > 0;
        break;
      default:
        break;
    }
  }

  const normalizedSecurity =
    security.length === 0 || security.toLowerCase() === "nopass" ? WIFI_NO_PASSWORD : security;

  return { ssid, security: normalizedSecurity, hidden, hasPassword };
}

function buildUrl(url: string, raw: string): ParsedQr {
  try {
    return { type: "url", raw, url, host: new URL(url).hostname.toLowerCase() };
  } catch {
    return { type: "text", raw };
  }
}

export function parseQrContent(raw: string): ParsedQr {
  const text = raw.trim();
  if (text.length === 0) {
    return { type: "text", raw: text };
  }

  const lower = text.toLowerCase();

  if (lower.startsWith("http://") || lower.startsWith("https://")) {
    return buildUrl(text, text);
  }

  if (lower.startsWith("wifi:")) {
    return { type: "wifi", raw: text, wifi: parseWifi(text) };
  }

  if (lower.startsWith("mailto:") || lower.startsWith("matmsg:")) {
    return { type: "email", raw: text };
  }

  if (lower.startsWith("tel:")) {
    return { type: "phone", raw: text };
  }

  if (lower.startsWith("smsto:") || lower.startsWith("sms:")) {
    return { type: "sms", raw: text };
  }

  if (lower.startsWith("geo:")) {
    return { type: "geo", raw: text };
  }

  if (lower.startsWith("begin:vcard") || lower.startsWith("mecard:")) {
    return { type: "contact", raw: text };
  }

  if (BARE_URL_RE.test(text)) {
    return buildUrl(`http://${text}`, text);
  }

  return { type: "text", raw: text };
}

export const typeLabels: Record<QrContentType, string> = {
  url: "Lien web",
  wifi: "Réseau Wi-Fi",
  email: "E-mail",
  phone: "Numéro de téléphone",
  sms: "SMS",
  geo: "Position GPS",
  contact: "Carte de contact",
  text: "Texte",
};

export function isOpenableUrl(url: string): boolean {
  try {
    const { protocol } = new URL(url);
    // On n'ouvre jamais javascript:, intent:, file:... : uniquement le web.
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}
