import uuid
from datetime import UTC, datetime, timedelta

import jwt

from app.config import get_settings


class InvalidTokenError(Exception):
    pass


def create_access_token(user_id: uuid.UUID) -> str:
    settings = get_settings()
    now = datetime.now(UTC)
    payload = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_expire_minutes),
        "type": "access",
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> uuid.UUID:
    settings = get_settings()
    try:
        # algorithms est une liste fixe : on n'accepte jamais l'algo annoncé dans le header (attaque alg=none)
        payload = jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
            options={"require": ["sub", "exp", "iat"]},
        )
        if payload.get("type") != "access":
            raise InvalidTokenError()
        return uuid.UUID(payload["sub"])
    except (jwt.PyJWTError, ValueError) as e:
        raise InvalidTokenError() from e
