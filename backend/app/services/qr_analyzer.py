"""Analyse complète d'une URL : redirections, indices dans l'adresse, réputation, âge du domaine."""

import logging
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from datetime import UTC, datetime
from functools import lru_cache
from typing import Any
from urllib.parse import urlsplit

from app.config import get_settings
from app.models.enums import Verdict
from app.services.analysis.brands import DANGEROUS_CONTENT_TYPES, URL_SHORTENERS
from app.services.analysis.domain_age import RdapClient, domain_age_days
from app.services.analysis.heuristics import file_extension, is_ip_literal, split_domain, url_signals
from app.services.analysis.reputation import ReputationError, SafeBrowsingClient, VirusTotalClient
from app.services.analysis.safe_fetch import FetchError, FetchResult, SafeFetcher
from app.services.analysis.signals import Severity, Signal
from app.services.scoring import compute_score, deduplicate

logger = logging.getLogger(__name__)

NEW_DOMAIN_DAYS = 30
RECENT_DOMAIN_DAYS = 90


@dataclass
class AnalysisOutcome:
    final_url: str
    domain: str | None
    score: int
    verdict: Verdict
    signals: list[Signal]
    details: dict[str, Any] = field(default_factory=dict)


def _registered_domain(url: str) -> str | None:
    try:
        host = (urlsplit(url).hostname or "").lower()
    except ValueError:
        return None
    if not host:
        return None
    if is_ip_literal(host):
        return host
    return split_domain(host).registered


def redirect_signals(initial_url: str, fetch: FetchResult) -> list[Signal]:
    signals: list[Signal] = []
    first = _registered_domain(initial_url)
    final = _registered_domain(fetch.final_url)
    redirects = max(0, len(fetch.chain) - 1)

    if first in URL_SHORTENERS:
        signals.append(Signal(
            "url_shortener",
            Severity.LOW,
            f"Le lien passe par un raccourcisseur ({first}) qui masque sa vraie destination.",
        ))
    elif first and final and first != final:
        signals.append(Signal(
            "domain_change",
            Severity.LOW,
            f"Le lien redirige de {first} vers un autre site : {final}.",
        ))
    if redirects >= 3:
        signals.append(Signal(
            "many_redirects",
            Severity.LOW,
            f"Le lien passe par {redirects} redirections avant d'arriver à destination.",
        ))

    error = fetch.error
    if error == FetchError.NON_HTTP_REDIRECT:
        target = (fetch.rejected_target or "").split(":", 1)[0]
        signals.append(Signal(
            "non_http_redirect",
            Severity.HIGH,
            f"Le site redirige vers une adresse « {target}: » qui peut ouvrir une application "
            "ou lancer une action sur le téléphone.",
        ))
    elif error == FetchError.BLOCKED_ADDRESS:
        signals.append(Signal(
            "private_address",
            Severity.MEDIUM,
            "Le lien pointe vers une adresse de réseau local ou réservée, ce qui n'a pas de sens "
            "pour un QR code affiché en public.",
        ))
    elif error in (FetchError.TOO_MANY_REDIRECTS, FetchError.REDIRECT_LOOP):
        signals.append(Signal(
            "redirect_abuse",
            Severity.MEDIUM,
            "Le lien enchaîne les redirections sans fin, une technique utilisée pour échapper aux analyses.",
        ))
    elif error == FetchError.TLS_ERROR:
        signals.append(Signal(
            "tls_error",
            Severity.MEDIUM,
            "Le certificat de sécurité du site est invalide : la connexion n'est pas fiable.",
        ))
    elif error in (FetchError.UNREACHABLE, FetchError.TIMEOUT):
        signals.append(Signal(
            "unreachable",
            Severity.INFO,
            "Le site n'a pas pu être joint, l'analyse est donc partielle.",
        ))

    content_type = (fetch.content_type or "").split(";", 1)[0].strip().lower()
    disposition = (fetch.content_disposition or "").lower()
    attachment_ext = ""
    if "filename=" in disposition:
        attachment_ext = file_extension(disposition.split("filename=", 1)[1].strip().strip('"\''))
    if content_type in DANGEROUS_CONTENT_TYPES or attachment_ext in ("apk", "exe", "msi", "dmg"):
        signals.append(Signal(
            "dangerous_download",
            Severity.HIGH,
            "Le site renvoie directement un fichier à installer (application ou programme). "
            "Une application installée depuis un QR code peut prendre le contrôle du téléphone.",
        ))
    return signals


