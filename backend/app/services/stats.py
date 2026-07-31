"""Statistiques personnelles, calculées directement par PostgreSQL."""

import uuid
from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.models import Scan, UrlAnalysis, Verdict
from app.schemas.stats import CategoryCount, DomainCount, PlaceCount, UserStats, VerdictCount, WeekCount

# Sinon un scan du lundi à 00h30 tomberait dans la semaine d'avant
TIMEZONE = "Europe/Paris"
TOP_LIMIT = 5

# eps est exprimé dans l'unité de la projection Web Mercator (3857), qui étire les distances :
# à la latitude de la France, 200 unités font environ 140 mètres réels
_PLACES_SQL = text("""
    WITH points AS (
        SELECT location::geometry AS geom,
               ST_ClusterDBSCAN(ST_Transform(location::geometry, 3857), eps := 200, minpoints := 1)
                   OVER () AS cluster
        FROM scans
        WHERE user_id = :user_id AND location IS NOT NULL
    )
    SELECT ST_Y(ST_Centroid(ST_Collect(geom))) AS latitude,
           ST_X(ST_Centroid(ST_Collect(geom))) AS longitude,
           count(*) AS count
    FROM points
    GROUP BY cluster
    ORDER BY count DESC
    LIMIT :limit
""")


def _monday(day: date) -> date:
    return day - timedelta(days=day.weekday())


def _weekly_counts(db: Session, user_id: uuid.UUID, weeks: int, today: date) -> list[WeekCount]:
    first_week = _monday(today) - timedelta(weeks=weeks - 1)
    local_time = func.timezone(TIMEZONE, Scan.scanned_at)
    week = func.date_trunc("week", local_time)
    rows = db.execute(
        select(week, func.count())
        .where(Scan.user_id == user_id, local_time >= first_week)
        .group_by(week)
    ).all()
    counts = {row[0].date(): row[1] for row in rows}
    # Les semaines sans scan doivent apparaître à zéro sur le graphique
    return [
        WeekCount(week_start=start, count=counts.get(start, 0))
        for start in (first_week + timedelta(weeks=i) for i in range(weeks))
    ]


def user_stats(db: Session, user_id: uuid.UUID, weeks: int) -> UserStats:
    by_user = Scan.user_id == user_id
    total = db.scalar(select(func.count()).select_from(Scan).where(by_user)) or 0

    verdict_rows = db.execute(
        select(UrlAnalysis.verdict, func.count())
        .select_from(Scan)
        .join(UrlAnalysis, Scan.analysis_id == UrlAnalysis.id)
        .where(by_user)
        .group_by(UrlAnalysis.verdict)
    ).all()
    verdicts = {verdict: count for verdict, count in verdict_rows}
    flagged = verdicts.get(Verdict.SUSPICIOUS, 0) + verdicts.get(Verdict.DANGEROUS, 0)

    category_rows = db.execute(
        select(Scan.category, func.count())
        .where(by_user)
        .group_by(Scan.category)
        .order_by(func.count().desc())
    ).all()

    domain_rows = db.execute(
        select(UrlAnalysis.domain, func.count())
        .select_from(Scan)
        .join(UrlAnalysis, Scan.analysis_id == UrlAnalysis.id)
        .where(by_user, UrlAnalysis.domain.is_not(None))
        .group_by(UrlAnalysis.domain)
        .order_by(func.count().desc(), UrlAnalysis.domain)
        .limit(TOP_LIMIT)
    ).all()

    place_rows = db.execute(_PLACES_SQL, {"user_id": user_id, "limit": TOP_LIMIT}).all()
    today = datetime.now(UTC).astimezone(ZoneInfo(TIMEZONE)).date()

    return UserStats(
        total_scans=total,
        flagged_scans=flagged,
        flagged_percent=round(100 * flagged / total, 1) if total else 0.0,
        verdicts=[VerdictCount(verdict=v, count=c) for v, c in verdicts.items()],
        categories=[CategoryCount(category=c, count=n) for c, n in category_rows],
        weekly=_weekly_counts(db, user_id, weeks, today),
        places=[PlaceCount(latitude=r.latitude, longitude=r.longitude, count=r.count) for r in place_rows],
        top_domains=[DomainCount(domain=d, count=c) for d, c in domain_rows],
    )
