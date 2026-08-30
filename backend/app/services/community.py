"""Volet communautaire : signalements anonymes, agrégation publique et apport au score.

Ce que la base ne contient jamais : l'identifiant de l'utilisateur, l'URL complète (elle
peut contenir des données personnelles), la position du scan ou son heure.
"""

import hashlib
import hmac
import uuid
from datetime import UTC, date, datetime, timedelta

from geoalchemy2.elements import WKTElement
from geoalchemy2.shape import to_shape
from sqlalchemy import case, delete, func, select, text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import CommunityReport, ReportSource, Scan, ThreatType, UrlAnalysis, Verdict
from app.schemas.community import CommunityStats, DomainReports, ThreatCount, WeekReports, ZoneList, ZoneOut
from app.services.analysis.heuristics import split_domain
from app.services.analysis.signals import Severity, Signal

# 0,01 degré fait environ 1,1 km en latitude et 0,8 km en longitude à la latitude de la France
GRID_DEGREES = 0.01
# Compte des personnes et non des signalements : deux scans du même utilisateur au même
# endroit suffiraient sinon à publier son passage
MIN_PEOPLE_PER_ZONE = 2
PERIOD_DAYS = 90
TOP_LIMIT = 5
MAX_ZONES = 1000

USER_REPORTS_MEDIUM = 3
USER_REPORTS_HIGH = 10

_PHISHING_CODES = {
    "brand_impersonation", "brand_lookalike", "brand_typo", "brand_in_subdomain", "brand_homograph",
    "userinfo_trick", "safe_browsing",
}
_MALWARE_CODES = {"dangerous_download", "non_http_redirect"}


def reporter_hash(user_id: uuid.UUID, analysis_id: uuid.UUID, source: ReportSource) -> str:
    """Identique pour une même personne et une même URL, sans rapport d'une URL à l'autre.

    Sans la clé secrète, impossible de vérifier si un utilisateur donné a fait un signalement.
    """
    key = get_settings().community_secret.encode("utf-8")
    message = f"{user_id}:{analysis_id}:{source.value}".encode("utf-8")
    return hmac.new(key, message, hashlib.sha256).hexdigest()


def scope_hash(user_id: uuid.UUID, scope: str) -> str:
    """Identique pour une même personne dans une même maille ou un même domaine.

    Sert uniquement à compter les personnes distinctes avant de publier une zone ou un domaine.
    """
    key = get_settings().community_secret.encode("utf-8")
    message = f"{user_id}:{scope}".encode("utf-8")
    return hmac.new(key, message, hashlib.sha256).hexdigest()


def snap_to_grid(latitude: float, longitude: float) -> WKTElement:
    lat = round(round(latitude / GRID_DEGREES) * GRID_DEGREES, 2)
    lon = round(round(longitude / GRID_DEGREES) * GRID_DEGREES, 2)
    return WKTElement(f"POINT({lon} {lat})", srid=4326)


def threat_from_reasons(reasons: list[dict[str, str]]) -> ThreatType:
    codes = {reason.get("code") for reason in reasons}
    if codes & _MALWARE_CODES:
        return ThreatType.MALWARE
    if codes & _PHISHING_CODES:
        return ThreatType.PHISHING
    return ThreatType.OTHER


def _scan_area(scan: Scan) -> WKTElement | None:
    if scan.location is None:
        return None
    point = to_shape(scan.location)
    return snap_to_grid(point.y, point.x)


def _insert_report(
    db: Session,
    user_id: uuid.UUID,
    analysis: UrlAnalysis,
    source: ReportSource,
    verdict: Verdict,
    area: WKTElement | None,
) -> None:
    # Un seul signalement par personne et par URL, même si elle la scanne dix fois
    db.execute(
        insert(CommunityReport)
        .values(
            id=uuid.uuid4(),
            analysis_id=analysis.id,
            domain=analysis.domain,
            verdict=verdict,
            threat=threat_from_reasons(analysis.reasons),
            source=source,
            area=area,
            reporter_hash=reporter_hash(user_id, analysis.id, source),
            zone_reporter_hash=scope_hash(user_id, f"zone:{area.data}") if area is not None else None,
            domain_reporter_hash=scope_hash(user_id, f"domain:{analysis.domain}"),
        )
        .on_conflict_do_nothing(index_elements=["reporter_hash"])
    )


def record_automatic_report(db: Session, scan: Scan) -> None:
    analysis = scan.analysis
    if analysis is None or analysis.domain is None:
        return
    if analysis.verdict not in (Verdict.SUSPICIOUS, Verdict.DANGEROUS):
        return
    _insert_report(db, scan.user_id, analysis, ReportSource.AUTOMATIC, analysis.verdict, _scan_area(scan))


def record_user_report(db: Session, scan: Scan) -> None:
    analysis = scan.analysis
    if analysis is None or analysis.domain is None:
        return
    verdict = analysis.verdict if analysis.verdict is Verdict.DANGEROUS else Verdict.SUSPICIOUS
    _insert_report(db, scan.user_id, analysis, ReportSource.USER, verdict, _scan_area(scan))
    # Le score sera recalculé au prochain scan de cette URL
    analysis.analyzed_at = None


