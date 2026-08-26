from datetime import UTC, datetime, timedelta

from sqlalchemy import select, update

from app.models import RefreshToken

EMAIL = "session@test.fr"
PASSWORD = "motdepasse-solide"


def _login(api):
    api.post("/auth/register", json={"email": EMAIL, "password": PASSWORD})
    response = api.post("/auth/login", data={"username": EMAIL, "password": PASSWORD})
    assert response.status_code == 200
    return response.json()


def _refresh(api, token):
    return api.post("/auth/refresh", json={"refresh_token": token})


def test_renouvellement_donne_une_nouvelle_paire_valide(api):
    first = _login(api)
    response = _refresh(api, first["refresh_token"])
    assert response.status_code == 200
    second = response.json()
    assert second["refresh_token"] != first["refresh_token"]
    me = api.get("/auth/me", headers={"Authorization": f"Bearer {second['access_token']}"})
    assert me.json()["email"] == EMAIL


def test_le_jeton_n_est_jamais_stocke_en_clair(api, db_session_factory):
    tokens = _login(api)
    with db_session_factory() as db:
        stored = db.scalars(select(RefreshToken.token_hash)).all()
    assert len(stored) == 1
    assert stored[0] != tokens["refresh_token"]
    assert len(stored[0]) == 64


def test_reutiliser_un_ancien_jeton_coupe_toute_la_session(api):
    first = _login(api)
    second = _refresh(api, first["refresh_token"]).json()

    # Le voleur rejoue l'ancien jeton : il est refusé...
    assert _refresh(api, first["refresh_token"]).status_code == 401
    # ...et le jeton le plus récent ne fonctionne plus non plus
    assert _refresh(api, second["refresh_token"]).status_code == 401


def test_les_autres_sessions_ne_sont_pas_touchees(api):
    phone = _login(api)
    other = api.post("/auth/login", data={"username": EMAIL, "password": PASSWORD}).json()

    _refresh(api, phone["refresh_token"])
    assert _refresh(api, phone["refresh_token"]).status_code == 401
    assert _refresh(api, other["refresh_token"]).status_code == 200


def test_jeton_expire_refuse(api, db_session_factory):
    tokens = _login(api)
    with db_session_factory() as db:
        db.execute(update(RefreshToken).values(expires_at=datetime.now(UTC) - timedelta(minutes=1)))
        db.commit()
    assert _refresh(api, tokens["refresh_token"]).status_code == 401


def test_jeton_inconnu_refuse(api):
    assert _refresh(api, "x" * 43).status_code == 401
    assert _refresh(api, "court").status_code == 422


def test_deconnexion_revoque_la_session(api):
    tokens = _login(api)
    response = api.post("/auth/logout", json={"refresh_token": tokens["refresh_token"]})
    assert response.status_code == 204
    assert _refresh(api, tokens["refresh_token"]).status_code == 401


def test_deconnexion_ne_revele_pas_si_un_jeton_existe(api):
    assert api.post("/auth/logout", json={"refresh_token": "y" * 43}).status_code == 204


def test_un_refresh_token_n_est_pas_un_jeton_d_acces(api):
    tokens = _login(api)
    headers = {"Authorization": f"Bearer {tokens['refresh_token']}"}
    assert api.get("/auth/me", headers=headers).status_code == 401


def test_compte_desactive(api, db_session_factory):
    from app.models import User

    tokens = _login(api)
    with db_session_factory() as db:
        db.execute(update(User).values(is_active=False))
        db.commit()
    assert _refresh(api, tokens["refresh_token"]).status_code == 401


def test_nettoyage_des_jetons_expires(api, db_session_factory):
    from app.security.refresh_tokens import purge_expired_tokens

    _login(api)
    with db_session_factory() as db:
        db.execute(update(RefreshToken).values(expires_at=datetime.now(UTC) - timedelta(days=1)))
        db.commit()
        assert purge_expired_tokens(db) == 1
        assert db.scalars(select(RefreshToken)).all() == []
