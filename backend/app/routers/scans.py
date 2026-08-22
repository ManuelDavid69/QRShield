import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from geoalchemy2.elements import WKTElement
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models import Scan, UrlAnalysis, User, Verdict
from app.schemas.scan import ScanCreate, ScanList, ScanOut, scan_to_out
from app.security.dependencies import get_current_user
from app.security.rate_limit import limit_by_ip, report_limiter
from app.services.community import community_signals, record_automatic_report, record_user_report, remove_reports_if_last_scan
from app.services.content_parser import categorize, parse_qr_content
from app.services.qr_analyzer import UrlAnalyzer, get_url_analyzer
from app.services.url_analyses import get_or_create_analysis, refresh_analysis

router = APIRouter(prefix="/scans", tags=["scans"])


def _get_owned_scan(db: Session, scan_id: uuid.UUID, user: User) -> Scan:
    scan = db.get(Scan, scan_id)
    # 404 et pas 403 : ne pas confirmer qu'un id existe chez quelqu'un d'autre
    if scan is None or scan.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Scan introuvable")
    return scan


@router.post("", response_model=ScanOut, status_code=status.HTTP_201_CREATED)
def create_scan(
    body: ScanCreate,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
    analyzer: UrlAnalyzer = Depends(get_url_analyzer),
) -> ScanOut:
    parsed = parse_qr_content(body.content)

    scan = Scan(
        user_id=current.id,
        # On stocke la version assainie : les mots de passe Wi-Fi ne doivent jamais toucher la base
        content=parsed.sanitized,
        content_type=parsed.content_type,
        category=categorize(parsed),
        url=parsed.url,
    )
    if parsed.url is not None:
        scan.analysis = get_or_create_analysis(db, parsed.url)
        refresh_analysis(db, scan.analysis, analyzer, get_settings().analysis_ttl_hours, community_signals)
    if body.latitude is not None and body.longitude is not None:
        # WKT : longitude en premier (x, y)
        scan.location = WKTElement(f"POINT({body.longitude} {body.latitude})", srid=4326)

    db.add(scan)
    db.flush()
    record_automatic_report(db, scan)
    db.commit()
    db.refresh(scan)
    return scan_to_out(scan)


@router.get("", response_model=ScanList)
def list_scans(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    verdict: Verdict | None = None,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> ScanList:
    conditions = [Scan.user_id == current.id]
    if verdict is not None:
        conditions.append(Scan.analysis.has(UrlAnalysis.verdict == verdict))

    total = db.scalar(select(func.count()).select_from(Scan).where(*conditions)) or 0
    scans = (
        db.scalars(
            select(Scan)
            .where(*conditions)
            .order_by(Scan.scanned_at.desc(), Scan.id)
            .limit(limit)
            .offset(offset)
        )
        # unique() obligatoire : la relation analysis est chargée en eager "joined"
        .unique()
        .all()
    )
    return ScanList(items=[scan_to_out(s) for s in scans], total=total)


@router.get("/{scan_id}", response_model=ScanOut)
def get_scan(
    scan_id: uuid.UUID,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> ScanOut:
    return scan_to_out(_get_owned_scan(db, scan_id, current))


@router.delete("/{scan_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_scan(
    scan_id: uuid.UUID,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> None:
    scan = _get_owned_scan(db, scan_id, current)
    analysis_id = scan.analysis_id
    db.delete(scan)
    db.flush()
    remove_reports_if_last_scan(db, current.id, analysis_id)
    db.commit()


@router.post(
    "/{scan_id}/report",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(limit_by_ip(report_limiter))],
)
def report_scan(
    scan_id: uuid.UUID,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> None:
    scan = _get_owned_scan(db, scan_id, current)
    if scan.analysis is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Seuls les liens peuvent être signalés")
    record_user_report(db, scan)
    db.commit()

