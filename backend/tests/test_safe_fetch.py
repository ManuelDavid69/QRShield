"""Tests du client HTTP qui suit les redirections sans jamais toucher au réseau."""

import httpx
import pytest

from app.services.analysis.safe_fetch import FetchError, SafeFetcher, is_public_ip

PUBLIC_IP = "93.184.216.34"


def make_fetcher(dns: dict[str, list[str]], handler: httpx.MockTransportHandle) -> SafeFetcher:
    return SafeFetcher(resolver=lambda host, port: dns[host], transport=httpx.MockTransport(handler))


@pytest.mark.parametrize(
    "ip",
    [
        "127.0.0.1",
        "10.0.0.5",
        "192.168.1.1",
        "172.16.0.1",
        "169.254.169.254",
        "100.64.0.1",
        "0.0.0.0",
        "224.0.0.1",
        "::1",
        "fd00::1",
        "fe80::1",
        "::ffff:127.0.0.1",
    ],
)
def test_ip_non_publique(ip: str) -> None:
    assert is_public_ip(ip) is False


@pytest.mark.parametrize("ip", ["8.8.8.8", "93.184.216.34", "2001:4860:4860::8888"])
def test_ip_publique(ip: str) -> None:
    assert is_public_ip(ip) is True


def test_suit_les_redirections() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.headers["host"] == "court.example":
            return httpx.Response(301, headers={"location": "https://site.example/b"})
        return httpx.Response(200, headers={"content-type": "text/html"})

    fetcher = make_fetcher({"court.example": [PUBLIC_IP], "site.example": [PUBLIC_IP]}, handler)
    result = fetcher.fetch("https://court.example/a")

    assert result.error is None
    assert result.final_url == "https://site.example/b"
    assert [hop.status for hop in result.chain] == [301, 200]
    assert result.content_type == "text/html"


def test_connexion_vers_l_ip_resolue() -> None:
    seen: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url_host"] = request.url.host
        seen["header_host"] = request.headers["host"]
        seen["sni"] = request.extensions.get("sni_hostname")
        return httpx.Response(200, headers={"content-type": "text/html"})

    fetcher = make_fetcher({"site.example": [PUBLIC_IP]}, handler)
    result = fetcher.fetch("https://site.example/")

    assert result.error is None
    assert seen["url_host"] == PUBLIC_IP
    assert seen["header_host"] == "site.example"
    assert seen["sni"] == "site.example"


def test_identifiants_jamais_envoyes() -> None:
    captured: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["userinfo"] = request.url.userinfo
        captured["headers"] = request.headers
        return httpx.Response(200, headers={"content-type": "text/html"})

    fetcher = make_fetcher({"site.example": [PUBLIC_IP]}, handler)
    result = fetcher.fetch("https://user:pass@site.example/")

    assert result.error is None
    assert captured["userinfo"] == b""
    assert "authorization" not in captured["headers"]


def test_redirection_vers_ip_privee_bloquee() -> None:
    visited: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        visited.append(request.headers["host"])
        return httpx.Response(302, headers={"location": "http://interne.example/"})

    dns = {"site.example": [PUBLIC_IP], "interne.example": ["10.0.0.5"]}
    result = make_fetcher(dns, handler).fetch("https://site.example/go")

    assert result.error == FetchError.BLOCKED_ADDRESS
    assert "interne.example" in (result.rejected_target or "")
    assert "interne.example" not in visited


def test_dns_mixte_public_et_prive_refuse() -> None:
    calls: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request.headers["host"])
        return httpx.Response(200, headers={"content-type": "text/html"})

    dns = {"mix.example": [PUBLIC_IP, "10.0.0.5"]}
    result = make_fetcher(dns, handler).fetch("https://mix.example/")

    assert result.error == FetchError.BLOCKED_ADDRESS
    assert calls == []


def test_url_directe_vers_metadata() -> None:
    calls: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        return httpx.Response(200)

    result = make_fetcher({}, handler).fetch("http://169.254.169.254/latest/meta-data")

    assert result.error == FetchError.BLOCKED_ADDRESS
    assert calls == []


def test_redirection_non_http() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(302, headers={"location": "intent://scan/#Intent;end"})

    result = make_fetcher({"site.example": [PUBLIC_IP]}, handler).fetch("https://site.example/")

    assert result.error == FetchError.NON_HTTP_REDIRECT


def test_boucle_de_redirection() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(302, headers={"location": "https://site.example/a"})

    result = make_fetcher({"site.example": [PUBLIC_IP]}, handler).fetch("https://site.example/a")

    assert result.error == FetchError.REDIRECT_LOOP


def test_trop_de_redirections() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        index = int(request.url.path.removeprefix("/r"))
        return httpx.Response(302, headers={"location": f"https://site.example/r{index + 1}"})

    result = make_fetcher({"site.example": [PUBLIC_IP]}, handler).fetch("https://site.example/r1")

    assert result.error == FetchError.TOO_MANY_REDIRECTS


def test_timeout() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectTimeout("lent")

    result = make_fetcher({"site.example": [PUBLIC_IP]}, handler).fetch("https://site.example/")

    assert result.error == FetchError.TIMEOUT


def test_schema_invalide() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise AssertionError("aucune requête ne doit partir")

    result = make_fetcher({}, handler).fetch("ftp://fichiers.example/x")

    assert result.error == FetchError.INVALID_URL
