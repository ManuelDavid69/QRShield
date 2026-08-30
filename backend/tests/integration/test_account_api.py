from sqlalchemy import func, select

from app.models import CommunityReport, Notification, RefreshToken, Scan, UrlAnalysis, User

EMAIL = "alice@test.fr"
PASSWORD = "motdepasse-solide"
NEW_PASSWORD = "nouveau-motdepasse"
PHISHING_URL = "https://paypa1-securite.top/login"
LYON = {"latitude": 45.764, "longitude": 4.836}


def _register(api, email=EMAIL):
    r = api.post("/auth/register", json={"email": email, "password": PASSWORD})
    assert r.status_code == 201, r.text
    return r.json()


def _login(api, email=EMAIL, password=PASSWORD):
    return api.post("/auth/login", data={"username": email, "password": password})


def _count(db_session_factory, model):
    with db_session_factory() as session:
        return session.scalar(select(func.count()).select_from(model))


def _reset(api, code, email=EMAIL, password=NEW_PASSWORD):
    return api.post(
        "/auth/reset-password",
        json={"email": email, "recovery_code": code, "new_password": password},
    )


# --- Code de secours ---


def test_inscription_donne_un_code_stocke_hache(api, db_session_factory):
    body = _register(api)
    assert len(body["recovery_code"]) == 19
    assert body["has_recovery_code"] is True
    with db_session_factory() as session:
        user = session.scalar(select(User))
        assert user.recovery_code_hash.startswith("$argon2id$")
        assert body["recovery_code"] not in user.recovery_code_hash


def test_me_ne_renvoie_jamais_le_code(api):
    code = _register(api)["recovery_code"]
    token = _login(api).json()["access_token"]
    r = api.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.json()["has_recovery_code"] is True
    assert "recovery_code\"" not in r.text.replace("has_recovery_code", "")
    assert code not in r.text


def test_reinitialisation_change_le_mot_de_passe(api):
    code = _register(api)["recovery_code"]
    r = _reset(api, code)
    assert r.status_code == 200, r.text
    assert _login(api).status_code == 401
    assert _login(api, password=NEW_PASSWORD).status_code == 200


def test_code_accepte_sans_tirets_et_en_minuscules(api):
    code = _register(api)["recovery_code"]
    assert _reset(api, code.replace("-", " ").lower()).status_code == 200


def test_code_a_usage_unique_et_remplace(api):
    code = _register(api)["recovery_code"]
    new_code = _reset(api, code).json()["recovery_code"]
    assert new_code != code
    assert _reset(api, code, password="encore-un-autre-mdp").status_code == 400
    assert _reset(api, new_code, password="encore-un-autre-mdp").status_code == 200


def test_reinitialisation_coupe_les_sessions(api):
    code = _register(api)["recovery_code"]
    refresh = _login(api).json()["refresh_token"]
    assert _reset(api, code).status_code == 200
    assert api.post("/auth/refresh", json={"refresh_token": refresh}).status_code == 401


def test_mauvais_code_et_compte_inconnu_meme_reponse(api):
    _register(api)
    wrong = _reset(api, "AAAA-BBBB-CCCC-DDDD")
    unknown = _reset(api, "AAAA-BBBB-CCCC-DDDD", email="personne@test.fr")
    assert wrong.status_code == unknown.status_code == 400
    assert wrong.json() == unknown.json()
    assert _login(api).status_code == 200


def test_compte_sans_code_ne_se_reinitialise_pas(api, db_session_factory):
    _register(api)
    with db_session_factory() as session:
        session.scalar(select(User)).recovery_code_hash = None
        session.commit()
    assert _reset(api, "").status_code == 422
    assert _reset(api, "AAAA-BBBB-CCCC-DDDD").status_code == 400


def test_reinitialisation_limitee_en_debit(api):
    _register(api)
    for _ in range(10):
        assert _reset(api, "AAAA-BBBB-CCCC-DDDD").status_code == 400
    assert _reset(api, "AAAA-BBBB-CCCC-DDDD").status_code == 429


def test_nouveau_code_exige_le_mot_de_passe(api, auth_headers):
    headers = auth_headers()
    assert api.post("/auth/recovery-code", json={"password": "faux"}, headers=headers).status_code == 403
    assert api.post("/auth/recovery-code", json={"password": PASSWORD}).status_code == 401


def test_nouveau_code_annule_l_ancien(api):
    old = _register(api)["recovery_code"]
    token = _login(api).json()["access_token"]
    r = api.post(
        "/auth/recovery-code",
        json={"password": PASSWORD},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 200
    assert _reset(api, old).status_code == 400
    assert _reset(api, r.json()["recovery_code"]).status_code == 200


# --- Suppression de compte ---


def test_suppression_exige_le_mot_de_passe(api, auth_headers, db_session_factory):
    headers = auth_headers()
    r = api.post("/auth/delete-account", json={"password": "faux"}, headers=headers)
    assert r.status_code == 403
    assert api.post("/auth/delete-account", json={"password": PASSWORD}).status_code == 401
    assert _count(db_session_factory, User) == 1


def test_suppression_efface_tout_ce_qui_concerne_la_personne(api, auth_headers, db_session_factory):
    headers = auth_headers()
    payload = {"content": PHISHING_URL, **LYON}
    assert api.post("/scans", json=payload, headers=headers).status_code == 201
    assert _count(db_session_factory, CommunityReport) == 1

    assert api.post("/auth/delete-account", json={"password": PASSWORD}, headers=headers).status_code == 204

    for model in (User, Scan, CommunityReport, RefreshToken, Notification, UrlAnalysis):
        assert _count(db_session_factory, model) == 0, model.__name__
    assert _login(api).status_code == 401
    assert api.get("/auth/me", headers=headers).status_code == 401


def test_suppression_conserve_les_donnees_des_autres(api, auth_headers, db_session_factory):
    alice = auth_headers("alice@test.fr")
    bob = auth_headers("bob@test.fr")
    api.post("/scans", json={"content": PHISHING_URL, **LYON}, headers=alice)
    api.post("/scans", json={"content": PHISHING_URL, **LYON}, headers=bob)
    assert _count(db_session_factory, CommunityReport) == 2

    assert api.post("/auth/delete-account", json={"password": PASSWORD}, headers=alice).status_code == 204

    assert _count(db_session_factory, User) == 1
    assert _count(db_session_factory, Scan) == 1
    assert _count(db_session_factory, CommunityReport) == 1
    assert _count(db_session_factory, UrlAnalysis) == 1
    assert api.get("/scans", headers=bob).json()["total"] == 1
