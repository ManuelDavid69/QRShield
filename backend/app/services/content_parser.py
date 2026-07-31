import re
from dataclasses import dataclass
from urllib.parse import urlsplit

from app.models.enums import ContentType, ScanCategory


@dataclass(frozen=True)
class ParsedContent:
    content_type: ContentType
    url: str | None
    sanitized: str


# URL sans schéma (www.exemple.fr/menu) : on n'accepte qu'un vrai nom d'hôte,
# sinon "jean@exemple.fr" ou "mailto:..." passaient pour des URLs
_BARE_URL_RE = re.compile(r"^(?:[a-z0-9-]+\.)+[a-z]{2,}(?::\d{1,5})?(?:[/?#]\S*)?$", re.IGNORECASE)

# Champ P: du format WIFI:, jusqu'au ; non échappé qui termine la valeur.
_WIFI_PASSWORD_RE = re.compile(r"(?<=[:;])(P:)((?:[^;\\]|\\.)*)", re.IGNORECASE)


# Mots entiers uniquement : "pay" ne doit pas capturer "paysage", ni "menu" capturer "menuiserie"
_MENU_WORDS = {"menu", "menus", "carte", "restaurant", "resto", "brasserie", "pizzeria"}
_PAYMENT_WORDS = {"pay", "paiement", "payment", "payer", "checkout", "horodateur", "stationnement", "parking"}
_PAYMENT_SERVICES = ("paypal", "stripe", "sumup", "lydia", "paybyphone", "flowbird", "easypark")


def categorize(parsed: ParsedContent) -> ScanCategory:
    if parsed.content_type is ContentType.WIFI:
        return ScanCategory.WIFI
    if parsed.url is None:
        return ScanCategory.OTHER

    try:
        parts = urlsplit(parsed.url)
        target = f"{parts.hostname or ''} {parts.path}".lower()
    except ValueError:
        return ScanCategory.WEBSITE
    words = set(re.split(r"[^a-z]+", target))
    if words & _PAYMENT_WORDS or any(service in target for service in _PAYMENT_SERVICES):
        return ScanCategory.PAYMENT
    if words & _MENU_WORDS:
        return ScanCategory.MENU
    return ScanCategory.WEBSITE


def _mask_wifi_password(raw: str) -> str:
    # On ne stocke jamais le mot de passe Wi-Fi en clair.
    return _WIFI_PASSWORD_RE.sub(r"\1***", raw)


def parse_qr_content(raw: str) -> ParsedContent:
    text = raw.strip()
    if not text:
        return ParsedContent(ContentType.TEXT, None, text)

    lower = text.lower()

    if lower.startswith(("http://", "https://")):
        return ParsedContent(ContentType.URL, text, text)

    if lower.startswith("wifi:"):
        return ParsedContent(ContentType.WIFI, None, _mask_wifi_password(text))

    if lower.startswith(("mailto:", "matmsg:")):
        return ParsedContent(ContentType.EMAIL, None, text)

    if lower.startswith("tel:"):
        return ParsedContent(ContentType.PHONE, None, text)

    if lower.startswith(("smsto:", "sms:")):
        return ParsedContent(ContentType.SMS, None, text)

    if lower.startswith("geo:"):
        return ParsedContent(ContentType.GEO, None, text)

    if lower.startswith(("begin:vcard", "mecard:")):
        return ParsedContent(ContentType.CONTACT, None, text)

    if _BARE_URL_RE.match(text):
        return ParsedContent(ContentType.URL, f"http://{text}", text)

    return ParsedContent(ContentType.TEXT, None, text)
