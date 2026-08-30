"""Suppression de compte : ne laisse aucune donnée rattachable à la personne."""

from sqlalchemy import delete, exists, select
from sqlalchemy.orm import Session

from app.models import CommunityReport, Notification, Scan, UrlAnalysis, User
from app.services.community import remove_user_reports


def delete_account(db: Session, user: User) -> None:
    analysis_ids = set(
        db.scalars(select(Scan.analysis_id).where(Scan.user_id == user.id, Scan.analysis_id.is_not(None)))
    )
    # À faire avant la suppression : les signalements ne se retrouvent qu'à partir de l'utilisateur
    remove_user_reports(db, user.id, analysis_ids)

    # Scans, alertes et sessions suivent par CASCADE
    db.delete(user)
    db.flush()

    # Une URL scannée par cette seule personne peut contenir des données personnelles
    if analysis_ids:
        db.execute(
            delete(UrlAnalysis).where(
                UrlAnalysis.id.in_(analysis_ids),
                ~exists().where(Scan.analysis_id == UrlAnalysis.id),
                ~exists().where(CommunityReport.analysis_id == UrlAnalysis.id),
                ~exists().where(Notification.analysis_id == UrlAnalysis.id),
            )
        )
    db.commit()
