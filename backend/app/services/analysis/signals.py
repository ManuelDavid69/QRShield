from dataclasses import dataclass
from enum import StrEnum


class Severity(StrEnum):
    INFO = "info"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass(frozen=True)
class Signal:
    """Un indice trouvé pendant l'analyse, avec un message lisible par l'utilisateur."""

    code: str
    severity: Severity
    message: str

    def to_dict(self) -> dict[str, str]:
        return {"code": self.code, "severity": self.severity.value, "message": self.message}
