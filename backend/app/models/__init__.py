# Importé par Alembic (env.py) pour enregistrer toutes les tables sur Base.metadata.
from app.database import Base
from app.models.community_report import CommunityReport
from app.models.notification import Notification
from app.models.enums import ContentType, ReportSource, ScanCategory, ThreatType, Verdict
from app.models.url_analysis import UrlAnalysis
from app.models.user import User
from app.models.scan import Scan

__all__ = [
    "Base",
    "ContentType",
    "ScanCategory",
    "ThreatType",
    "ReportSource",
    "CommunityReport",
    "Notification",
    "Verdict",
    "User",
    "UrlAnalysis",
    "Scan",
]
