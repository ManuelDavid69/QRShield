"""Ajoute des signalements fictifs pour montrer la carte tant que le projet n'a pas d'utilisateurs.

python -m scripts.seed_demo          ajoute les données de démonstration
python -m scripts.seed_demo --clear  les retire

Les domaines utilisent l'extension réservée .example : aucun vrai site n'est mis en cause.
"""

import hashlib
import random
import sys
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete

from app.database import SessionLocal
from app.models import CommunityReport, ReportSource, ThreatType, UrlAnalysis, Verdict
from app.services.community import snap_to_grid

DEMO_MARKER = "demo-qrshield"

CITIES = [
    ("Paris", 48.857, 2.352, 34),
    ("Lyon", 45.764, 4.836, 26),
    ("Marseille", 43.296, 5.370, 21),
    ("Toulouse", 43.605, 1.444, 14),
    ("Bordeaux", 44.838, -0.579, 13),
    ("Lille", 50.629, 3.057, 12),
    ("Nantes", 47.218, -1.554, 10),
    ("Strasbourg", 48.573, 7.752, 9),
    ("Nice", 43.710, 7.262, 9),
    ("Rennes", 48.117, -1.678, 6),
    ("Grenoble", 45.188, 5.724, 6),
    ("Montpellier", 43.611, 3.877, 7),
]

DOMAINS = [
    ("paiement-parking-lyon.example", ThreatType.PHISHING, Verdict.DANGEROUS),
    ("horodateur-amende.example", ThreatType.PHISHING, Verdict.DANGEROUS),
    ("ameli-remboursement.example", ThreatType.PHISHING, Verdict.DANGEROUS),
    ("suivi-colis-livraison.example", ThreatType.PHISHING, Verdict.SUSPICIOUS),
    ("mise-a-jour-mobile.example", ThreatType.MALWARE, Verdict.DANGEROUS),
    ("menu-restaurant-promo.example", ThreatType.OTHER, Verdict.SUSPICIOUS),
    ("wifi-gratuit-gare.example", ThreatType.OTHER, Verdict.SUSPICIOUS),
]


def clear(db) -> None:
    # Les signalements suivent par ON DELETE CASCADE
    db.execute(delete(UrlAnalysis).where(UrlAnalysis.url.like(f"%{DEMO_MARKER}%")))


def seed(db) -> int:
    rng = random.Random(42)
    analyses = {}
    for domain, _, verdict in DOMAINS:
        url = f"https://{domain}/{DEMO_MARKER}"
        analysis = UrlAnalysis(
            url=url,
            url_hash=hashlib.sha256(url.encode()).hexdigest(),
            domain=domain,
            verdict=verdict,
            analyzed_at=datetime.now(UTC),
        )
        db.add(analysis)
        analyses[domain] = analysis
    db.flush()

    weights = [5, 4, 3, 4, 2, 2, 1]
    today = datetime.now(UTC).date()
    total = 0
    for _, lat, lon, count in CITIES:
        for _ in range(count):
            domain, threat, verdict = rng.choices(DOMAINS, weights=weights)[0]
            # Quelques mailles autour du centre-ville, pour ne pas tout empiler sur un point
            area = snap_to_grid(lat + rng.gauss(0, 0.006), lon + rng.gauss(0, 0.009))
            db.add(CommunityReport(
                analysis_id=analyses[domain].id,
                domain=domain,
                verdict=verdict,
                threat=threat,
                source=ReportSource.AUTOMATIC,
                area=area,
                reported_on=today - timedelta(days=rng.randint(0, 80)),
                reporter_hash=uuid.uuid4().hex,
            ))
            total += 1
    return total


def main() -> None:
    with SessionLocal() as db:
        clear(db)
        if "--clear" in sys.argv:
            print("Données de démonstration retirées")
        else:
            print(f"{seed(db)} signalements fictifs ajoutés")
        db.commit()


if __name__ == "__main__":
    main()
