from datetime import UTC, datetime

import httpx

from app.services.analysis.reputation import ReputationError

_RDAP_URL = "https://rdap.org/domain/{domain}"


def _default_client() -> httpx.Client:
    return httpx.Client(timeout=httpx.Timeout(6.0, connect=3.0), trust_env=False)


def _parse_iso(value: str) -> datetime:
    # fromisoformat n'accepte pas le suffixe "Z" de manière uniforme.
    if value.endswith("Z") or value.endswith("z"):
        value = value[:-1] + "+00:00"
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC)


class RdapClient:
    def __init__(self, http: httpx.Client | None = None) -> None:
        self._http = http or _default_client()
        self._owns_client = http is None

    def close(self) -> None:
        if self._owns_client:
            self._http.close()

    def registration_date(self, domain: str) -> datetime | None:
        try:
            response = self._http.get(
                _RDAP_URL.format(domain=domain),
                headers={"Accept": "application/rdap+json"},
                follow_redirects=True,
            )
        except httpx.HTTPError as exc:
            raise ReputationError("RDAP: requête échouée") from exc

        if response.status_code == 404:
            return None
        if response.status_code != 200:
            raise ReputationError(f"RDAP a répondu {response.status_code}")

        try:
            data = response.json()
        except ValueError as exc:
            raise ReputationError("RDAP: JSON invalide") from exc

        events = data.get("events") if isinstance(data, dict) else None
        if not isinstance(events, list):
            return None

        for event in events:
            if not isinstance(event, dict):
                continue
            if event.get("eventAction") != "registration":
                continue
            action_date = event.get("eventDate")
            if not isinstance(action_date, str):
                continue
            try:
                return _parse_iso(action_date)
            except ValueError:
                continue

        return None


def domain_age_days(registered: datetime, now: datetime | None = None) -> int:
    current = now or datetime.now(UTC)
    return (current - registered).days
