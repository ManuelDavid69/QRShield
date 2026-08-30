import uuid
from datetime import date

from geoalchemy2 import Geography
from sqlalchemy import Date, Enum, ForeignKey, String, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.enums import ReportSource, ThreatType, Verdict


class CommunityReport(Base):
    """Signalement anonyme : volontairement aucun lien vers l'utilisateur ni vers son scan."""

    __tablename__ = "community_reports"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    analysis_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("url_analyses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    domain: Mapped[str] = mapped_column(String(253), nullable=False, index=True)
    verdict: Mapped[Verdict] = mapped_column(
        Enum(Verdict, native_enum=False, length=20, values_callable=lambda e: [m.value for m in e]),
        nullable=False,
    )
    threat: Mapped[ThreatType] = mapped_column(
        Enum(ThreatType, native_enum=False, length=20, values_callable=lambda e: [m.value for m in e]),
        nullable=False,
    )
    source: Mapped[ReportSource] = mapped_column(
        Enum(ReportSource, native_enum=False, length=20, values_callable=lambda e: [m.value for m in e]),
        nullable=False,
    )
    # Centre d'une maille d'environ 1 km, jamais la position du scan
    area: Mapped[str | None] = mapped_column(Geography(geometry_type="POINT", srid=4326), nullable=True)
    # Le jour seulement : une heure précise permettrait de retrouver le scan correspondant
    reported_on: Mapped[date] = mapped_column(Date, server_default=func.current_date(), nullable=False, index=True)
    # HMAC propre à chaque URL : empêche les doublons sans permettre de relier deux signalements
    reporter_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    # HMAC par maille et par domaine : comptent les personnes avant de publier. Vides sur les
    # anciens signalements, qui ne comptent donc plus pour ce seuil
    zone_reporter_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    domain_reporter_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
