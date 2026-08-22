"""Alertes de reclassement et endpoints communautaires associés."""

from datetime import UTC, datetime, timedelta

from sqlalchemy import update

from app.main import app
from app.models import UrlAnalysis
from app.models.enums import Verdict
from app.services.qr_analyzer import AnalysisOutcome, get_url_analyzer
from app.services.reclassification import reclassify_batch, stale_analyses

URL_SUR = "https://www.exemple-site.fr/"
TITRE = "Lien reclassé dangereux"


class FakeAnalyzer:
    """Analyseur hors ligne : verdict imposé, aucun appel réseau."""

    def __init__(self, verdict: Verdict) -> None:
        self.verdict = verdict

    def analyze(self, url: str, community=None) -> AnalysisOutcome:
        return AnalysisOutcome(
            final_url=url,
            domain="exemple-site.fr",
            score=80 if self.verdict is Verdict.DANGEROUS else 0,
            verdict=self.verdict,
            signals=[],
            details={},
        )


def _scan(api, headers, content: str) -> dict:
    r = api.post("/scans", json={"content": content}, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


def _expire(session_factory) -> None:
    vieux = datetime.now(UTC) - timedelta(days=3)
    with session_factory() as db:
        db.execute(update(UrlAnalysis).values(analyzed_at=vieux))
        db.commit()


def _reclassify(session_factory, verdict: Verdict, ttl_hours: int = 24, limit: int = 20) -> int:
    with session_factory() as db:
        return reclassify_batch(db, FakeAnalyzer(verdict), ttl_hours=ttl_hours, limit=limit)


def _notifications(api, headers) -> dict:
    r = api.get("/notifications", headers=headers)
    assert r.status_code == 200, r.text
    return r.json()


def test_lien_devenu_dangereux_notifie_chaque_scanneur(api, auth_headers, db_session_factory):
    alice = auth_headers("alice@test.fr")
    bob = auth_headers("bob@test.fr")
    carol = auth_headers("carol@test.fr")
    scan_alice = _scan(api, alice, URL_SUR)
    scan_bob = _scan(api, bob, URL_SUR)
    _expire(db_session_factory)

    assert _reclassify(db_session_factory, Verdict.DANGEROUS) == 1

    for headers, scan_id in ((alice, scan_alice["id"]), (bob, scan_bob["id"])):
        data = _notifications(api, headers)
        assert data["unread"] == 1
        assert len(data["items"]) == 1
        item = data["items"][0]
        assert item["title"] == TITRE
        assert "exemple-site.fr" in item["body"]
        assert item["read"] is False
        assert item["scan_id"] == scan_id

    assert _notifications(api, carol)["items"] == []


def test_verdict_du_scan_suit_le_reclassement(api, auth_headers, db_session_factory):
    alice = auth_headers()
    scan = _scan(api, alice, URL_SUR)
    _expire(db_session_factory)
    _reclassify(db_session_factory, Verdict.DANGEROUS)

    r = api.get(f"/scans/{scan['id']}", headers=alice)
    assert r.status_code == 200, r.text
    assert r.json()["verdict"] == "dangerous"


def test_pas_de_doublon_entre_deux_reclassements(api, auth_headers, db_session_factory):
    alice = auth_headers()
    _scan(api, alice, URL_SUR)

    _expire(db_session_factory)
    _reclassify(db_session_factory, Verdict.DANGEROUS)
    _expire(db_session_factory)
    _reclassify(db_session_factory, Verdict.DANGEROUS)

    data = _notifications(api, alice)
    assert data["unread"] == 1
    assert len(data["items"]) == 1


def test_lien_reste_sur_aucune_notification(api, auth_headers, db_session_factory):
    alice = auth_headers()
    _scan(api, alice, URL_SUR)
    _expire(db_session_factory)

    assert _reclassify(db_session_factory, Verdict.SAFE) == 1
    data = _notifications(api, alice)
    assert data["unread"] == 0
    assert data["items"] == []


def test_lien_deja_dangereux_nest_pas_un_reclassement(api, auth_headers, db_session_factory):
    alice = auth_headers()
    _scan(api, alice, "https://paypa1-securite.top/login")

    with db_session_factory() as db:
        db.execute(update(UrlAnalysis).values(verdict=Verdict.DANGEROUS, score=90))
        db.commit()

    _expire(db_session_factory)
    assert _reclassify(db_session_factory, Verdict.DANGEROUS) == 1

    data = _notifications(api, alice)
    assert data["unread"] == 0
    assert data["items"] == []


def test_lien_jamais_scanne_ignore(api, auth_headers, db_session_factory):
    auth_headers()
    vieux = datetime.now(UTC) - timedelta(days=3)
    with db_session_factory() as db:
        analyse = UrlAnalysis(
            url="https://jamais-scanne.example/page",
            url_hash="a" * 64,
            domain="jamais-scanne.example",
            score=0,
            verdict=Verdict.SAFE,
            analyzed_at=vieux,
        )
        db.add(analyse)
        db.commit()
        analyse_id = analyse.id

    with db_session_factory() as db:
        assert analyse_id not in {a.id for a in stale_analyses(db, 24, 20)}


def test_analyse_recente_non_reanalysee(api, auth_headers, db_session_factory):
    alice = auth_headers()
    _scan(api, alice, URL_SUR)

    assert _reclassify(db_session_factory, Verdict.DANGEROUS) == 0
    assert _notifications(api, alice)["unread"] == 0


def test_limite_respectee(api, auth_headers, db_session_factory):
    alice = auth_headers()
    for suffixe in ("un", "deux", "trois"):
        _scan(api, alice, f"https://www.exemple-site.fr/{suffixe}")
    _expire(db_session_factory)

    assert _reclassify(db_session_factory, Verdict.DANGEROUS, limit=2) == 2


def test_marquer_comme_lue(api, auth_headers, db_session_factory):
    alice = auth_headers()
    _scan(api, alice, URL_SUR)
    _expire(db_session_factory)
    _reclassify(db_session_factory, Verdict.DANGEROUS)

    item = _notifications(api, alice)["items"][0]
    r = api.post(f"/notifications/{item['id']}/read", headers=alice)
    assert r.status_code == 204, r.text

    data = _notifications(api, alice)
    assert data["unread"] == 0
    assert data["items"][0]["read"] is True


def test_isolation_entre_utilisateurs(api, auth_headers, db_session_factory):
    alice = auth_headers("alice@test.fr")
    bob = auth_headers("bob@test.fr")
    _scan(api, alice, URL_SUR)
    _expire(db_session_factory)
    _reclassify(db_session_factory, Verdict.DANGEROUS)

    item = _notifications(api, alice)["items"][0]
    r = api.post(f"/notifications/{item['id']}/read", headers=bob)
    assert r.status_code == 404
    assert _notifications(api, alice)["unread"] == 1

    assert api.get("/notifications").status_code == 401


def test_reclassement_pendant_un_scan_normal(api, auth_headers, db_session_factory):
    alice = auth_headers("alice@test.fr")
    bob = auth_headers("bob@test.fr")
    _scan(api, alice, URL_SUR)
    _expire(db_session_factory)

    app.dependency_overrides[get_url_analyzer] = lambda: FakeAnalyzer(Verdict.DANGEROUS)
    _scan(api, bob, URL_SUR)

    data = _notifications(api, alice)
    assert data["unread"] == 1
    assert data["items"][0]["title"] == TITRE


def test_zones_communautaires_et_validation_periode(api):
    r = api.get("/community/zones", params={"days": 7})
    assert r.status_code == 200, r.text
    assert r.json()["period_days"] == 7

    for days in (0, 91):
        assert api.get("/community/zones", params={"days": days}).status_code == 422
