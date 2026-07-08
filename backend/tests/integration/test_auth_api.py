def test_register_returns_user_without_password(api):
    r = api.post("/auth/register", json={"email": "bob@test.fr", "password": "motdepasse-solide"})
    assert r.status_code == 201
    body = r.json()
    assert body["email"] == "bob@test.fr"
    assert "password" not in body
    assert "password_hash" not in body


def test_register_lowercases_email(api):
    r = api.post(
        "/auth/register", json={"email": "Alice@Test.FR", "password": "motdepasse-solide"}
    )
    assert r.status_code == 201
    assert r.json()["email"] == "alice@test.fr"


def test_register_duplicate_email_conflict(api):
    payload = {"email": "dup@test.fr", "password": "motdepasse-solide"}
    assert api.post("/auth/register", json=payload).status_code == 201
    r = api.post("/auth/register", json=payload)
    assert r.status_code == 409


def test_register_short_password(api):
    r = api.post("/auth/register", json={"email": "court@test.fr", "password": "court"})
    assert r.status_code == 422


def test_register_invalid_email(api):
    r = api.post("/auth/register", json={"email": "pas-un-email", "password": "motdepasse-solide"})
    assert r.status_code == 422


def test_login_returns_bearer_token(api):
    api.post("/auth/register", json={"email": "log@test.fr", "password": "motdepasse-solide"})
    r = api.post("/auth/login", data={"username": "log@test.fr", "password": "motdepasse-solide"})
    assert r.status_code == 200
    body = r.json()
    assert body["access_token"]
    assert body["token_type"] == "bearer"


def test_login_wrong_password(api):
    api.post("/auth/register", json={"email": "wp@test.fr", "password": "motdepasse-solide"})
    r = api.post("/auth/login", data={"username": "wp@test.fr", "password": "mauvais-mot-de-passe"})
    assert r.status_code == 401


def test_login_unknown_email_same_detail(api):
    api.post("/auth/register", json={"email": "connu@test.fr", "password": "motdepasse-solide"})
    r_known = api.post("/auth/login", data={"username": "connu@test.fr", "password": "mauvais"})
    r_unknown = api.post(
        "/auth/login", data={"username": "inconnu@test.fr", "password": "mauvais"}
    )
    assert r_known.status_code == 401
    assert r_unknown.status_code == 401
    # Ne pas révéler quels comptes existent
    assert r_known.json()["detail"] == r_unknown.json()["detail"]


def test_me_requires_token(api):
    assert api.get("/auth/me").status_code == 401


def test_me_returns_current_user(api, auth_headers):
    r = api.get("/auth/me", headers=auth_headers(email="me@test.fr"))
    assert r.status_code == 200
    assert r.json()["email"] == "me@test.fr"


def test_me_invalid_token(api):
    r = api.get("/auth/me", headers={"Authorization": "Bearer token-bidon"})
    assert r.status_code == 401
