import uuid

import pytest

from app.models import CommunityReport, ReportSource, ThreatType, UrlAnalysis, Verdict
from app.services.analysis.signals import Severity
from app.services.community import community_signals

DOMAIN = "exemple-site.fr"


def _analysis(db, domain=DOMAIN):
    analysis = UrlAnalysis(url=f"https://{domain}/{uuid.uuid4()}", url_hash=uuid.uuid4().hex, domain=domain)
    db.add(analysis)
    db.flush()
    return analysis


def _reports(db, analysis, count, source=ReportSource.USER, verdict=Verdict.SUSPICIOUS):
    for _ in range(count):
        db.add(CommunityReport(
            analysis_id=analysis.id,
            domain=analysis.domain,
            verdict=verdict,
            threat=ThreatType.OTHER,
            source=source,
            reporter_hash=uuid.uuid4().hex,
        ))
    db.flush()


@pytest.fixture
def db(api, db_session_factory):
    # api remet la base à zéro après chaque test
    with db_session_factory() as session:
        yield session
        session.commit()


def _codes(signals):
    return {signal.code: signal.severity for signal in signals}


def test_sans_domaine(db):
    assert community_signals(db, None, uuid.uuid4()) == []


def test_un_domaine_officiel_ne_peut_pas_etre_vise(db):
    analysis = _analysis(db, "paypal.com")
    _reports(db, analysis, 50)
    assert community_signals(db, "paypal.com", analysis.id) == []


@pytest.mark.parametrize(
    "count, expected",
    [(2, None), (3, Severity.MEDIUM), (9, Severity.MEDIUM), (10, Severity.HIGH), (200, Severity.HIGH)],
)
def test_poids_des_signalements_plafonne(db, count, expected):
    analysis = _analysis(db)
    _reports(db, analysis, count)
    assert _codes(community_signals(db, DOMAIN, analysis.id)).get("community_reports") == expected


def test_le_score_ne_s_alimente_pas_lui_meme(db):
    analysis = _analysis(db)
    _reports(db, analysis, 20, source=ReportSource.AUTOMATIC)
    assert community_signals(db, DOMAIN, analysis.id) == []

    _reports(db, analysis, 20, source=ReportSource.AUTOMATIC, verdict=Verdict.DANGEROUS)
    assert community_signals(db, DOMAIN, analysis.id) == []


def test_autre_lien_dangereux_du_meme_domaine(db):
    current = _analysis(db)
    other = _analysis(db)
    _reports(db, other, 1, source=ReportSource.AUTOMATIC, verdict=Verdict.DANGEROUS)
    assert _codes(community_signals(db, DOMAIN, current.id)) == {"community_domain": Severity.MEDIUM}


def test_de_bout_en_bout(api, auth_headers):
    url = "https://www.exemple-site.fr/"
    for name in ("a", "b", "c"):
        headers = auth_headers(email=f"{name}@test.fr")
        scan = api.post("/scans", json={"content": url}, headers=headers).json()
        assert api.post(f"/scans/{scan['id']}/report", headers=headers).status_code == 204

    # Chaque signalement a marqué l'analyse à refaire, pas besoin d'attendre 24 heures
    late = api.post("/scans", json={"content": url}, headers=auth_headers(email="d@test.fr")).json()
    assert "community_reports" in {reason["code"] for reason in late["analysis"]["reasons"]}
    assert late["analysis"]["score"] == 25
