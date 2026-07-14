import { parseQrContent } from "../qrContent";
import { getQrPayload } from "../scanResult";

describe("getQrPayload", () => {
  // Cas réel vu sur Android : ML Kit renvoie "ssid\nmot de passe" dans data
  const androidWifi = {
    data: "MaBox_Test\nMonMotDePasseSecret123",
    raw: "WIFI:T:WPA;S:MaBox_Test;P:MonMotDePasseSecret123;;",
  };

  it("préfère le contenu brut quand il existe (Android)", () => {
    expect(getQrPayload(androidWifi)).toBe(androidWifi.raw);
  });

  it("utilise data quand raw est absent (iOS)", () => {
    expect(getQrPayload({ data: "https://exemple.fr" })).toBe("https://exemple.fr");
  });

  it("le Wi-Fi scanné sur Android est bien reconnu et le mot de passe n'est pas exposé", () => {
    const parsed = parseQrContent(getQrPayload(androidWifi));
    expect(parsed.type).toBe("wifi");
    expect(parsed.wifi?.ssid).toBe("MaBox_Test");
    expect(JSON.stringify(parsed.wifi)).not.toContain("MonMotDePasseSecret123");
  });
});
