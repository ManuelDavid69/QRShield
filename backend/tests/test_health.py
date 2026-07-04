from sqlalchemy.exc import OperationalError

from app.database import get_db
from app.main import app


class FakeSession:
    def __init__(self, error: Exception | None = None):
        self._error = error

    def execute(self, *args, **kwargs):
        if self._error is not None:
            raise self._error

    def close(self):
        pass


def _override_get_db(session: FakeSession):
    def _get_db():
        try:
            yield session
        finally:
            session.close()

    return _get_db


def test_health_ok(client):
    fake_session = FakeSession()
    app.dependency_overrides[get_db] = _override_get_db(fake_session)

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok"}


def test_health_database_down(client):
    error = OperationalError("SELECT 1", {}, Exception("down"))
    fake_session = FakeSession(error)
    app.dependency_overrides[get_db] = _override_get_db(fake_session)

    response = client.get("/health")

    assert response.status_code == 503
    assert response.json()["database"] == "unreachable"
    assert "down" not in response.text
