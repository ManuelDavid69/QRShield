import pytest
from sqlalchemy import func, select

from app.models import Scan, UrlAnalysis


def _create(api, headers, content, **extra):
    return api.post("/scans", json={"content": content, **extra}, headers=headers)


def test_create_url_scan(api, auth_headers):
    r = _create(api, auth_headers(), "https://exemple.fr/menu")
    assert r.status_code == 201
    body = r.json()
    assert body["content_type"] == "url"
    assert body["verdict"] == "safe"
    assert body["url"] == "https://exemple.fr/menu"
    assert body["analysis"]["score"] == 0
    assert body["analysis"]["redirect_chain"] == ["https://exemple.fr/menu"]


def test_phishing_url_is_flagged_with_reasons(api, auth_headers):
    r = _create(api, auth_headers(), "https://paypa1-securite.top/login")
    assert r.status_code == 201
    analysis = r.json()["analysis"]
    assert r.json()["verdict"] in ("suspicious", "dangerous")
    codes = {reason["code"] for reason in analysis["reasons"]}
    assert "suspicious_tld" in codes
    assert analysis["domain"] == "paypa1-securite.top"
    assert all(reason["message"] for reason in analysis["reasons"])


def test_analysis_is_reused_for_the_same_url(api, auth_headers, offline_fetcher):
    alice = auth_headers()
    bob = auth_headers(email="bob@test.fr")
    _create(api, alice, "https://menu-resto.fr/carte")
    _create(api, bob, "https://menu-resto.fr/carte")
    # une seule analyse réseau pour deux scans de la même URL (cache de 24 h)
    assert offline_fetcher.calls == ["https://menu-resto.fr/carte"]


def test_same_url_shares_one_analysis(api, auth_headers, db_session_factory):
    alice = auth_headers()
    bob = auth_headers(email="bob@test.fr")
    assert _create(api, alice, "https://partage.fr/page").status_code == 201
    assert _create(api, bob, "https://partage.fr/page").status_code == 201

    with db_session_factory() as db:
        assert db.scalar(select(func.count()).select_from(UrlAnalysis)) == 1


def test_wifi_password_never_stored(api, auth_headers, db_session_factory):
    r = _create(api, auth_headers(), "WIFI:T:WPA;S:MaBox;P:secret123;;")
    assert r.status_code == 201
    body = r.json()
    assert body["content_type"] == "wifi"
    assert "secret123" not in body["content"]

    with db_session_factory() as db:
        assert "secret123" not in db.get(Scan, body["id"]).content


def test_coordinates_roundtrip(api, auth_headers):
    r = _create(api, auth_headers(), "position test", latitude=45.764, longitude=4.8357)
    assert r.status_code == 201
    body = r.json()
    assert body["latitude"] == pytest.approx(45.764, abs=1e-5)
    assert body["longitude"] == pytest.approx(4.8357, abs=1e-5)


def test_latitude_without_longitude_is_rejected(api, auth_headers):
    r = _create(api, auth_headers(), "position test", latitude=45.764)
    assert r.status_code == 422


def test_list_scans_pagination_and_order(api, auth_headers):
    headers = auth_headers()
    for i in range(3):
        assert _create(api, headers, f"contenu {i}").status_code == 201

    body = api.get("/scans", headers=headers).json()
    assert body["total"] == 3

    page = api.get("/scans", params={"limit": 2}, headers=headers).json()
    assert len(page["items"]) == 2
    # Le plus récent en premier
    assert page["items"][0]["content"] == "contenu 2"


def test_scans_are_isolated_between_users(api, auth_headers):
    alice = auth_headers()
    bob = auth_headers(email="bob@test.fr")

    scan_id = _create(api, alice, "https://alice.fr/x").json()["id"]

    assert api.get("/scans", headers=bob).json()["total"] == 0
    assert api.get(f"/scans/{scan_id}", headers=bob).status_code == 404
    assert api.delete(f"/scans/{scan_id}", headers=bob).status_code == 404
    # Le scan est toujours là pour sa propriétaire
    assert api.get(f"/scans/{scan_id}", headers=alice).status_code == 200


def test_delete_own_scan(api, auth_headers):
    headers = auth_headers()
    scan_id = _create(api, headers, "a supprimer").json()["id"]

    assert api.delete(f"/scans/{scan_id}", headers=headers).status_code == 204
    assert api.get(f"/scans/{scan_id}", headers=headers).status_code == 404


def test_scans_routes_require_token(api):
    missing = "00000000-0000-0000-0000-000000000000"
    assert api.post("/scans", json={"content": "test"}).status_code == 401
    assert api.get("/scans").status_code == 401
    assert api.get(f"/scans/{missing}").status_code == 401
    assert api.delete(f"/scans/{missing}").status_code == 401
