import { colors } from "@/constants/colors";

import { buildMapHtml, zoneColor, zoneRadius } from "../mapHtml";

describe("zoneRadius", () => {
  it("grandit avec le nombre de signalements, dans une limite", () => {
    expect(zoneRadius(4)).toBe(10);
    expect(zoneRadius(100000)).toBe(22);
  });
});

describe("zoneColor", () => {
  it("est rouge quand la majorité des liens sont dangereux", () => {
    expect(zoneColor({ reports: 4, dangerous: 2 })).toBe(colors.dangerous);
    expect(zoneColor({ reports: 4, dangerous: 1 })).toBe(colors.suspicious);
  });
});

describe("buildMapHtml", () => {
  it("place les zones sur la carte", () => {
    const html = buildMapHtml([{ latitude: 45.76, longitude: 4.84, reports: 3, dangerous: 2 }]);
    expect(html).toContain('"lat":45.76');
    expect(html).toContain("3 signalements, dont 2 dangereux");
  });

  it("n'injecte jamais du contenu venant de l'API dans la page", () => {
    const zone = { latitude: "</script><script>alert(1)</script>", longitude: 2, reports: 2, dangerous: 1 };
    const html = buildMapHtml([zone as unknown as Parameters<typeof buildMapHtml>[0][number]]);
    expect(html).not.toContain("alert(1)");
  });
});
