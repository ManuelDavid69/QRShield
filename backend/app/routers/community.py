from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.community import CommunityStats, ZoneList
from app.security.rate_limit import limit_by_ip, public_limiter
from app.services.community import PERIOD_DAYS, public_stats, public_zones

# Routes publiques, sans compte : la page web les interroge directement
router = APIRouter(prefix="/community", tags=["community"], dependencies=[Depends(limit_by_ip(public_limiter))])


@router.get("/zones", response_model=ZoneList)
def zones(days: int = Query(PERIOD_DAYS, ge=1, le=PERIOD_DAYS), db: Session = Depends(get_db)) -> ZoneList:
    return public_zones(db, days)


@router.get("/stats", response_model=CommunityStats)
def stats(db: Session = Depends(get_db)) -> CommunityStats:
    return public_stats(db)
