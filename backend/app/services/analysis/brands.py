"""Marques souvent imitées dans les arnaques par QR code (surtout en France).

keyword : le mot qu'un faux site met dans son nom de domaine.
strict  : mot trop courant ("free", "orange") ou trop court ("caf") pour chercher
          des fautes de frappe ou une sous-chaîne, on ne compare que des mots entiers.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class Brand:
    name: str
    keyword: str
    official_domains: tuple[str, ...]
    strict: bool = False

    @property
    def main_domain(self) -> str:
        return self.official_domains[0]


def _brand(name: str, keyword: str, *domains: str, strict: bool = False) -> Brand:
    return Brand(name, keyword, domains, strict)


BRANDS: tuple[Brand, ...] = (
    # paiement, banques
    _brand("PayPal", "paypal", "paypal.com", "paypal.fr", "paypal.me"),
    _brand("Crédit Agricole", "creditagricole", "credit-agricole.fr", "credit-agricole.com", "ca-paris.fr"),
    _brand("BNP Paribas", "bnpparibas", "bnpparibas.fr", "bnpparibas.com", "mabanque.bnpparibas"),
    _brand("Société Générale", "societegenerale", "societegenerale.fr", "societegenerale.com", "sg.fr"),
    _brand("La Banque Postale", "labanquepostale", "labanquepostale.fr"),
    # administrations (cibles classiques des SMS et QR frauduleux)
    _brand("Ameli", "ameli", "ameli.fr"),
    _brand("Impots.gouv", "impots", "impots.gouv.fr"),
    _brand("ANTS", "ants", "ants.gouv.fr", strict=True),
    _brand("CAF", "caf", "caf.fr", strict=True),
    # livraison
    _brand("La Poste", "laposte", "laposte.fr", "laposte.net"),
    _brand("Colissimo", "colissimo", "colissimo.fr"),
    _brand("Chronopost", "chronopost", "chronopost.fr"),
    _brand("DHL", "dhl", "dhl.com", "dhl.fr", strict=True),
    _brand("UPS", "ups", "ups.com", strict=True),
    # stationnement : le cas typique du faux QR collé sur un horodateur
    _brand("PayByPhone", "paybyphone", "paybyphone.fr", "paybyphone.com"),
    _brand("Flowbird", "flowbird", "flowbird.com", "flowbird.fr", "flowbird.group"),
    _brand("EasyPark", "easypark", "easypark.fr", "easypark.com", "easypark.net"),
    _brand("Indigo", "indigo", "group-indigo.com", "opngo.com", strict=True),
    # transport, opérateurs
    _brand("SNCF", "sncf", "sncf.com", "sncf.fr", "sncf-connect.com"),
    _brand("Orange", "orange", "orange.fr", "orange.com", strict=True),
    _brand("Free", "free", "free.fr", strict=True),
    _brand("SFR", "sfr", "sfr.fr", strict=True),
    _brand("Bouygues Telecom", "bouygues", "bouyguestelecom.fr", "bouygues.com"),
    # grandes plateformes
    _brand("Amazon", "amazon", "amazon.fr", "amazon.com", "amazon.de", "amazon.co.uk", "amazon.es", "amazon.it", "amazonaws.com", "media-amazon.com"),
    _brand("Google", "google", "google.com", "google.fr", "g.co", "googleusercontent.com", "googleapis.com", "googletagmanager.com"),
    _brand("Apple", "apple", "apple.com", "icloud.com", strict=True),
    _brand("Microsoft", "microsoft", "microsoft.com", "live.com", "office.com", "outlook.com", "microsoftonline.com", "microsoft365.com"),
    _brand("Netflix", "netflix", "netflix.com"),
    _brand("Facebook", "facebook", "facebook.com", "fb.com", "fb.me"),
    _brand("Instagram", "instagram", "instagram.com"),
    _brand("WhatsApp", "whatsapp", "whatsapp.com", "wa.me"),
    _brand("Leboncoin", "leboncoin", "leboncoin.fr"),
    _brand("Vinted", "vinted", "vinted.fr", "vinted.com"),
)

OFFICIAL_DOMAINS: frozenset[str] = frozenset(d for b in BRANDS for d in b.official_domains)

URL_SHORTENERS: frozenset[str] = frozenset({
    "bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "rebrand.ly", "ow.ly",
    "s.id", "shorturl.at", "rb.gy", "t.ly", "tiny.cc", "buff.ly", "qrco.de",
    "qr.codes", "l.ead.me", "short.gy", "v.gd",
})

# Extensions très utilisées pour le phishing et les malwares (statistiques Spamhaus / Interisle)
SUSPICIOUS_TLDS: frozenset[str] = frozenset({
    "zip", "mov", "xyz", "top", "tk", "ml", "ga", "cf", "gq", "icu", "cyou",
    "click", "link", "buzz", "rest", "sbs", "cfd", "lol", "monster", "support",
})

DANGEROUS_EXTENSIONS: frozenset[str] = frozenset({
    "apk", "xapk", "exe", "msi", "scr", "bat", "cmd", "ps1", "vbs", "jar",
    "dmg", "pkg", "iso", "img", "hta", "lnk", "dll", "appx", "msix",
})

DANGEROUS_CONTENT_TYPES: frozenset[str] = frozenset({
    "application/vnd.android.package-archive",
    "application/x-msdownload",
    "application/x-msdos-program",
    "application/x-msi",
    "application/x-apple-diskimage",
    "application/java-archive",
    "application/x-sh",
})
