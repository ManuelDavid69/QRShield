import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, UniqueConstraint, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Notification(Base):
    """Alerte destinée à un utilisateur : un lien qu'il a scanné est devenu dangereux."""

    __tablename__ = "notifications"
    __table_args__ = (
        # Une seule alerte par personne et par lien, même si l'analyse change plusieurs fois
        UniqueConstraint("user_id", "analysis_id", name="uq_notifications_user_analysis"),
        Index("ix_notifications_user_created_at", "user_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    analysis_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("url_analyses.id", ondelete="CASCADE"), nullable=False
    )
    scan_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, ForeignKey("scans.id", ondelete="SET NULL"), nullable=True)
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
