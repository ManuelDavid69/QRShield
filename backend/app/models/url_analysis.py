import uuid
from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Enum,
    SmallInteger,
    String,
    Text,
    Uuid,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.enums import Verdict


class UrlAnalysis(Base):
    """Analyse partagée d'une URL entre tous les utilisateurs (reclassement + prévention)."""

    __tablename__ = "url_analyses"
    __table_args__ = (
        CheckConstraint(
            "score IS NULL OR (score BETWEEN 0 AND 100)",
            name="ck_url_analyses_score_range",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    url: Mapped[str] = mapped_column(Text, nullable=False)
    # sha256 hex de l'URL normalisée : sert de clé d'unicité partagée
    url_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    final_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    domain: Mapped[str | None] = mapped_column(String(253), index=True, nullable=True)
    verdict: Mapped[Verdict] = mapped_column(
        Enum(Verdict, native_enum=False, length=20, values_callable=lambda e: [m.value for m in e]),
        nullable=False,
        default=Verdict.UNKNOWN,
        server_default=Verdict.UNKNOWN.value,
    )
    score: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    reasons: Mapped[list] = mapped_column(JSONB, nullable=False, server_default="[]")
    details: Mapped[dict] = mapped_column(JSONB, nullable=False, server_default="{}")
    analyzed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
