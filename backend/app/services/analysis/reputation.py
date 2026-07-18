import base64
from dataclasses import dataclass

import httpx


class ReputationError(Exception):
    """Erreur générique des clients de réputation."""


@dataclass(frozen=True)
class VirusTotalStats:
    malicious: int
    suspicious: int
    harmless: int
    undetected: int


_THREAT_TYPES: list[str] = [
    "MALWARE",
    "SOCIAL_ENGINEERING",
    "UNWANTED_SOFTWARE",
    "POTENTIALLY_HARMFUL_APPLICATION",
]

_SAFE_BROWSING_URL = "https://safebrowsing.googleapis.com/v4/threatMatches:find"
_VIRUSTOTAL_URL = "https://www.virustotal.com/api/v3/urls/{url_id}"


def _default_client() -> httpx.Client:
    return httpx.Client(timeout=httpx.Timeout(6.0, connect=3.0), trust_env=False)


def virustotal_url_id(url: str) -> str:
    """Identifiant VT : base64 urlsafe de l'URL, sans padding `=`."""
    encoded = base64.urlsafe_b64encode(url.encode("utf-8")).decode("ascii")
    return encoded.rstrip("=")


class SafeBrowsingClient:
    def __init__(self, api_key: str, http: httpx.Client | None = None) -> None:
        self._api_key = api_key
        self._http = http or _default_client()
        self._owns_client = http is None

    def close(self) -> None:
        if self._owns_client:
            self._http.close()

    def check(self, urls: list[str]) -> list[str]:
        if not urls:
            return []

        body = {
            "client": {"clientId": "qrshield", "clientVersion": "0.1.0"},
            "threatInfo": {
                "threatTypes": _THREAT_TYPES,
                "platformTypes": ["ANY_PLATFORM"],
                "threatEntryTypes": ["URL"],
                "threatEntries": [{"url": u} for u in urls],
            },
        }

        try:
            # Clé dans un en-tête plutôt que dans l'URL, qui finit souvent dans des logs
            response = self._http.post(
                _SAFE_BROWSING_URL,
                headers={"X-Goog-Api-Key": self._api_key},
                json=body,
            )
        except httpx.HTTPError as exc:
            raise ReputationError("Safe Browsing: requête échouée") from exc

        if response.status_code != 200:
            raise ReputationError(
                f"Safe Browsing a répondu {response.status_code}"
            )

        try:
            data = response.json()
        except ValueError as exc:
            raise ReputationError("Safe Browsing: JSON invalide") from exc

        matches = data.get("matches", []) if isinstance(data, dict) else []
        types = {
            m["threatType"]
            for m in matches
            if isinstance(m, dict) and isinstance(m.get("threatType"), str)
        }
        return sorted(types)


class VirusTotalClient:
    def __init__(self, api_key: str, http: httpx.Client | None = None) -> None:
        self._api_key = api_key
        self._http = http or _default_client()
        self._owns_client = http is None

    def close(self) -> None:
        if self._owns_client:
            self._http.close()

    def lookup(self, url: str) -> VirusTotalStats | None:
        # On ne soumet jamais l'URL (POST /urls) : elle deviendrait publique
        # et pourrait contenir des données personnelles de l'utilisateur.
        url_id = virustotal_url_id(url)

        try:
            response = self._http.get(
                _VIRUSTOTAL_URL.format(url_id=url_id),
                headers={"x-apikey": self._api_key},
            )
        except httpx.HTTPError as exc:
            raise ReputationError("VirusTotal: requête échouée") from exc

        if response.status_code == 404:
            return None
        if response.status_code == 429:
            raise ReputationError("quota VirusTotal dépassé")
        if response.status_code != 200:
            raise ReputationError(
                f"VirusTotal a répondu {response.status_code}"
            )

        try:
            data = response.json()
            stats = data["data"]["attributes"]["last_analysis_stats"]
        except (ValueError, KeyError, TypeError) as exc:
            raise ReputationError("VirusTotal: réponse inattendue") from exc

        if not isinstance(stats, dict):
            raise ReputationError("VirusTotal: réponse inattendue")

        def _count(key: str) -> int:
            value = stats.get(key, 0)
            return value if isinstance(value, int) else 0

        return VirusTotalStats(
            malicious=_count("malicious"),
            suspicious=_count("suspicious"),
            harmless=_count("harmless"),
            undetected=_count("undetected"),
        )
