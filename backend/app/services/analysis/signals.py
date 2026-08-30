from dataclasses import dataclass, field
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
    # Valeurs du message, pour que l'appli puisse le traduire à partir de son code
    params: dict[str, str] = field(default_factory=dict, compare=False, hash=False)

    def to_dict(self) -> dict[str, str | dict[str, str]]:
        return {"code": self.code, "severity": self.severity.value, "message": self.message, "params": self.params}
