from fastapi import Request

from app.config import get_settings
from app.security.rate_limit import client_ip
"""Tests unitaires du limiteur de débit en mémoire."""

import pytest
from fastapi import HTTPException

from app.security.rate_limit import RateLimiter, enforce


def test_allow_jusqu_a_la_limite_puis_refus_par_cle():
    limiter = RateLimiter(limit=3, window_seconds=60)
    assert limiter.allow("a") is True
    assert limiter.allow("a") is True
    assert limiter.allow("a") is True
    assert limiter.allow("a") is False
    # Une autre clé garde son propre compteur
    assert limiter.allow("b") is True


def test_fenetre_glissante_libere_apres_expiration(monkeypatch):
    clock = [1000.0]
    monkeypatch.setattr("app.security.rate_limit.time.monotonic", lambda: clock[0])

    limiter = RateLimiter(limit=1, window_seconds=60)
    assert limiter.allow("a") is True
    assert limiter.allow("a") is False

    clock[0] += 59  # encore dans la fenêtre
    assert limiter.allow("a") is False

    clock[0] += 2  # 61 s après le premier appel
    assert limiter.allow("a") is True


def test_reset_vide_les_compteurs():
    limiter = RateLimiter(limit=1, window_seconds=60)
    assert limiter.allow("a") is True
    assert limiter.allow("a") is False

    limiter.reset()

    assert limiter.allow("a") is True


def test_enforce_leve_429_avec_retry_after():
    limiter = RateLimiter(limit=1, window_seconds=30)
    enforce(limiter, "1.2.3.4")

    with pytest.raises(HTTPException) as exc:
        enforce(limiter, "1.2.3.4")

    assert exc.value.status_code == 429
    assert exc.value.headers["Retry-After"] == "30"


def _request(forwarded: str | None) -> Request:
    headers = [(b"x-forwarded-for", forwarded.encode())] if forwarded else []
    return Request({"type": "http", "headers": headers, "client": ("10.0.0.9", 1234)})


@pytest.mark.parametrize(
    "hops, forwarded, expected",
    [
        (0, "1.1.1.1", "10.0.0.9"),
        (1, "8.8.8.8", "8.8.8.8"),
        # Le client peut inventer le début de l'en-tête, jamais ce qu'ajoute le proxy
        (1, "1.2.3.4, 8.8.8.8", "8.8.8.8"),
        (2, "1.2.3.4, 8.8.8.8, 9.9.9.9", "8.8.8.8"),
        (1, None, "10.0.0.9"),
    ],
)
def test_client_ip_derriere_un_proxy(monkeypatch, hops, forwarded, expected):
    monkeypatch.setattr(get_settings(), "trusted_proxy_hops", hops)
    assert client_ip(_request(forwarded)) == expected
