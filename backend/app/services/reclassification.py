"""Réanalyse les liens déjà scannés : un site peut devenir dangereux après le scan."""

from collections.abc import Callable
from datetime import UTC, datetime, timedelta

from sqlalchemy import exists, or_, select
from sqlalchemy.orm import Session

from app.models import Scan, UrlAnalysis
from app.services.community import community_signals
from app.services.qr_analyzer import UrlAnalyzer
from app.services.url_analyses import refresh_analysis


def stale_analyses(db: Session, ttl_hours: int, limit: int) -> list[UrlAnalysis]:
    limit_date = datetime.now(UTC) - timedelta(hours=ttl_hours)
    return list(
        db.scalars(
            select(UrlAnalysis)
            # Seuls les liens réellement scannés comptent : personne à prévenir pour les autres
            .where(
                exists().where(Scan.analysis_id == UrlAnalysis.id),
                or_(UrlAnalysis.analyzed_at.is_(None), UrlAnalysis.analyzed_at < limit_date),
            )
            .order_by(UrlAnalysis.analyzed_at.asc().nulls_first())
            .limit(limit)
        ).all()
    )


def reclassify_batch(
    db: Session,
    analyzer: UrlAnalyzer,
    ttl_hours: int,
    limit: int,
    pause: Callable[[], None] = lambda: None,
) -> int:
    analyses = stale_analyses(db, ttl_hours, limit)
    for analysis in analyses:
        refresh_analysis(db, analysis, analyzer, ttl_hours, community_signals)
        db.commit()
        pause()
    return len(analyses)
