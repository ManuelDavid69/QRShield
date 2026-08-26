"""Sessions longues : jetons opaques à usage unique, renouvelés à chaque utilisation.

Si un jeton déjà utilisé est présenté, soit il a été volé, soit c'est le voleur qui s'est
servi du dernier : impossible de savoir lequel est légitime. Toute la session est donc coupée.
"""

import hashlib
import secrets
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, select, update
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import RefreshToken


class InvalidRefreshToken(Exception):
    pass


def _hash(raw_token: str) -> str:
    # Pas besoin d'Argon2 ici : le jeton fait 256 bits aléatoires, il ne se devine pas
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def issue_refresh_token(db: Session, user_id: uuid.UUID, family_id: uuid.UUID | None = None) -> str:
    raw_token = secrets.token_urlsafe(32)
    lifetime = timedelta(days=get_settings().refresh_token_expire_days)
    db.add(RefreshToken(
        user_id=user_id,
        family_id=family_id or uuid.uuid4(),
        token_hash=_hash(raw_token),
        expires_at=datetime.now(UTC) + lifetime,
    ))
    db.flush()
    return raw_token


def _revoke_family(db: Session, family_id: uuid.UUID) -> None:
    db.execute(
        update(RefreshToken)
        .where(RefreshToken.family_id == family_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=datetime.now(UTC))
    )


def rotate_refresh_token(db: Session, raw_token: str) -> tuple[uuid.UUID, str]:
    """Consomme le jeton et en renvoie un nouveau, avec l'utilisateur concerné."""
    # Verrou de ligne : deux requêtes simultanées ne peuvent pas consommer le même jeton
    token = db.scalar(
        select(RefreshToken).where(RefreshToken.token_hash == _hash(raw_token)).with_for_update()
    )
    if token is None:
        raise InvalidRefreshToken

    now = datetime.now(UTC)
    if token.revoked_at is not None:
        _revoke_family(db, token.family_id)
        # Validé tout de suite : l'exception ne doit pas annuler la révocation
        db.commit()
        raise InvalidRefreshToken
    if token.expires_at <= now:
        raise InvalidRefreshToken

    token.revoked_at = now
    return token.user_id, issue_refresh_token(db, token.user_id, token.family_id)


def revoke_refresh_token(db: Session, raw_token: str) -> None:
    token = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == _hash(raw_token)))
    if token is not None:
        _revoke_family(db, token.family_id)
        db.commit()


def purge_expired_tokens(db: Session) -> int:
    result = db.execute(delete(RefreshToken).where(RefreshToken.expires_at <= datetime.now(UTC)))
    db.commit()
    return result.rowcount
