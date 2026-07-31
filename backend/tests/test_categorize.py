import pytest

from app.models.enums import ScanCategory
from app.services.content_parser import categorize, parse_qr_content


@pytest.mark.parametrize(
    "raw, expected",
    [
        # Paiement : domaine ou chemin explicite
        ("https://paybyphone.fr/zone/123", ScanCategory.PAYMENT),
        ("https://horodateur-lyon.fr/payer", ScanCategory.PAYMENT),
        ("https://exemple.fr/checkout", ScanCategory.PAYMENT),
        ("https://paypal.me/jean", ScanCategory.PAYMENT),
        # Menu : mot-clé "menu"/"carte" ou type de commerce
        ("https://chez-paul.fr/menu", ScanCategory.MENU),
        ("https://lacarte.fr/carte/midi", ScanCategory.MENU),
        ("https://pizzeria-roma.fr", ScanCategory.MENU),
        # Site web : valeur par défaut, sans faux positif sur "pay"/"menu"
        ("https://www.wikipedia.org", ScanCategory.WEBSITE),
        ("https://paysage-lyon.fr", ScanCategory.WEBSITE),
        ("https://menuiserie-dupont.fr", ScanCategory.WEBSITE),
        # WiFi et contenus qui ne sont pas des URL
        ("WIFI:T:WPA;S:Box;P:x;;", ScanCategory.WIFI),
        ("tel:+33600000000", ScanCategory.OTHER),
        ("bonjour", ScanCategory.OTHER),
    ],
)
def test_categorize(raw: str, expected: ScanCategory) -> None:
    assert categorize(parse_qr_content(raw)) == expected
