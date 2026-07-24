import { colors } from "@/constants/colors";
import type { Severity, Verdict } from "@/services/api";

export const verdictColors: Record<Verdict, string> = {
  unknown: colors.unknown,
  safe: colors.safe,
  suspicious: colors.suspicious,
  dangerous: colors.dangerous,
};

export const verdictLabels: Record<Verdict, string> = {
  unknown: "Non analysé",
  safe: "Aucun danger détecté",
  suspicious: "Lien suspect",
  dangerous: "Lien dangereux",
};

export const verdictAdvice: Record<Verdict, string> = {
  unknown: "Ce contenu n'a pas pu être analysé.",
  safe: "Aucun indice de danger n'a été trouvé, mais restez attentif à ce que le site vous demande.",
  suspicious:
    "Plusieurs éléments sont inhabituels. N'entrez aucune information personnelle ou bancaire sur ce site.",
  dangerous:
    "Ce lien présente de forts signes d'arnaque. Il est déconseillé de l'ouvrir.",
};

export const severityColors: Record<Severity, string> = {
  info: colors.unknown,
  low: colors.unknown,
  medium: colors.suspicious,
  high: colors.dangerous,
  critical: colors.dangerous,
};

// Le hostname est la seule partie d'une URL qui identifie réellement le site visité
export function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}
