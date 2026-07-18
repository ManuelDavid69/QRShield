"""Transforme la liste d'indices en score de risque (0 = aucun indice, 100 = très dangereux).

Chaque indice a un poids selon sa gravité et les poids s'additionnent. Un seul indice
de gravité "high" suffit à rendre le lien suspect, deux indices "high" le rendent
dangereux. Un indice "critical" (lien signalé par Google Safe Browsing ou par
plusieurs antivirus de VirusTotal) rend le lien dangereux à lui seul.
"""

from app.models.enums import Verdict
from app.services.analysis.signals import Severity, Signal

WEIGHTS: dict[Severity, int] = {
    Severity.INFO: 0,
    Severity.LOW: 10,
    Severity.MEDIUM: 25,
    Severity.HIGH: 45,
    Severity.CRITICAL: 80,
}

SUSPICIOUS_FROM = 30
DANGEROUS_FROM = 60
CRITICAL_MIN_SCORE = 90

_ORDER = list(Severity)


def deduplicate(signals: list[Signal]) -> list[Signal]:
    # Le même indice peut sortir sur l'URL de départ et sur l'URL finale : on ne le compte qu'une fois
    best: dict[str, Signal] = {}
    for signal in signals:
        current = best.get(signal.code)
        if current is None or _ORDER.index(signal.severity) > _ORDER.index(current.severity):
            best[signal.code] = signal
    return sorted(best.values(), key=lambda s: _ORDER.index(s.severity), reverse=True)


def compute_score(signals: list[Signal]) -> tuple[int, Verdict]:
    unique = deduplicate(signals)
    score = min(100, sum(WEIGHTS[s.severity] for s in unique))
    if any(s.severity is Severity.CRITICAL for s in unique):
        score = max(score, CRITICAL_MIN_SCORE)

    if score >= DANGEROUS_FROM:
        verdict = Verdict.DANGEROUS
    elif score >= SUSPICIOUS_FROM:
        verdict = Verdict.SUSPICIOUS
    else:
        verdict = Verdict.SAFE
    return score, verdict
