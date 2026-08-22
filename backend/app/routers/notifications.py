import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Notification, User
from app.security.dependencies import get_current_user
from app.services.notifications import list_notifications, mark_read

router = APIRouter(prefix="/notifications", tags=["notifications"])


class NotificationOut(BaseModel):
    id: uuid.UUID
    title: str
    body: str
    scan_id: uuid.UUID | None
    created_at: datetime
    read: bool


class NotificationList(BaseModel):
    items: list[NotificationOut]
    unread: int


@router.get("", response_model=NotificationList)
def my_notifications(
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> NotificationList:
    items, unread = list_notifications(db, current.id)
    return NotificationList(
        items=[
            NotificationOut(
                id=n.id,
                title=n.title,
                body=n.body,
                scan_id=n.scan_id,
                created_at=n.created_at,
                read=n.read_at is not None,
            )
            for n in items
        ],
        unread=unread,
    )


@router.post("/{notification_id}/read", status_code=status.HTTP_204_NO_CONTENT)
def read_notification(
    notification_id: uuid.UUID,
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
) -> None:
    notification = db.get(Notification, notification_id)
    if notification is None or notification.user_id != current.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Notification introuvable")
    mark_read(db, notification)
