import uuid
from datetime import UTC, datetime, timedelta

import jwt
import pytest

from app.config import get_settings
from app.security.passwords import hash_password, needs_rehash, verify_password
from app.security.tokens import InvalidTokenError, create_access_token, decode_access_token


def test_hash_then_verify_ok():
    h = hash_password("motdepasse-solide")
    assert verify_password("motdepasse-solide", h) is True


def test_verify_wrong_password_is_false():
    h = hash_password("motdepasse-solide")
    assert verify_password("mauvais-mot-de-passe", h) is False


def test_verify_without_hash_is_false():
    assert verify_password("x", None) is False


def test_hash_is_salted():
    # Deux hashes du même mot de passe doivent différer (sel aléatoire)
    assert hash_password("meme-mot-de-passe") != hash_password("meme-mot-de-passe")


def test_fresh_hash_does_not_need_rehash():
    assert needs_rehash(hash_password("motdepasse-solide")) is False


def _payload(**overrides) -> dict:
    now = datetime.now(UTC)
    base = {
        "sub": str(uuid.uuid4()),
        "iat": now,
        "exp": now + timedelta(minutes=5),
        "type": "access",
    }
    base.update(overrides)
    return base


def test_token_roundtrip_returns_same_user_id():
    user_id = uuid.uuid4()
    assert decode_access_token(create_access_token(user_id)) == user_id


def test_expired_token_rejected():
    settings = get_settings()
    now = datetime.now(UTC)
    token = jwt.encode(
        _payload(iat=now - timedelta(minutes=10), exp=now - timedelta(minutes=1)),
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )
    with pytest.raises(InvalidTokenError):
        decode_access_token(token)


def test_token_signed_with_another_key_rejected():
    settings = get_settings()
    token = jwt.encode(
        _payload(),
        "une-autre-cle-totalement-differente-0123456789",
        algorithm=settings.jwt_algorithm,
    )
    with pytest.raises(InvalidTokenError):
        decode_access_token(token)


def test_alg_none_token_rejected():
    token = jwt.encode(_payload(), None, algorithm="none")
    with pytest.raises(InvalidTokenError):
        decode_access_token(token)


def test_refresh_type_rejected():
    settings = get_settings()
    token = jwt.encode(
        _payload(type="refresh"), settings.jwt_secret_key, algorithm=settings.jwt_algorithm
    )
    with pytest.raises(InvalidTokenError):
        decode_access_token(token)


def test_non_uuid_subject_rejected():
    settings = get_settings()
    token = jwt.encode(
        _payload(sub="pas-un-uuid"), settings.jwt_secret_key, algorithm=settings.jwt_algorithm
    )
    with pytest.raises(InvalidTokenError):
        decode_access_token(token)
