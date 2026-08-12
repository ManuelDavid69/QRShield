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
