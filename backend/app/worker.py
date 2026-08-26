"""Tâche de fond lancée dans son propre conteneur : python -m app.worker"""

import logging
import time

from app.config import get_settings
from app.database import SessionLocal
from app.security.refresh_tokens import purge_expired_tokens
from app.services.qr_analyzer import get_url_analyzer
from app.services.reclassification import reclassify_batch

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
# httpx écrit chaque URL en INFO : un lien scanné n'a pas sa place dans les journaux
logging.getLogger("httpx").setLevel(logging.WARNING)
logger = logging.getLogger("worker")

# VirusTotal autorise 4 requêtes par minute dans sa version gratuite
PAUSE_SECONDS = 16


def run_once(pause_seconds: float = PAUSE_SECONDS) -> int:
    settings = get_settings()
    with SessionLocal() as db:
        return reclassify_batch(
            db,
            get_url_analyzer(),
            settings.analysis_ttl_hours,
            settings.reclassification_batch,
            pause=lambda: time.sleep(pause_seconds),
        )


def main() -> None:
    interval = get_settings().reclassification_interval_minutes * 60
    while True:
        try:
            logger.info("%d liens réanalysés", run_once())
            with SessionLocal() as db:
                logger.info("%d sessions expirées supprimées", purge_expired_tokens(db))
        except Exception:
            # Une panne passagère (base, réseau) ne doit pas arrêter le service
            logger.exception("échec de la réanalyse")
        time.sleep(interval)


if __name__ == "__main__":
    main()
