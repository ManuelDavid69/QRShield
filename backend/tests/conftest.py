import os
from pathlib import Path


def _load_dotenv(path: Path) -> None:
    # Lecture minimale du .env pour que les tests d'intégration trouvent la vraie base
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip())


# La config est obligatoire, elle doit être prête avant d'importer l'app
_load_dotenv(Path(__file__).resolve().parents[2] / ".env")
os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://test:test@localhost:5432/test")
os.environ.setdefault("JWT_SECRET_KEY", "cle-de-test-uniquement-pour-pytest-0123456789")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
