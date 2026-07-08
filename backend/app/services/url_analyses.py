import hashlib
from urllib.parse import urlsplit

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import UrlAnalysis


def _hash_url(url: str) -> str:
    return hashlib.sha256(url.encode("utf-8")).hexdigest()


def _extract_domain(url: str) -> str | None:
    try:
        hostname = urlsplit(url).hostname
    except ValueError:
        # URL IPv6 mal formée : on préfère stocker l'analyse sans domaine
        return None
    return hostname.lower() if hostname else None


def get_or_create_analysis(db: Session, url: str) -> UrlAnalysis:
    url_hash = _hash_url(url)
    existing = db.scalar(select(UrlAnalysis).where(UrlAnalysis.url_hash == url_hash))
    if existing is not None:
        return existing

    try:
        # Savepoint : permet d'absorber la course entre deux requêtes sans casser la transaction
        with db.begin_nested():
            analysis = UrlAnalysis(url=url, url_hash=url_hash, domain=_extract_domain(url))
            db.add(analysis)
        return analysis
    except IntegrityError:
        # Une requête concurrente a inséré la même URL entre notre SELECT et notre INSERT
        return db.scalars(select(UrlAnalysis).where(UrlAnalysis.url_hash == url_hash)).one()
