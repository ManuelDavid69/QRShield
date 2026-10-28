"""Tests des indices déduits de l'URL elle-même, sans aucun appel réseau."""

import pytest

from app.services.analysis.heuristics import file_extension, split_domain, url_signals
from app.services.analysis.signals import Severity


def codes(url: str) -> set[str]:
    return {signal.code for signal in url_signals(url)}


@pytest.mark.parametrize(
    "url",
    [
        "https://www.paypal.com/fr/signin",
        "https://www.amazon.fr/dp/123",
        "https://s3.amazonaws.com/bucket/menu.pdf",
        "https://www.ameli.fr",
        "https://amelie-coiffure.fr",
        "https://pineapple.com",
        "https://www.freecodecamp.org",
        "https://lh3.googleusercontent.com/x.png",
        "https://monrestaurant.fr/menu",
        "https://impots.gouv.fr",
        "https://www.sncf-connect.com",
        "https://www.paybyphone.fr",
    ],
)
def test_aucun_signal_sur_les_sites_legitimes(url: str) -> None:
    assert codes(url) == set()


@pytest.mark.parametrize(
    ("url", "expected"),
    [
        ("https://paypa1.com/login", "brand_lookalike"),
        ("https://amaz0n.fr", "brand_lookalike"),
        ("https://paypa1-securite.top/login", "brand_lookalike"),
        ("https://paypal-securite-compte.com", "brand_impersonation"),
        ("https://impots-gouv-remboursement.fr", "brand_impersonation"),
        ("https://paybyphone-amende.top/pay", "brand_impersonation"),
        ("https://paypal.com.verification-client.ru/login", "brand_in_subdomain"),
        ("https://netfIix.com", "brand_typo"),
        ("https://xn--pple-43d.com", "brand_homograph"),
        ("https://xn--pple-43d.com", "punycode"),
        ("https://www.paypal.com@evil-site.com/login", "userinfo_trick"),
        ("http://45.13.22.8/update.apk", "ip_address"),
        ("http://45.13.22.8/update.apk", "dangerous_download"),
        ("https://exemple.fr/files/Facture%20.exe", "dangerous_download"),
        ("http://exemple.fr", "no_https"),
        ("https://promo.xyz", "suspicious_tld"),
        ("https://a.b.c.d.example.com/x", "many_subdomains"),
    ],
)
def test_signal_attendu(url: str, expected: str) -> None:
    assert expected in codes(url)


def test_mot_courant_reste_prudent() -> None:
    # « orange » est une marque mais aussi un mot courant : on ne crie pas au loup
    impersonations = [s for s in url_signals("https://orange-bleue.fr") if s.code == "brand_impersonation"]
    assert impersonations
    assert impersonations[0].severity is Severity.MEDIUM


def test_message_userinfo_cite_le_vrai_hote() -> None:
    signals = url_signals("https://www.paypal.com@evil-site.com/login")
    userinfo = next(s for s in signals if s.code == "userinfo_trick")
    assert "evil-site.com" in userinfo.message


def test_punycode_legitime_sans_homograph() -> None:
    found = codes("https://xn--mnchen-3ya.de")
    assert "punycode" in found
    assert "brand_homograph" not in found


@pytest.mark.parametrize(
    ("host", "expected"),
    [
        ("paypal.com.secure-login.ru", "secure-login.ru"),
        ("impots.gouv.fr", "impots.gouv.fr"),
    ],
)
def test_split_domain(host: str, expected: str) -> None:
    assert split_domain(host).registered == expected


@pytest.mark.parametrize(
    ("path", "expected"),
    [
        ("/dl/App%20Update.APK", "apk"),
        ("/menu", ""),
    ],
)
def test_file_extension(path: str, expected: str) -> None:
    assert file_extension(path) == expected
