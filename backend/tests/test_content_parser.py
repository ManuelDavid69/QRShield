import pytest

from app.models.enums import ContentType
from app.services.content_parser import parse_qr_content


@pytest.mark.parametrize(
    "raw,expected_type",
    [
        ("https://example.com", ContentType.URL),
        ("HTTPS://example.com", ContentType.URL),
        ("http://example.com/path?q=1", ContentType.URL),
        ("www.google.com", ContentType.URL),
        ("exemple.com/chemin", ContentType.URL),
        ("WIFI:T:WPA;S:MaBox;P:secret123;;", ContentType.WIFI),
        ("wifi:t:wpa;s:mabox;p:secret123;;", ContentType.WIFI),
        ("mailto:foo@example.com", ContentType.EMAIL),
        ("MATMSG:TO:foo@example.com;;", ContentType.EMAIL),
        ("tel:+33123456789", ContentType.PHONE),
        ("smsto:+33123456789:Bonjour", ContentType.SMS),
        ("sms:+33123456789", ContentType.SMS),
        ("geo:48.85,2.35", ContentType.GEO),
        ("BEGIN:VCARD\nFN:John\nEND:VCARD", ContentType.CONTACT),
        ("MECARD:N:John;;", ContentType.CONTACT),
        ("bonjour tout le monde", ContentType.TEXT),
    ],
)
def test_parse_content_type(raw, expected_type):
    assert parse_qr_content(raw).content_type is expected_type


def test_bare_url_gets_http_scheme():
    parsed = parse_qr_content("www.google.com")
    assert parsed.content_type is ContentType.URL
    assert parsed.url == "http://www.google.com"


def test_text_with_spaces_is_not_url():
    parsed = parse_qr_content("bonjour tout le monde")
    assert parsed.content_type is ContentType.TEXT
    assert parsed.url is None


def test_wifi_password_is_masked():
    parsed = parse_qr_content("WIFI:T:WPA;S:MaBox;P:secret123;;")
    assert parsed.content_type is ContentType.WIFI
    assert "secret123" not in parsed.sanitized
    assert "P:***" in parsed.sanitized


def test_wifi_escaped_semicolon_password_is_masked():
    parsed = parse_qr_content(r"WIFI:T:WPA;S:MaBox;P:secr\;et;;")
    assert parsed.content_type is ContentType.WIFI
    assert r"secr\;et" not in parsed.sanitized
    assert "P:***" in parsed.sanitized


@pytest.mark.parametrize(
    "raw, expected",
    [
        ("mailto:jean@exemple.fr", ContentType.EMAIL),
        ("jean@exemple.fr", ContentType.TEXT),
        ("exemple.fr:8080/admin", ContentType.URL),
        ("fichier.txt est prêt", ContentType.TEXT),
    ],
)
def test_bare_url_ne_capture_pas_les_autres_formats(raw, expected):
    assert parse_qr_content(raw).content_type == expected
