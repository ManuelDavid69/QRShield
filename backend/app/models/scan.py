import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from geoalchemy2 import Geography
from sqlalchemy import DateTime, Enum, ForeignKey, Index, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.enums import ContentType, Verdict

if TYPE_CHECKING:
    from app.models.url_analysis import UrlAnalysis
    from app.models.user import User


class Scan(Base):
    __tablename__ = "scans"
    # couvre aussi les recherches par user_id seul, pas besoin d'un index en plus
    __table_args__ = (
        Index("ix_scans_user_scanned_at", "user_id", "scanned_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    content_type: Mapped[ContentType] = mapped_column(
        Enum(ContentType, native_enum=False, length=20, values_callable=lambda e: [m.value for m in e]),
        nullable=False,
    )
    url: Mapped[str | None] = mapped_column(Text, nullable=True)
    analysis_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("url_analyses.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    location: Mapped[str | None] = mapped_column(
        Geography(geometry_type="POINT", srid=4326), nullable=True
    )
    scanned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    user: Mapped["User"] = relationship(back_populates="scans")
    # lazy="joined" : le verdict est presque toujours nécessaire pour afficher un scan
    analysis: Mapped["UrlAnalysis | None"] = relationship(lazy="joined")

    @property
    def verdict(self) -> Verdict:
        # Le verdict vient de l'analyse partagée pour suivre les reclassements
        if self.analysis is not None:
            return self.analysis.verdict
        return Verdict.UNKNOWN
