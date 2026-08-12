"""Tests unitaires du volet communautaire, sans base de données."""

import uuid
from types import SimpleNamespace

import pytest

from app.models import ReportSource, ThreatType
from app.services.community import reporter_hash, snap_to_grid, threat_from_reasons


@pytest.fixture(autouse=True)
def _secret(monkeypatch):
    # Évite de dépendre de la configuration réelle pour le HMAC
    monkeypatch.setattr(
        "app.services.community.get_settings",
        lambda: SimpleNamespace(community_secret="secret-de-test"),
    )


def test_snap_to_grid_tronque_la_position():
    point = snap_to_grid(45.764, 4.836)
    assert point.data == "POINT(4.84 45.76)"


def test_snap_to_grid_regroupe_les_positions_voisines():
    # Deux positions voisines tombent dans la même maille
    assert snap_to_grid(45.7649, 4.8351).data == snap_to_grid(45.7601, 4.8399).data


def test_reporter_hash_stable_pour_les_memes_entrees():
    user_id, analysis_id = uuid.uuid4(), uuid.uuid4()
    assert reporter_hash(user_id, analysis_id, ReportSource.USER) == reporter_hash(
        user_id, analysis_id, ReportSource.USER
    )


def test_reporter_hash_change_avec_l_analyse():
    user_id = uuid.uuid4()
    first = reporter_hash(user_id, uuid.uuid4(), ReportSource.USER)
    second = reporter_hash(user_id, uuid.uuid4(), ReportSource.USER)
    assert first != second


def test_reporter_hash_change_avec_l_utilisateur():
    analysis_id = uuid.uuid4()
    first = reporter_hash(uuid.uuid4(), analysis_id, ReportSource.USER)
    second = reporter_hash(uuid.uuid4(), analysis_id, ReportSource.USER)
    assert first != second


def test_reporter_hash_change_avec_la_source():
    user_id, analysis_id = uuid.uuid4(), uuid.uuid4()
    assert reporter_hash(user_id, analysis_id, ReportSource.USER) != reporter_hash(
        user_id, analysis_id, ReportSource.AUTOMATIC
    )


def test_reporter_hash_ne_divulgue_pas_l_utilisateur():
    user_id, analysis_id = uuid.uuid4(), uuid.uuid4()
    digest = reporter_hash(user_id, analysis_id, ReportSource.USER)
    assert len(digest) == 64
    assert str(user_id) not in digest
    assert user_id.hex not in digest


@pytest.mark.parametrize(
    ("reasons", "expected"),
    [
        ([{"code": "dangerous_download"}], ThreatType.MALWARE),
        ([{"code": "brand_lookalike"}], ThreatType.PHISHING),
        ([{"code": "safe_browsing"}, {"code": "dangerous_download"}], ThreatType.MALWARE),
        ([{"code": "new_domain"}], ThreatType.OTHER),
        ([], ThreatType.OTHER),
    ],
)
def test_threat_from_reasons(reasons, expected):
    assert threat_from_reasons(reasons) is expected
