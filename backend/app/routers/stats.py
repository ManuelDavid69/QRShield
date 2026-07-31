from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.schemas.stats import UserStats
from app.security.dependencies import get_current_user
from app.services.stats import user_stats

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("/me", response_model=UserStats)
def my_stats(
    weeks: int = Query(12, ge=4, le=52),
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> UserStats:
    return user_stats(db, current.id, weeks)
