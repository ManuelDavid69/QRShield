from datetime import date, timedelta

from geoalchemy2.shape import to_shape
from pytest import approx
from sqlalchemy import select, text

from app.models import CommunityReport
from app.models.enums import ReportSource, ThreatType, Verdict
from app.security.rate_limit import public_limiter

SAFE_URL = "https://www.wikipedia.org/"
PHISHING_URL = "https://paypa1-securite.top/login"
PHISHING_URL_2 = "https://paypa1-securite.top/autre"
WIFI_CONTENT = "WIFI:T:WPA;S:MonReseau;P:motdepasse;;"
LYON = (45.764, 4.836)
PARIS = (48.857, 2.352)


def _scan(api, headers, content, lat=None, lon=None):
    payload = {"content": content}
    if lat is not None and lon is not None:
        payload["latitude"] = lat
        payload["longitude"] = lon
    r = api.post("/scans", json=payload, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


def _all_reports(db_session_factory):
    with db_session_factory() as session:
        return list(session.scalars(select(CommunityReport)))


# --- Signalements automatiques ---


def test_scan_safe_ne_cree_aucun_signalement(api, auth_headers, db_session_factory):
    headers = auth_headers()
    _scan(api, headers, SAFE_URL)
    assert _all_reports(db_session_factory) == []


def test_scan_suspect_cree_un_signalement(api, auth_headers, db_session_factory):
    headers = auth_headers()
    _scan(api, headers, PHISHING_URL)
    reports = _all_reports(db_session_factory)
    assert len(reports) == 1
    report = reports[0]
    assert report.source == ReportSource.AUTOMATIC
    assert report.domain == "paypa1-securite.top"
    assert report.verdict == Verdict.SUSPICIOUS
    assert report.threat == ThreatType.PHISHING


def test_meme_personne_meme_url_un_seul_signalement(api, auth_headers, db_session_factory):
    headers = auth_headers()
    _scan(api, headers, PHISHING_URL)
    _scan(api, headers, PHISHING_URL)
    assert len(_all_reports(db_session_factory)) == 1


def test_deux_personnes_deux_signalements(api, auth_headers, db_session_factory):
    alice = auth_headers("alice@test.fr")
    bob = auth_headers("bob@test.fr")
    _scan(api, alice, PHISHING_URL)
    _scan(api, bob, PHISHING_URL)
    assert len(_all_reports(db_session_factory)) == 2


def test_meme_personne_deux_url_deux_signalements(api, auth_headers, db_session_factory):
    headers = auth_headers()
    _scan(api, headers, PHISHING_URL)
    _scan(api, headers, PHISHING_URL_2)
    reports = _all_reports(db_session_factory)
    assert len(reports) == 2
    assert {r.domain for r in reports} == {"paypa1-securite.top"}


# --- Anonymat ---


def test_signalement_anonyme(api, auth_headers, db_session_factory):
    headers = auth_headers()
    _scan(api, headers, PHISHING_URL, lat=LYON[0], lon=LYON[1])
    reports = _all_reports(db_session_factory)
    assert len(reports) == 1
    report = reports[0]

    point = to_shape(report.area)
    assert point.y == approx(45.76)
    assert point.x == approx(4.84)

    assert not hasattr(CommunityReport, "user_id")
    assert not hasattr(CommunityReport, "scan_id")

    with db_session_factory() as session:
        user_id = session.execute(text("SELECT id FROM users LIMIT 1")).scalar_one()
    assert str(user_id) not in report.reporter_hash


def test_scan_sans_position_area_none(api, auth_headers, db_session_factory):
    headers = auth_headers()
    _scan(api, headers, PHISHING_URL)
    report = _all_reports(db_session_factory)[0]
    assert report.area is None


# --- Suppression en cascade ---


def test_suppression_du_scan_retire_le_signalement(api, auth_headers, db_session_factory):
    headers = auth_headers()
    scan = _scan(api, headers, PHISHING_URL)
    assert len(_all_reports(db_session_factory)) == 1
    assert api.delete(f"/scans/{scan['id']}", headers=headers).status_code == 204
    assert _all_reports(db_session_factory) == []


def test_suppression_un_scan_garde_puis_retire_le_signalement(api, auth_headers, db_session_factory):
    headers = auth_headers()
    first = _scan(api, headers, PHISHING_URL)
    second = _scan(api, headers, PHISHING_URL)
    assert len(_all_reports(db_session_factory)) == 1
    # le signalement reste rattaché au premier scan : supprimer l'autre le conserve
    assert api.delete(f"/scans/{second['id']}", headers=headers).status_code == 204
    assert len(_all_reports(db_session_factory)) == 1
    assert api.delete(f"/scans/{first['id']}", headers=headers).status_code == 204
    assert _all_reports(db_session_factory) == []


def test_suppression_conserve_les_signalements_des_autres(api, auth_headers, db_session_factory):
    alice = auth_headers("alice@test.fr")
    bob = auth_headers("bob@test.fr")
    alice_scan = _scan(api, alice, PHISHING_URL)
    _scan(api, bob, PHISHING_URL)
    assert len(_all_reports(db_session_factory)) == 2
    assert api.delete(f"/scans/{alice_scan['id']}", headers=alice).status_code == 204
    remaining = _all_reports(db_session_factory)
    assert len(remaining) == 1


# --- Signalement par un utilisateur ---


def test_report_sans_token_401(api, auth_headers):
    headers = auth_headers()
    scan = _scan(api, headers, SAFE_URL)
    assert api.post(f"/scans/{scan['id']}/report").status_code == 401


def test_report_scan_dun_autre_404(api, auth_headers):
    alice = auth_headers("alice@test.fr")
    bob = auth_headers("bob@test.fr")
    scan = _scan(api, alice, SAFE_URL)
    assert api.post(f"/scans/{scan['id']}/report", headers=bob).status_code == 404


def test_report_scan_wifi_422(api, auth_headers):
    headers = auth_headers()
    scan = _scan(api, headers, WIFI_CONTENT)
    assert api.post(f"/scans/{scan['id']}/report", headers=headers).status_code == 422


def test_report_scan_safe_cree_signalement_utilisateur(api, auth_headers, db_session_factory):
    headers = auth_headers()
    scan = _scan(api, headers, SAFE_URL)
    assert _all_reports(db_session_factory) == []

    assert api.post(f"/scans/{scan['id']}/report", headers=headers).status_code == 204
    reports = _all_reports(db_session_factory)
    assert len(reports) == 1
    assert reports[0].source == ReportSource.USER
    assert reports[0].verdict == Verdict.SUSPICIOUS

    # idempotent : un second signalement ne crée pas de doublon
    assert api.post(f"/scans/{scan['id']}/report", headers=headers).status_code == 204
    assert len(_all_reports(db_session_factory)) == 1


# --- Routes publiques : zones ---


def test_zones_masque_un_signalement_unique(api, auth_headers):
    headers = auth_headers()
    _scan(api, headers, PHISHING_URL, lat=LYON[0], lon=LYON[1])
    r = api.get("/community/zones")
    assert r.status_code == 200
    assert r.json()["zones"] == []


def test_zones_une_seule_personne_reste_masquee_meme_avec_deux_liens(api, auth_headers):
    # Le bug vu en production : deux scans du même compte publiaient sa position
    headers = auth_headers()
    _scan(api, headers, PHISHING_URL, lat=LYON[0], lon=LYON[1])
    _scan(api, headers, PHISHING_URL_2, lat=LYON[0], lon=LYON[1])
    assert api.get("/community/zones").json()["zones"] == []
    assert api.get("/community/stats").json()["zones"] == 0


def test_zones_compte_les_personnes_pas_les_signalements(api, auth_headers):
    alice = auth_headers("alice@test.fr")
    bob = auth_headers("bob@test.fr")
    _scan(api, alice, PHISHING_URL, lat=LYON[0], lon=LYON[1])
    _scan(api, alice, PHISHING_URL_2, lat=LYON[0], lon=LYON[1])
    _scan(api, bob, PHISHING_URL, lat=LYON[0], lon=LYON[1])
    zones = api.get("/community/zones").json()["zones"]
    assert len(zones) == 1
    assert zones[0]["reports"] == 3


def test_zones_ignore_les_anciens_signalements_sans_empreinte(api, auth_headers, db_session_factory):
    headers = auth_headers("alice@test.fr")
    other = auth_headers("bob@test.fr")
    _scan(api, headers, PHISHING_URL, lat=LYON[0], lon=LYON[1])
    _scan(api, other, PHISHING_URL, lat=LYON[0], lon=LYON[1])
    with db_session_factory() as session:
        for report in session.scalars(select(CommunityReport)):
            report.zone_reporter_hash = None
        session.commit()
    assert api.get("/community/zones").json()["zones"] == []


def test_zones_deux_personnes_meme_maille(api, auth_headers):
    alice = auth_headers("alice@test.fr")
    bob = auth_headers("bob@test.fr")
    _scan(api, alice, PHISHING_URL, lat=LYON[0], lon=LYON[1])
    _scan(api, bob, PHISHING_URL, lat=LYON[0], lon=LYON[1])
    zones = api.get("/community/zones").json()["zones"]
    assert len(zones) == 1
    assert zones[0]["reports"] == 2
    assert zones[0]["latitude"] == approx(45.76)


def test_zones_triees_par_reports(api, auth_headers):
    users = [auth_headers(f"u{i}@test.fr") for i in range(5)]
    for headers in users[:3]:
        _scan(api, headers, PHISHING_URL, lat=LYON[0], lon=LYON[1])
    for headers in users[3:]:
        _scan(api, headers, PHISHING_URL, lat=PARIS[0], lon=PARIS[1])

    body = api.get("/community/zones").json()
    assert body["period_days"] == 90
    zones = body["zones"]
    assert len(zones) == 2
    assert zones[0]["reports"] == 3
    assert zones[0]["latitude"] == approx(45.76)
    assert zones[1]["reports"] == 2
    assert zones[1]["latitude"] == approx(48.86)


def test_reponses_publiques_sans_donnees_identifiantes(api, auth_headers):
    alice = auth_headers("alice@test.fr")
    bob = auth_headers("bob@test.fr")
    _scan(api, alice, PHISHING_URL, lat=LYON[0], lon=LYON[1])
    _scan(api, bob, PHISHING_URL, lat=LYON[0], lon=LYON[1])
    for path in ("/community/zones", "/community/stats"):
        r = api.get(path)
        assert r.status_code == 200
        for forbidden in ("user_id", "reporter_hash", "email", "zone_reporter_hash", "domain_reporter_hash"):
            assert forbidden not in r.text


def test_signalement_ancien_non_compte(api, auth_headers, db_session_factory):
    alice = auth_headers("alice@test.fr")
    bob = auth_headers("bob@test.fr")
    _scan(api, alice, PHISHING_URL, lat=LYON[0], lon=LYON[1])
    _scan(api, bob, PHISHING_URL, lat=LYON[0], lon=LYON[1])
    assert len(api.get("/community/zones").json()["zones"]) == 1

    # vieillit un signalement au-delà de la fenêtre de 90 jours
    with db_session_factory() as session:
        report = session.scalars(select(CommunityReport)).first()
        report.reported_on = date.today() - timedelta(days=95)
        session.commit()

    assert api.get("/community/zones").json()["zones"] == []
    assert api.get("/community/stats").json()["total_reports"] == 1


# --- Routes publiques : stats ---


def test_stats_agrege_les_signalements(api, auth_headers):
    alice = auth_headers("alice@test.fr")
    bob = auth_headers("bob@test.fr")
    _scan(api, alice, PHISHING_URL, lat=LYON[0], lon=LYON[1])
    _scan(api, bob, PHISHING_URL, lat=LYON[0], lon=LYON[1])

    body = api.get("/community/stats").json()
    assert body["total_reports"] == 2
    assert body["dangerous_reports"] == 0
    assert body["zones"] == 1
    assert {"threat": "phishing", "count": 2} in body["threats"]
    assert body["top_domains"][0] == {"domain": "paypa1-securite.top", "reports": 2}
    assert len(body["weekly"]) >= 1


def test_stats_exclut_le_domaine_vu_une_seule_fois(api, auth_headers):
    alice = auth_headers("alice@test.fr")
    bob = auth_headers("bob@test.fr")
    carol = auth_headers("carol@test.fr")
    _scan(api, alice, PHISHING_URL, lat=LYON[0], lon=LYON[1])
    _scan(api, bob, PHISHING_URL, lat=LYON[0], lon=LYON[1])
    safe_scan = _scan(api, carol, SAFE_URL)
    assert api.post(f"/scans/{safe_scan['id']}/report", headers=carol).status_code == 204

    body = api.get("/community/stats").json()
    assert body["total_reports"] == 3
    assert body["top_domains"] == [{"domain": "paypa1-securite.top", "reports": 2}]


def test_stats_masque_le_domaine_dune_seule_personne(api, auth_headers):
    headers = auth_headers()
    _scan(api, headers, PHISHING_URL)
    _scan(api, headers, PHISHING_URL_2)
    body = api.get("/community/stats").json()
    assert body["total_reports"] == 2
    assert body["top_domains"] == []


def test_stats_base_vide(api):
    body = api.get("/community/stats").json()
    assert body["total_reports"] == 0
    assert body["zones"] == 0
    assert body["threats"] == []
    assert body["top_domains"] == []


# --- Limitation de débit ---


def test_public_limiter_sixieme_appel_429(api):
    public_limiter.reset()
    for _ in range(60):
        assert api.get("/community/stats").status_code == 200
    assert api.get("/community/stats").status_code == 429


def test_login_limiter_onzieme_tentative_429(api):
    r = api.post(
        "/auth/register",
        json={"email": "brute@test.fr", "password": "motdepasse-solide"},
    )
    assert r.status_code == 201
    for _ in range(10):
        r = api.post("/auth/login", data={"username": "brute@test.fr", "password": "mauvais"})
        assert r.status_code != 429
    r = api.post("/auth/login", data={"username": "brute@test.fr", "password": "mauvais"})
    assert r.status_code == 429
