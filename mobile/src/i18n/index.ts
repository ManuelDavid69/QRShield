import { MESSAGES, type Messages } from "./messages";

export type Lang = keyof typeof MESSAGES;

function deviceLang(): Lang {
  // Intl évite d'ajouter un module natif juste pour lire la langue du téléphone
  return Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase().startsWith("fr") ? "fr" : "en";
}

let current: Lang = deviceLang();

export function getLang(): Lang {
  return current;
}

export function setCurrentLang(lang: Lang): void {
  current = lang;
}

export function locale(): string {
  return current === "fr" ? "fr-FR" : "en-GB";
}

// Proxy : les libellés déclarés hors des composants suivent aussi la langue choisie
export const t = new Proxy({} as Messages, {
  get: (_target, key) => MESSAGES[current][key as keyof Messages],
});
