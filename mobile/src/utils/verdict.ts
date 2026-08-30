import { colors } from "@/constants/colors";
import type { Severity, Verdict } from "@/services/api";
import { t } from "@/i18n";

export const verdictColors: Record<Verdict, string> = {
  unknown: colors.unknown,
  safe: colors.safe,
  suspicious: colors.suspicious,
  dangerous: colors.dangerous,
};

export const verdictLabels = new Proxy({} as Record<Verdict, string>, {
  get: (_target, verdict) => t.verdicts[verdict as Verdict],
});

export const verdictAdvice = new Proxy({} as Record<Verdict, string>, {
  get: (_target, verdict) => t.advice[verdict as Verdict],
});

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
