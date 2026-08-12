from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.community import CommunityStats, ZoneList
from app.security.rate_limit import limit_by_ip, public_limiter
from app.services.community import public_stats, public_zones

# Routes publiques, sans compte : la page web les interroge directement
router = APIRouter(prefix="/community", tags=["community"], dependencies=[Depends(limit_by_ip(public_limiter))])


@router.get("/zones", response_model=ZoneList)
def zones(db: Session = Depends(get_db)) -> ZoneList:
    return public_zones(db)


@router.get("/stats", response_model=CommunityStats)
def stats(db: Session = Depends(get_db)) -> CommunityStats:
    return public_stats(db)
