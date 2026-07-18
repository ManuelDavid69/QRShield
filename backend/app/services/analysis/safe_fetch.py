"""Suit les redirections d'une URL inconnue sans exposer le serveur.

Le serveur va chercher des URLs choisies par n'importe qui (le contenu d'un QR code).
Sans précaution, un QR code vers http://169.254.169.254/ ou http://localhost:5432
ferait interroger nos propres services internes par l'API (attaque SSRF).
Pour chaque saut :
- on résout le DNS nous-mêmes et on refuse toute IP non publique ;
- on se connecte à CETTE IP (et pas au nom de domaine), sinon un DNS qui répond
  une IP publique puis une IP privée à la requête suivante contournerait le
  contrôle (DNS rebinding). Le SNI et le Host restent ceux du vrai domaine, donc
  le certificat TLS est toujours vérifié.
On ne télécharge jamais le corps des réponses, seulement les en-têtes.
"""

import ipaddress
import socket
import ssl
import time
from collections.abc import Callable
from dataclasses import dataclass, field

import httpx

MAX_REDIRECTS = 8
TOTAL_DEADLINE_S = 12.0
TIMEOUT = httpx.Timeout(5.0, connect=3.0)
USER_AGENT = "Mozilla/5.0 (compatible; QRShield/0.1; +https://github.com/ManuelDavid69/QRShield)"
REDIRECT_STATUSES = {301, 302, 303, 307, 308}

Resolver = Callable[[str, int], list[str]]


@dataclass
class Hop:
    url: str
    status: int | None = None


@dataclass
class FetchResult:
    chain: list[Hop] = field(default_factory=list)
    final_url: str = ""
    content_type: str | None = None
    content_disposition: str | None = None
    # None si tout s'est bien passé, sinon un code court (voir FetchError)
    error: str | None = None
    # URL vers laquelle on a refusé d'aller (schéma non http, IP privée...)
    rejected_target: str | None = None


class FetchError:
    INVALID_URL = "invalid_url"
    BLOCKED_ADDRESS = "blocked_address"
    NON_HTTP_REDIRECT = "non_http_redirect"
    TOO_MANY_REDIRECTS = "too_many_redirects"
    REDIRECT_LOOP = "redirect_loop"
    TLS_ERROR = "tls_error"
    TIMEOUT = "timeout"
    UNREACHABLE = "unreachable"


class BlockedAddressError(Exception):
    pass


def is_public_ip(value: str) -> bool:
    ip = ipaddress.ip_address(value)
    # ::ffff:127.0.0.1 doit être jugé comme 127.0.0.1
    if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped is not None:
        ip = ip.ipv4_mapped
    # is_global laisse passer le multicast, on le refuse à part
    return ip.is_global and not ip.is_multicast


def system_resolver(host: str, port: int) -> list[str]:
    infos = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
    return list(dict.fromkeys(info[4][0] for info in infos))


def resolve_public_ip(host: str, port: int, resolver: Resolver) -> str:
    try:
        ipaddress.ip_address(host)
        candidates = [host]
    except ValueError:
        candidates = resolver(host, port)
    if not candidates:
        raise BlockedAddressError(host)
    # Si UNE des IP est privée on refuse tout : sinon on dépend de l'ordre de la réponse DNS
    if not all(is_public_ip(ip) for ip in candidates):
        raise BlockedAddressError(host)
    return candidates[0]


def _is_tls_error(exc: Exception) -> bool:
    cause: BaseException | None = exc
    while cause is not None:
        if isinstance(cause, ssl.SSLError):
            return True
        cause = cause.__cause__ or cause.__context__
    return "CERTIFICATE_VERIFY_FAILED" in str(exc)


class SafeFetcher:
    def __init__(
        self,
        resolver: Resolver = system_resolver,
        transport: httpx.BaseTransport | None = None,
    ) -> None:
        self._resolver = resolver
        self._transport = transport

    def _client(self) -> httpx.Client:
        return httpx.Client(
            timeout=TIMEOUT,
            headers={"User-Agent": USER_AGENT, "Accept": "*/*"},
            # pas de proxy système, pas de connexion réutilisée entre deux domaines
            trust_env=False,
            limits=httpx.Limits(max_keepalive_connections=0),
            follow_redirects=False,
            transport=self._transport,
        )

    def fetch(self, url: str) -> FetchResult:
        result = FetchResult(final_url=url)
        try:
            current = httpx.URL(url)
        except httpx.InvalidURL:
            result.error = FetchError.INVALID_URL
            return result

        deadline = time.monotonic() + TOTAL_DEADLINE_S
        seen: set[str] = set()

        with self._client() as client:
            for _ in range(MAX_REDIRECTS + 1):
                if current.scheme not in ("http", "https") or not current.raw_host:
                    result.error = FetchError.NON_HTTP_REDIRECT if result.chain else FetchError.INVALID_URL
                    result.rejected_target = str(current)
                    return result

                key = str(current.copy_with(fragment=None))
                if key in seen:
                    result.error = FetchError.REDIRECT_LOOP
                    return result
                seen.add(key)

                hop = Hop(url=str(current))
                result.chain.append(hop)
                result.final_url = str(current)

                if time.monotonic() > deadline:
                    result.error = FetchError.TIMEOUT
                    return result

                host = current.raw_host.decode("ascii")
                port = current.port or (443 if current.scheme == "https" else 80)
                try:
                    ip = resolve_public_ip(host, port, self._resolver)
                except BlockedAddressError:
                    result.error = FetchError.BLOCKED_ADDRESS
                    result.rejected_target = str(current)
                    return result
                except (socket.gaierror, UnicodeError):
                    result.error = FetchError.UNREACHABLE
                    return result

                # On se connecte à l'IP validée, sans les identifiants éventuels de l'URL
                target = current.copy_with(host=ip, username=None, password=None)
                headers = {"Host": current.netloc.decode("ascii")}
                extensions = {"sni_hostname": host} if current.scheme == "https" else {}

                try:
                    with client.stream("GET", target, headers=headers, extensions=extensions) as response:
                        hop.status = response.status_code
                        location = response.headers.get("location")
                        content_type = response.headers.get("content-type")
                        content_disposition = response.headers.get("content-disposition")
                except httpx.TimeoutException:
                    result.error = FetchError.TIMEOUT
                    return result
                except httpx.HTTPError as exc:
                    result.error = FetchError.TLS_ERROR if _is_tls_error(exc) else FetchError.UNREACHABLE
                    return result

                if hop.status in REDIRECT_STATUSES and location:
                    try:
                        current = current.join(location)
                    except httpx.InvalidURL:
                        result.error = FetchError.NON_HTTP_REDIRECT
                        result.rejected_target = location
                        return result
                    continue

                result.content_type = content_type
                result.content_disposition = content_disposition
                return result

        result.error = FetchError.TOO_MANY_REDIRECTS
        return result