class UrlAnalyzer:
    def __init__(
        self,
        fetcher: SafeFetcher | None = None,
        safe_browsing: SafeBrowsingClient | None = None,
        virustotal: VirusTotalClient | None = None,
        rdap: RdapClient | None = None,
    ) -> None:
        self._fetcher = fetcher or SafeFetcher()
        self._safe_browsing = safe_browsing
        self._virustotal = virustotal
        self._rdap = rdap

    def _check_safe_browsing(self, urls: list[str]) -> tuple[list[Signal], Any]:
        if self._safe_browsing is None:
            return [], "non configuré"
        try:
            threats = self._safe_browsing.check(urls)
        except ReputationError as exc:
            # pas de exc_info : la trace contiendrait la requête et donc la clé d'API
            logger.warning("Safe Browsing indisponible : %s", exc)
            return [], "erreur"
        if not threats:
            return [], {"threats": []}
        return [Signal(
            "safe_browsing",
            Severity.CRITICAL,
            "Ce lien est référencé comme dangereux par Google Safe Browsing "
            f"({', '.join(threats)}).",
        )], {"threats": threats}

    def _check_virustotal(self, url: str) -> tuple[list[Signal], Any]:
        if self._virustotal is None:
            return [], "non configuré"
        try:
            stats = self._virustotal.lookup(url)
        except ReputationError as exc:
            logger.warning("VirusTotal indisponible : %s", exc)
            return [], "erreur"
        if stats is None:
            return [], "inconnu"
        detail = {"malicious": stats.malicious, "suspicious": stats.suspicious, "harmless": stats.harmless}
        if stats.malicious >= 3:
            severity = Severity.CRITICAL
        elif stats.malicious >= 1:
            severity = Severity.HIGH
        elif stats.suspicious >= 2:
            severity = Severity.MEDIUM
        else:
            return [], detail
        return [Signal(
            "virustotal",
            severity,
            f"{stats.malicious} antivirus sur VirusTotal considèrent ce lien comme malveillant"
            + (f" et {stats.suspicious} comme suspect." if stats.suspicious else "."),
        )], detail

    def _check_domain_age(self, domain: str | None) -> tuple[list[Signal], Any]:
        if self._rdap is None or not domain or is_ip_literal(domain):
            return [], None
        try:
            created = self._rdap.registration_date(domain)
        except ReputationError:
            return [], None
        if created is None:
            return [], None
        age = domain_age_days(created)
        if age < NEW_DOMAIN_DAYS:
            return [Signal(
                "new_domain",
                Severity.HIGH,
                f"Le site {domain} a été créé il y a seulement {age} jour(s). Les sites d'arnaque "
                "sont souvent tout neufs, car ils sont fermés rapidement.",
            )], age
        if age < RECENT_DOMAIN_DAYS:
            return [Signal(
                "recent_domain",
                Severity.MEDIUM,
                f"Le site {domain} existe depuis moins de trois mois ({age} jours).",
            )], age
        return [], age

    def analyze(self, url: str) -> AnalysisOutcome:
        fetch = self._fetcher.fetch(url)
        final_url = fetch.final_url or url
        domain = _registered_domain(final_url)

        signals = url_signals(url)
        if final_url != url:
            # http://site -> https://site est normal : seule l'URL finale compte pour le chiffrement
            signals = [s for s in signals if s.code != "no_https"] + url_signals(final_url)
        signals += redirect_signals(url, fetch)

        # Les trois services externes sont indépendants : on les interroge en parallèle
        with ThreadPoolExecutor(max_workers=3) as pool:
            sb = pool.submit(self._check_safe_browsing, list(dict.fromkeys([url, final_url])))
            vt = pool.submit(self._check_virustotal, final_url)
            age = pool.submit(self._check_domain_age, domain)
            sb_signals, sb_detail = sb.result()
            vt_signals, vt_detail = vt.result()
            age_signals, age_days = age.result()

        signals = deduplicate(signals + sb_signals + vt_signals + age_signals)
        score, verdict = compute_score(signals)

        return AnalysisOutcome(
            final_url=final_url,
            domain=domain,
            score=score,
            verdict=verdict,
            signals=signals,
            details={
                "redirect_chain": [{"url": hop.url, "status": hop.status} for hop in fetch.chain],
                "fetch_error": fetch.error,
                "content_type": fetch.content_type,
                "checks": {
                    "safe_browsing": sb_detail,
                    "virustotal": vt_detail,
                    "domain_age_days": age_days,
                },
                "analyzed_at": datetime.now(UTC).isoformat(),
            },
        )


@lru_cache
def get_url_analyzer() -> UrlAnalyzer:
    """Dépendance FastAPI. Les services externes sans clé configurée sont simplement ignorés."""
    settings = get_settings()
    return UrlAnalyzer(
        safe_browsing=SafeBrowsingClient(settings.google_safe_browsing_api_key)
        if settings.google_safe_browsing_api_key
        else None,
        virustotal=VirusTotalClient(settings.virustotal_api_key) if settings.virustotal_api_key else None,
        rdap=RdapClient() if settings.domain_age_check else None,
    )
