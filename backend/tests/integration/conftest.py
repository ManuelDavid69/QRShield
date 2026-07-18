import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import sessionmaker

from app.config import get_settings
from app.database import Base, get_db
from app.main import app
from app.services.analysis.safe_fetch import FetchResult, Hop
from app.services.qr_analyzer import UrlAnalyzer, get_url_analyzer
import app.models as _models  # noqa: F401  # enregistre les tables (alias sinon "app" écrase l'appli FastAPI)

TEST_DATABASE = "qrshield_test"


@pytest.fixture(scope="session")
def test_engine():
    base_url = make_url(get_settings().database_url)
    admin_url = base_url.set(database="postgres")
    test_url = base_url.set(database=TEST_DATABASE)

    try:
        admin_engine = create_engine(
            admin_url,
            isolation_level="AUTOCOMMIT",
            connect_args={"connect_timeout": 3},
        )
        with admin_engine.connect() as conn:
            exists = conn.execute(
                text("SELECT 1 FROM pg_database WHERE datname = :name"), {"name": TEST_DATABASE}
            ).scalar()
            if not exists:
                conn.execute(text(f'CREATE DATABASE "{TEST_DATABASE}"'))
        admin_engine.dispose()
    except OperationalError:
        pytest.skip("base PostgreSQL injoignable, lancer docker compose up db")

    engine = create_engine(test_url)
    with engine.begin() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield engine
    engine.dispose()


@pytest.fixture
def db_session_factory(test_engine):
    return sessionmaker(bind=test_engine, autoflush=False)


class OfflineFetcher:
    """Remplace le suivi de redirections : aucune requête réseau pendant les tests."""

    def __init__(self) -> None:
        self.calls: list[str] = []

    def fetch(self, url: str) -> FetchResult:
        self.calls.append(url)
        return FetchResult(chain=[Hop(url=url, status=200)], final_url=url, content_type="text/html")


@pytest.fixture
def offline_fetcher() -> OfflineFetcher:
    return OfflineFetcher()


@pytest.fixture
def api(test_engine, db_session_factory, offline_fetcher):
    def _get_db():
        db = db_session_factory()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = _get_db
    # vrai pipeline d'analyse (heuristiques + scoring), sans services externes
    app.dependency_overrides[get_url_analyzer] = lambda: UrlAnalyzer(fetcher=offline_fetcher)
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()

    # Repart d'une base propre entre deux tests (scans suivent par CASCADE)
    with test_engine.begin() as conn:
        conn.execute(text("TRUNCATE users, url_analyses RESTART IDENTITY CASCADE"))


@pytest.fixture
def auth_headers(api):
    def make(
        email: str = "alice@test.fr", password: str = "motdepasse-solide"
    ) -> dict[str, str]:
        r = api.post("/auth/register", json={"email": email, "password": password})
        assert r.status_code == 201, r.text
        r = api.post("/auth/login", data={"username": email, "password": password})
        assert r.status_code == 200, r.text
        return {"Authorization": f"Bearer {r.json()['access_token']}"}

    return make
