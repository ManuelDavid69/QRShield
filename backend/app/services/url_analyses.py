import hashlib
import logging
from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING
from urllib.parse import urlsplit

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import UrlAnalysis

if TYPE_CHECKING:
    from app.services.qr_analyzer import UrlAnalyzer

logger = logging.getLogger(__name__)


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


def refresh_analysis(db: Session, analysis: UrlAnalysis, analyzer: "UrlAnalyzer", ttl_hours: int) -> None:
    """Relance l'analyse si elle n'a jamais été faite ou si elle date de plus de ttl_hours.

    Le résultat est partagé : la même URL scannée par 1000 personnes n'est analysée
    qu'une fois par jour, ce qui ménage aussi le quota de VirusTotal (4 requêtes/minute).
    """
    now = datetime.now(UTC)
    if analysis.analyzed_at is not None and now - analysis.analyzed_at < timedelta(hours=ttl_hours):
        return
    try:
        outcome = analyzer.analyze(analysis.url)
    except Exception:
        # Une analyse ratée ne doit jamais empêcher d'enregistrer le scan
        logger.exception("échec de l'analyse de %s", analysis.domain)
        return

    analysis.final_url = outcome.final_url
    analysis.domain = outcome.domain
    analysis.score = outcome.score
    analysis.verdict = outcome.verdict
    analysis.reasons = [signal.to_dict() for signal in outcome.signals]
    analysis.details = outcome.details
    analysis.analyzed_at = now
    db.flush()