def remove_reports_if_last_scan(db: Session, user_id: uuid.UUID, analysis_id: uuid.UUID | None) -> None:
    """À appeler après suppression d'un scan : retirer son historique retire aussi ses signalements."""
    if analysis_id is None:
        return
    remaining = db.scalar(
        select(func.count())
        .select_from(Scan)
        .where(Scan.user_id == user_id, Scan.analysis_id == analysis_id)
    )
    if remaining:
        return
    hashes = [reporter_hash(user_id, analysis_id, source) for source in ReportSource]
    db.execute(delete(CommunityReport).where(CommunityReport.reporter_hash.in_(hashes)))


def community_signals(db: Session, domain: str | None, analysis_id: uuid.UUID) -> list[Signal]:
    """Apport de la communauté au score d'une URL.

    Les signalements automatiques d'une URL ne comptent pas pour elle-même : le score
    s'alimenterait tout seul et chaque lien suspect finirait dangereux. Le poids est aussi
    plafonné à "high" : de faux comptes peuvent rendre un site suspect, mais pas dangereux.
    """
    if not domain or split_domain(domain).is_official:
        return []

    since = _period_start()
    recent = (CommunityReport.domain == domain, CommunityReport.reported_on >= since)
    user_reports = (
        db.scalar(
            select(func.count())
            .select_from(CommunityReport)
            .where(*recent, CommunityReport.source == ReportSource.USER)
        )
        or 0
    )
    other_dangerous = (
        db.scalar(
            select(func.count(CommunityReport.analysis_id.distinct())).where(
                *recent,
                CommunityReport.verdict == Verdict.DANGEROUS,
                CommunityReport.analysis_id != analysis_id,
            )
        )
        or 0
    )

    signals: list[Signal] = []
    if user_reports >= USER_REPORTS_MEDIUM:
        signals.append(Signal(
            "community_reports",
            Severity.HIGH if user_reports >= USER_REPORTS_HIGH else Severity.MEDIUM,
            f"{user_reports} utilisateurs de QRShield ont signalé ce site.",
        ))
    if other_dangerous:
        signals.append(Signal(
            "community_domain",
            Severity.MEDIUM,
            f"D'autres liens de {domain} ont déjà été classés dangereux.",
        ))
    return signals


def _period_start(days: int = PERIOD_DAYS) -> date:
    return datetime.now(UTC).date() - timedelta(days=days)


_ZONES_SQL = text("""
    SELECT ST_Y(area::geometry) AS latitude,
           ST_X(area::geometry) AS longitude,
           count(*) AS reports,
           count(*) FILTER (WHERE verdict = 'dangerous') AS dangerous
    FROM community_reports
    WHERE area IS NOT NULL AND reported_on >= :since
    GROUP BY area
    HAVING count(DISTINCT zone_reporter_hash) >= :min_people
    ORDER BY reports DESC
    LIMIT :limit
""")


def _zones(db: Session, limit: int, days: int = PERIOD_DAYS) -> list[ZoneOut]:
    rows = db.execute(
        _ZONES_SQL,
        {"since": _period_start(days), "min_people": MIN_PEOPLE_PER_ZONE, "limit": limit},
    ).all()
    return [
        ZoneOut(latitude=r.latitude, longitude=r.longitude, reports=r.reports, dangerous=r.dangerous)
        for r in rows
    ]


def public_zones(db: Session, days: int = PERIOD_DAYS) -> ZoneList:
    return ZoneList(zones=_zones(db, MAX_ZONES, days), period_days=days)


def public_stats(db: Session) -> CommunityStats:
    since = _period_start()
    recent = CommunityReport.reported_on >= since

    total, dangerous = db.execute(
        select(
            func.count(),
            func.coalesce(func.sum(case((CommunityReport.verdict == Verdict.DANGEROUS, 1), else_=0)), 0),
        ).where(recent)
    ).one()

    threats = db.execute(
        select(CommunityReport.threat, func.count())
        .where(recent)
        .group_by(CommunityReport.threat)
        .order_by(func.count().desc())
    ).all()

    week = func.date_trunc("week", CommunityReport.reported_on)
    weekly = db.execute(select(week, func.count()).where(recent).group_by(week).order_by(week)).all()

    # Même règle que pour les zones : un domaine vu par une seule personne n'est pas publié
    domains = db.execute(
        select(CommunityReport.domain, func.count())
        .where(recent)
        .group_by(CommunityReport.domain)
        .having(func.count(CommunityReport.domain_reporter_hash.distinct()) >= MIN_PEOPLE_PER_ZONE)
        .order_by(func.count().desc(), CommunityReport.domain)
        .limit(TOP_LIMIT)
    ).all()

    all_zones = _zones(db, MAX_ZONES)
    return CommunityStats(
        period_days=PERIOD_DAYS,
        total_reports=total,
        dangerous_reports=dangerous,
        zones=len(all_zones),
        threats=[ThreatCount(threat=t, count=c) for t, c in threats],
        weekly=[WeekReports(week_start=w.date(), count=c) for w, c in weekly],
        top_domains=[DomainReports(domain=d, reports=c) for d, c in domains],
        top_zones=all_zones[:TOP_LIMIT],
    )
