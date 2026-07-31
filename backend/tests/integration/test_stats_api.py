from datetime import date

import pytest


def _scan(api, headers, content, **extra):
    r = api.post("/scans", json={"content": content, **extra}, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


def test_stats_empty(api, auth_headers):
    headers = auth_headers()
    r = api.get("/stats/me", headers=headers)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["total_scans"] == 0
    assert data["flagged_percent"] == 0
    assert data["places"] == []
    assert data["top_domains"] == []
    assert len(data["weekly"]) == 12
    assert all(w["count"] == 0 for w in data["weekly"])


def test_stats_requires_auth(api):
    assert api.get("/stats/me").status_code == 401


def test_stats_weeks_validation(api, auth_headers):
    headers = auth_headers()
    assert api.get("/stats/me", params={"weeks": 3}, headers=headers).status_code == 422
    assert api.get("/stats/me", params={"weeks": 53}, headers=headers).status_code == 422
    r = api.get("/stats/me", params={"weeks": 4}, headers=headers)
    assert r.status_code == 200
    assert len(r.json()["weekly"]) == 4


def test_stats_after_scans(api, auth_headers):
    headers = auth_headers()
    _scan(api, headers, "https://paypa1-securite.top/login")
    _scan(api, headers, "https://www.wikipedia.org/")
    _scan(api, headers, "WIFI:T:WPA;S:Box;P:x;;")

    data = api.get("/stats/me", headers=headers).json()
    assert data["total_scans"] == 3
    assert data["flagged_scans"] == 1
    assert data["flagged_percent"] == 33.3
    # Un QR WiFi non-URL n'a pas d'analyse de verdict : seuls les deux URL comptent
    assert {"verdict": "suspicious", "count": 1} in data["verdicts"]
    assert {"verdict": "safe", "count": 1} in data["verdicts"]
    assert {"category": "wifi", "count": 1} in data["categories"]
    assert sum(c["count"] for c in data["categories"]) == 3


def test_weekly(api, auth_headers):
    headers = auth_headers()
    _scan(api, headers, "https://paypa1-securite.top/login")
    _scan(api, headers, "https://www.wikipedia.org/")
    _scan(api, headers, "WIFI:T:WPA;S:Box;P:x;;")

    weekly = api.get("/stats/me", headers=headers).json()["weekly"]
    assert weekly[-1]["count"] == 3

    days = [date.fromisoformat(w["week_start"]) for w in weekly]
    assert all(d.weekday() == 0 for d in days)  # toutes des lundis
    assert days == sorted(days)
    assert all((b - a).days == 7 for a, b in zip(days, days[1:]))


def test_top_domains(api, auth_headers):
    headers = auth_headers()
    _scan(api, headers, "https://www.wikipedia.org/")
    _scan(api, headers, "https://www.wikipedia.org/")
    _scan(api, headers, "https://exemple.fr/")

    data = api.get("/stats/me", headers=headers).json()
    assert data["top_domains"][0] == {"domain": "wikipedia.org", "count": 2}


def test_places(api, auth_headers):
    headers = auth_headers()
    # Deux points à ~50 m dans Lyon, un à Paris
    _scan(api, headers, "https://www.wikipedia.org/", latitude=45.7640, longitude=4.8357)
    _scan(api, headers, "https://www.wikipedia.org/", latitude=45.7643, longitude=4.8359)
    _scan(api, headers, "https://www.wikipedia.org/", latitude=48.8566, longitude=2.3522)

    data = api.get("/stats/me", headers=headers).json()
    assert len(data["places"]) == 2
    assert data["places"][0]["count"] == 2
    assert data["places"][0]["latitude"] == pytest.approx(45.764, abs=0.001)


def test_isolation(api, auth_headers):
    alice = auth_headers(email="alice@test.fr")
    _scan(api, alice, "https://www.wikipedia.org/")

    bob = auth_headers(email="bob@test.fr")
    data = api.get("/stats/me", headers=bob).json()
    assert data["total_scans"] == 0
    assert data["places"] == []


def test_history_verdict_filter(api, auth_headers):
    headers = auth_headers()
    _scan(api, headers, "https://paypa1-securite.top/login")
    _scan(api, headers, "https://www.wikipedia.org/")

    r = api.get("/scans", params={"verdict": "suspicious"}, headers=headers)
    assert r.status_code == 200
    data = r.json()
    assert data["total"] == 1
    assert data["items"][0]["verdict"] == "suspicious"

    r = api.get("/scans", params={"verdict": "dangerous"}, headers=headers)
    assert r.json()["total"] == 0

    r = api.get("/scans", params={"verdict": "nimportequoi"}, headers=headers)
    assert r.status_code == 422


def test_scan_category(api, auth_headers):
    headers = auth_headers()
    scan = _scan(api, headers, "https://chez-paul.fr/menu")
    assert scan["category"] == "menu"
