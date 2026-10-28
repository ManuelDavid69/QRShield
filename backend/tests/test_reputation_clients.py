import base64
import json
from collections.abc import Callable
from datetime import UTC, datetime

import httpx
import pytest

from app.services.analysis.domain_age import RdapClient, domain_age_days
from app.services.analysis.reputation import (
    ReputationError,
    SafeBrowsingClient,
    VirusTotalClient,
    VirusTotalStats,
    virustotal_url_id,
)

Handler = Callable[[httpx.Request], httpx.Response]


def _client(handler: Handler) -> httpx.Client:
    return httpx.Client(transport=httpx.MockTransport(handler))


# --- Safe Browsing ---------------------------------------------------------

def test_safe_browsing_key_in_header_not_in_url() -> None:
    seen: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["key"] = request.headers.get("x-goog-api-key")
        seen["url"] = str(request.url)
        seen["body"] = json.loads(request.content)
        return httpx.Response(200, json={})

    client = SafeBrowsingClient("SECRETKEY", http=_client(handler))
    assert client.check(["https://a.fr/x", "https://b.fr/y"]) == []
    assert seen["key"] == "SECRETKEY"
    assert "SECRETKEY" not in str(seen["url"])
    body = seen["body"]
    assert isinstance(body, dict)
    entries = body["threatInfo"]["threatEntries"]
    assert [e["url"] for e in entries] == ["https://a.fr/x", "https://b.fr/y"]


def test_safe_browsing_dedup_and_sort() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "matches": [
                    {"threatType": "MALWARE", "threat": {"url": "a"}},
                    {"threatType": "MALWARE", "threat": {"url": "b"}},
                    {"threatType": "SOCIAL_ENGINEERING", "threat": {"url": "c"}},
                ]
            },
        )

    client = SafeBrowsingClient("k", http=_client(handler))
    assert client.check(["a"]) == ["MALWARE", "SOCIAL_ENGINEERING"]


def test_safe_browsing_bad_status_hides_key() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(400, text="bad")

    client = SafeBrowsingClient("SECRETKEY", http=_client(handler))
    with pytest.raises(ReputationError) as exc:
        client.check(["https://a.fr"])
    assert "SECRETKEY" not in str(exc.value)


def test_safe_browsing_empty_list_no_call() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise AssertionError("le client ne doit pas être appelé")

    client = SafeBrowsingClient("k", http=_client(handler))
    assert client.check([]) == []


# --- VirusTotal ------------------------------------------------------------

def test_virustotal_url_id_roundtrip() -> None:
    url = "https://exemple.fr/a?b=1"
    url_id = virustotal_url_id(url)
    assert "=" not in url_id
    padded = url_id + "=" * (-len(url_id) % 4)
    assert base64.urlsafe_b64decode(padded).decode("utf-8") == url


def test_virustotal_header_and_stats() -> None:
    seen: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["apikey"] = request.headers.get("x-apikey")
        return httpx.Response(
            200,
            json={
                "data": {
                    "attributes": {
                        "last_analysis_stats": {
                            "malicious": 3,
                            "suspicious": 1,
                            "harmless": 10,
                            "undetected": 5,
                        }
                    }
                }
            },
        )

    client = VirusTotalClient("APIKEY", http=_client(handler))
    stats = client.lookup("https://a.fr")
    assert seen["apikey"] == "APIKEY"
    assert stats == VirusTotalStats(
        malicious=3, suspicious=1, harmless=10, undetected=5
    )


def test_virustotal_404_none() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(404, json={"error": {}})

    client = VirusTotalClient("k", http=_client(handler))
    assert client.lookup("https://x.fr") is None


def test_virustotal_429_quota() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(429, json={})

    client = VirusTotalClient("k", http=_client(handler))
    with pytest.raises(ReputationError):
        client.lookup("https://x.fr")


def test_virustotal_always_get() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.method == "GET"
        return httpx.Response(
            200,
            json={"data": {"attributes": {"last_analysis_stats": {}}}},
        )

    client = VirusTotalClient("k", http=_client(handler))
    client.lookup("https://x.fr")


# --- RDAP ------------------------------------------------------------------

def test_rdap_registration_date() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers.get("Accept") == "application/rdap+json"
        return httpx.Response(
            200,
            json={
                "events": [
                    {"eventAction": "last changed", "eventDate": "2024-04-01T00:00:00Z"},
                    {"eventAction": "registration", "eventDate": "2024-03-01T10:00:00Z"},
                ]
            },
        )

    client = RdapClient(http=_client(handler))
    assert client.registration_date("exemple.fr") == datetime(
        2024, 3, 1, 10, 0, tzinfo=UTC
    )


def test_rdap_404_none() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(404, json={})

    client = RdapClient(http=_client(handler))
    assert client.registration_date("ex.fr") is None


def test_rdap_500_error() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500)

    client = RdapClient(http=_client(handler))
    with pytest.raises(ReputationError):
        client.registration_date("ex.fr")


def test_domain_age_days() -> None:
    registered = datetime(2024, 1, 1, tzinfo=UTC)
    now = datetime(2024, 1, 31, tzinfo=UTC)
    assert domain_age_days(registered, now=now) == 30
