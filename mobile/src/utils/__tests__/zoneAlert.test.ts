import { ALERT_COOLDOWN_MS, distanceKm, reportsNearby, shouldAlert } from "../zoneAlert";

const LYON = { latitude: 45.76, longitude: 4.84 };
const PARIS = { latitude: 48.86, longitude: 2.35 };

describe("distanceKm", () => {
  it("donne environ 392 km entre Lyon et Paris", () => {
    expect(distanceKm(LYON, PARIS)).toBeCloseTo(392, -1);
  });

  it("vaut zéro pour un même point", () => {
    expect(distanceKm(LYON, LYON)).toBe(0);
  });
});

describe("reportsNearby", () => {
  it("additionne seulement les zones à moins de 5 km", () => {
    const zones = [
      { ...LYON, reports: 3, dangerous: 1 },
      { latitude: 45.78, longitude: 4.85, reports: 4, dangerous: 0 },
      { ...PARIS, reports: 50, dangerous: 50 },
    ];
    expect(reportsNearby(LYON, zones)).toBe(7);
  });
});

describe("shouldAlert", () => {
  const now = 1_000_000_000_000;

  it("attend un minimum de signalements", () => {
    expect(shouldAlert(4, null, now)).toBe(false);
    expect(shouldAlert(5, null, now)).toBe(true);
  });

  it("ne répète pas l'alerte avant une semaine", () => {
    expect(shouldAlert(20, now - 1000, now)).toBe(false);
    expect(shouldAlert(20, now - ALERT_COOLDOWN_MS, now)).toBe(true);
  });
});
