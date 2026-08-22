"""Alertes de reclassement : préviennent ceux qui ont scanné un lien devenu dangereux."""

import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import distinct_on, insert
from sqlalchemy.orm import Session

from app.models import Notification, Scan, UrlAnalysis

TITLE = "Lien reclassé dangereux"
LIST_LIMIT = 50


def notify_reclassified(db: Session, analysis: UrlAnalysis) -> int:
    """Crée une alerte par personne, liée à son dernier scan de ce lien."""
    rows = db.execute(
        select(Scan.user_id, Scan.id)
        .where(Scan.analysis_id == analysis.id)
        .order_by(Scan.user_id, Scan.scanned_at.desc())
        .ext(distinct_on(Scan.user_id))
    ).all()
    if not rows:
        return 0

    body = (
        f"Un lien que vous avez scanné ({analysis.domain}) est maintenant considéré comme dangereux. "
        "Si vous y avez saisi des informations, changez vos mots de passe et surveillez vos comptes."
    )
    result = db.execute(
        insert(Notification)
        .values([
            {
                "id": uuid.uuid4(),
                "user_id": user_id,
                "analysis_id": analysis.id,
                "scan_id": scan_id,
                "title": TITLE,
                "body": body,
            }
            for user_id, scan_id in rows
        ])
        .on_conflict_do_nothing(constraint="uq_notifications_user_analysis")
    )
    return result.rowcount


def list_notifications(db: Session, user_id: uuid.UUID) -> tuple[list[Notification], int]:
    items = db.scalars(
        select(Notification)
        .where(Notification.user_id == user_id)
        .order_by(Notification.created_at.desc())
        .limit(LIST_LIMIT)
    ).all()
    unread = (
        db.scalar(
            select(func.count())
            .select_from(Notification)
            .where(Notification.user_id == user_id, Notification.read_at.is_(None))
        )
        or 0
    )
    return list(items), unread


def mark_read(db: Session, notification: Notification) -> None:
    if notification.read_at is None:
        notification.read_at = datetime.now(UTC)
        db.commit()
