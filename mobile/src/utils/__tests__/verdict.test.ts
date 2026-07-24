import type { Verdict } from "@/services/api";

import { hostOf, verdictAdvice, verdictColors, verdictLabels } from "../verdict";

const verdicts: Verdict[] = ["unknown", "safe", "suspicious", "dangerous"];

describe("hostOf", () => {
  it("extrait le hostname en minuscules", () => {
    expect(hostOf("https://Exemple.fr/a")).toBe("exemple.fr");
  });

  it("renvoie null quand la chaîne n'est pas une URL", () => {
    expect(hostOf("pas une url")).toBeNull();
  });
});

describe("verdicts", () => {
  it.each(verdicts)("le verdict %s possède un libellé et un conseil", (verdict) => {
    expect(verdictLabels[verdict].length).toBeGreaterThan(0);
    expect(verdictAdvice[verdict].length).toBeGreaterThan(0);
  });

  it("dangereux et sûr ont des couleurs distinctes", () => {
    expect(verdictColors.dangerous).not.toBe(verdictColors.safe);
  });
});
