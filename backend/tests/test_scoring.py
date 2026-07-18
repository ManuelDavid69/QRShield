"""Tests du calcul de score et du verdict."""

import itertools

import pytest

from app.models.enums import Verdict
from app.services.analysis.signals import Severity, Signal
from app.services.scoring import compute_score, deduplicate

_counter = itertools.count()


def sig(severity: Severity) -> Signal:
    # Code unique : on veut tester l'addition des poids, pas la déduplication
    return Signal(code=f"test_{next(_counter)}", severity=severity, message="x")


def test_liste_vide() -> None:
    assert compute_score([]) == (0, Verdict.SAFE)


@pytest.mark.parametrize(
    ("severities", "expected"),
    [
        ([Severity.LOW], (10, Verdict.SAFE)),
        ([Severity.MEDIUM], (25, Verdict.SAFE)),
        ([Severity.HIGH], (45, Verdict.SUSPICIOUS)),
        ([Severity.HIGH, Severity.HIGH], (90, Verdict.DANGEROUS)),
        ([Severity.HIGH, Severity.MEDIUM], (70, Verdict.DANGEROUS)),
        # Seuils : 30 = suspect, 60 = dangereux
        ([Severity.LOW, Severity.LOW], (20, Verdict.SAFE)),
        ([Severity.LOW, Severity.MEDIUM], (35, Verdict.SUSPICIOUS)),
        ([Severity.MEDIUM, Severity.MEDIUM], (50, Verdict.SUSPICIOUS)),
        ([Severity.MEDIUM, Severity.MEDIUM, Severity.LOW], (60, Verdict.DANGEROUS)),
        ([Severity.INFO], (0, Verdict.SAFE)),
    ],
)
def test_score_et_verdict(severities: list[Severity], expected: tuple[int, Verdict]) -> None:
    assert compute_score([sig(s) for s in severities]) == expected


def test_critical_suffit_a_lui_seul() -> None:
    score, verdict = compute_score([sig(Severity.CRITICAL)])
    assert score >= 90
    assert verdict is Verdict.DANGEROUS


def test_score_plafonne_a_100() -> None:
    score, verdict = compute_score([sig(Severity.HIGH) for _ in range(5)])
    assert score == 100
    assert verdict is Verdict.DANGEROUS


def test_deduplicate_garde_la_plus_grave() -> None:
    low = Signal(code="meme_code", severity=Severity.LOW, message="bas")
    high = Signal(code="meme_code", severity=Severity.HIGH, message="haut")

    result = deduplicate([low, high])

    assert len(result) == 1
    assert result[0] is high


def test_deduplicate_trie_du_plus_grave_au_moins_grave() -> None:
    signals = [sig(Severity.LOW), sig(Severity.CRITICAL), sig(Severity.HIGH), sig(Severity.MEDIUM)]

    result = deduplicate(signals)

    assert [s.severity for s in result] == [
        Severity.CRITICAL,
        Severity.HIGH,
        Severity.MEDIUM,
        Severity.LOW,
    ]


def test_info_ne_compte_pas() -> None:
    assert compute_score([sig(Severity.INFO)]) == (0, Verdict.SAFE)
