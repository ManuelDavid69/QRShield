import { isOpenableUrl, parseQrContent } from "../qrContent";

describe("parseQrContent", () => {
  it("détecte un lien web", () => {
    const result = parseQrContent("https://exemple.fr/menu");
    expect(result.type).toBe("url");
    expect(result.url).toBe("https://exemple.fr/menu");
    expect(result.host).toBe("exemple.fr");
  });

  it("détecte un réseau Wi-Fi", () => {
    expect(parseQrContent("WIFI:T:WPA;S:MaBox;P:secret;;").type).toBe("wifi");
  });

  it("détecte un e-mail", () => {
    expect(parseQrContent("mailto:jean@exemple.fr").type).toBe("email");
    expect(parseQrContent("MATMSG:TO:jean@exemple.fr;;").type).toBe("email");
  });

  it("détecte un numéro de téléphone", () => {
    expect(parseQrContent("tel:+33123456789").type).toBe("phone");
  });

  it("détecte un SMS", () => {
    expect(parseQrContent("smsto:+33123456789:Bonjour").type).toBe("sms");
    expect(parseQrContent("sms:+33123456789").type).toBe("sms");
  });

  it("détecte une position GPS", () => {
    expect(parseQrContent("geo:48.8566,2.3522").type).toBe("geo");
  });

  it("détecte une carte de contact", () => {
    expect(parseQrContent("BEGIN:VCARD\nVERSION:3.0\nEND:VCARD").type).toBe("contact");
    expect(parseQrContent("MECARD:N:Dupont;TEL:0123456789;;").type).toBe("contact");
  });

  it("détecte du texte libre", () => {
    expect(parseQrContent("Table 12").type).toBe("text");
  });

  it("gère un schéma en majuscules", () => {
    const result = parseQrContent("HTTPS://Exemple.fr/Menu");
    expect(result.type).toBe("url");
    expect(result.host).toBe("exemple.fr");
  });

  it("préfixe une URL sans schéma", () => {
    const result = parseQrContent("www.google.com");
    expect(result.type).toBe("url");
    expect(result.url).toBe("http://www.google.com");
    expect(result.host).toBe("www.google.com");
  });

  it("ne prend pas une adresse e-mail pour une URL", () => {
    expect(parseQrContent("jean@exemple.fr").type).toBe("text");
  });

  it("ne prend pas un texte avec espaces pour une URL", () => {
    expect(parseQrContent("www google com").type).toBe("text");
  });

  it("analyse un Wi-Fi avec caractères échappés sans exposer le mot de passe", () => {
    const result = parseQrContent("WIFI:T:WPA;S:Ma\\;Box;P:secret;H:true;;");
    expect(result.type).toBe("wifi");
    expect(result.wifi?.ssid).toBe("Ma;Box");
    expect(result.wifi?.security).toBe("WPA");
    expect(result.wifi?.hidden).toBe(true);
    expect(result.wifi?.hasPassword).toBe(true);
    expect(JSON.stringify(result.wifi)).not.toContain("secret");
  });

  it("analyse un Wi-Fi sans mot de passe", () => {
    const result = parseQrContent("WIFI:T:nopass;S:Gare;;");
    expect(result.wifi?.security).toBe("Aucune");
    expect(result.wifi?.hasPassword).toBe(false);
  });
});

describe("isOpenableUrl", () => {
  it("autorise le web", () => {
    expect(isOpenableUrl("https://exemple.fr")).toBe(true);
    expect(isOpenableUrl("http://exemple.fr/menu")).toBe(true);
  });

  it("refuse les autres schémas", () => {
    expect(isOpenableUrl("javascript:alert(1)")).toBe(false);
    expect(isOpenableUrl("intent://x")).toBe(false);
  });
});

describe("hôte affiché", () => {
  it("montre le vrai domaine quand l'URL cache un faux domaine avant le @", () => {
    const result = parseQrContent("https://www.paypal.com@evil.com/login");
    expect(result.host).toBe("evil.com");
  });

  it("affiche les domaines internationaux en punycode pour repérer les homographes", () => {
    // "аpple.com" avec un a cyrillique
    const result = parseQrContent("https://аpple.com");
    expect(result.host).toBe("xn--pple-43d.com");
  });
});
