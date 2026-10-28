import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from geoalchemy2.elements import WKTElement
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models import Scan, User
from app.schemas.scan import ScanCreate, ScanList, ScanOut, scan_to_out
from app.security.dependencies import get_current_user
from app.services.content_parser import parse_qr_content
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
        url=parsed.url,
    )
    if parsed.url is not None:
        scan.analysis = get_or_create_analysis(db, parsed.url)
        refresh_analysis(db, scan.analysis, analyzer, get_settings().analysis_ttl_hours)
    if body.latitude is not None and body.longitude is not None:
        # WKT : longitude en premier (x, y)
        scan.location = WKTElement(f"POINT({body.longitude} {body.latitude})", srid=4326)

    db.add(scan)
    db.commit()
    db.refresh(scan)
    return scan_to_out(scan)


@router.get("", response_model=ScanList)
def list_scans(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> ScanList:
    total = (
        db.scalar(select(func.count()).select_from(Scan).where(Scan.user_id == current.id)) or 0
    )
    scans = (
        db.scalars(
            select(Scan)
            .where(Scan.user_id == current.id)
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
    db.delete(scan)
    db.commit()
