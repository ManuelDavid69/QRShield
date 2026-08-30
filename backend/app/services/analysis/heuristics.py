"""Indices tirés de l'URL elle-même, sans appeler de service externe."""

import ipaddress
import posixpath
import re
from dataclasses import dataclass
from urllib.parse import unquote, urlsplit

import tldextract
from rapidfuzz.distance import Levenshtein

from app.services.analysis.brands import (
    BRANDS,
    DANGEROUS_EXTENSIONS,
    OFFICIAL_DOMAINS,
    SUSPICIOUS_TLDS,
    Brand,
)
from app.services.analysis.signals import Severity, Signal

# Liste des suffixes publics embarquée dans la lib : pas de téléchargement au démarrage
# Les suffixes privés comptent aussi : sur appspot.com ou github.io, chaque sous-domaine
# est un site indépendant, souvent loué pour héberger une page de phishing
_extract = tldextract.TLDExtract(cache_dir=None, suffix_list_urls=(), include_psl_private_domains=True)

# Caractères qu'on remplace pour imiter une lettre (paypa1, amaz0n, rnicrosoft...)
_HOMOGLYPHS = str.maketrans({"0": "o", "1": "l", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "!": "i", "|": "l"})


@dataclass(frozen=True)
class DomainParts:
    host: str
    subdomain: str
    label: str
    suffix: str
    registry_domain: str

    @property
    def registered(self) -> str:
        """Le site réellement visité (ex. secure-login.ru ou mon-site.github.io)."""
        return f"{self.label}.{self.suffix}" if self.label and self.suffix else self.host

    @property
    def is_official(self) -> bool:
        return any(self.host == d or self.host.endswith(f".{d}") for d in OFFICIAL_DOMAINS)


def split_domain(host: str) -> DomainParts:
    parts = _extract(host.lower().rstrip("."))
    return DomainParts(
        host=host.lower().rstrip("."),
        subdomain=parts.subdomain,
        label=parts.domain,
        suffix=parts.suffix,
        # Le domaine acheté chez le registre : c'est lui qui a une date de création RDAP
        registry_domain=parts.top_domain_under_registry_suffix or host.lower().rstrip("."),
    )


def is_ip_literal(host: str) -> bool:
    try:
        ipaddress.ip_address(host.strip("[]"))
        return True
    except ValueError:
        return False


# Lettres cyrilliques et grecques identiques à l'œil à des lettres latines (attaque homographe)
_CONFUSABLES = str.maketrans({
    "а": "a", "е": "e", "о": "o", "р": "p", "с": "c", "у": "y", "х": "x", "і": "i",
    "ј": "j", "ԁ": "d", "ӏ": "l", "ѕ": "s", "ԛ": "q", "ԝ": "w", "һ": "h", "ɡ": "g",
    "α": "a", "ο": "o", "ρ": "p", "ν": "v", "τ": "t", "ι": "i", "κ": "k", "ε": "e",
})


def _normalize(label: str) -> str:
    return label.lower().replace("-", "").translate(_HOMOGLYPHS).replace("rn", "m").replace("vv", "w")


def _unicode_label(label: str) -> str | None:
    """Décode un label punycode (xn--pple-43d -> аpple), None si ce n'en est pas un."""
    if not label.startswith("xn--"):
        return None
    try:
        return label.encode("ascii").decode("idna")
    except UnicodeError:
        return None


def _tokens(value: str) -> set[str]:
    return {t for t in re.split(r"[-.]", value.lower()) if t}


def _impersonation(brand: Brand, parts: DomainParts, severity: Severity) -> Signal:
    return Signal(
        "brand_impersonation",
        severity,
        f"Le domaine {parts.registered} utilise le nom « {brand.name} » mais n'appartient pas "
        f"à {brand.name} (site officiel : {brand.main_domain}).",
        params={"domain": parts.registered, "brand": brand.name, "official": brand.main_domain},
    )


def _match_brand(brand: Brand, parts: DomainParts) -> Signal | None:
    keyword = brand.keyword
    compact = parts.label.replace("-", "")
    label_tokens = _tokens(parts.label)

    decoded = _unicode_label(parts.label)
    if decoded is not None and decoded.lower().translate(_CONFUSABLES).replace("-", "") == keyword:
        return Signal(
            "brand_homograph",
            Severity.HIGH,
            f"Le domaine s'affiche « {decoded}.{parts.suffix} » mais certaines lettres viennent d'un "
            f"autre alphabet : c'est une imitation de {brand.main_domain}.",
            params={"shown": f"{decoded}.{parts.suffix}", "official": brand.main_domain},
        )

    if compact == keyword:
        # paypal.xyz, orange.top... : le nom exact avec une autre extension
        return _impersonation(brand, parts, Severity.HIGH)
    if keyword in label_tokens:
        # Pour les mots courants ("free-wifi-gare"), on reste prudent
        return _impersonation(brand, parts, Severity.MEDIUM if brand.strict else Severity.HIGH)

    if not brand.strict:
        normalized = _normalize(parts.label)
        # paypa1.com, mais aussi paypa1-securite.top (lettre imitée + mots ajoutés)
        if normalized == keyword or keyword in {_normalize(t) for t in label_tokens} or (
            len(keyword) >= 6 and keyword in normalized and keyword not in compact
        ):
            return Signal(
                "brand_lookalike",
                Severity.HIGH,
                f"Le domaine {parts.registered} imite {brand.main_domain} en remplaçant des lettres "
                "par des caractères qui leur ressemblent.",
                params={"domain": parts.registered, "official": brand.main_domain},
            )
        # "paypalsecure", "netflix-compte" : la marque collée à d'autres mots
        if len(keyword) >= 6 and keyword in compact:
            return _impersonation(brand, parts, Severity.HIGH)
        # Fautes de frappe volontaires (paypall, chronoposte). En dessous de 5 lettres
        # il y a trop de mots légitimes à une lettre près.
        max_distance = 1 if len(keyword) < 8 else 2
        if len(keyword) >= 5 and abs(len(compact) - len(keyword)) <= max_distance:
            if Levenshtein.distance(compact, keyword) <= max_distance:
                return Signal(
                    "brand_typo",
                    Severity.HIGH if len(keyword) >= 6 else Severity.MEDIUM,
                    f"Le domaine {parts.registered} ressemble beaucoup à {brand.main_domain}, "
                    "à une ou deux lettres près.",
                    params={"domain": parts.registered, "official": brand.main_domain},
                )

    sub_tokens = _tokens(parts.subdomain)
    normalized_sub = {_normalize(t) for t in sub_tokens} if not brand.strict else sub_tokens
    if keyword in sub_tokens or keyword in normalized_sub:
        # paypal.com.verification-compte.ru : le vrai site est verification-compte.ru
        return Signal(
            "brand_in_subdomain",
            Severity.MEDIUM if brand.strict else Severity.HIGH,
            f"L'adresse commence par « {brand.name} », mais le site qui s'ouvre est en réalité "
            f"{parts.registered}.",
            params={"brand": brand.name, "domain": parts.registered},
        )
    return None


def brand_signals(host: str) -> list[Signal]:
    if not host or is_ip_literal(host):
        return []
    parts = split_domain(host)
    if parts.is_official:
        return []
    for brand in BRANDS:
        signal = _match_brand(brand, parts)
        if signal is not None:
            return [signal]
    return []


def file_extension(path: str) -> str:
    name = posixpath.basename(unquote(path))
    _, ext = posixpath.splitext(name)
    return ext.lstrip(".").lower()


def url_signals(url: str) -> list[Signal]:
    try:
        parts_url = urlsplit(url)
        host = (parts_url.hostname or "").lower()
    except ValueError:
        return [Signal("invalid_url", Severity.MEDIUM, "L'adresse est mal formée.")]

    signals: list[Signal] = []

    if "@" in parts_url.netloc:
        signals.append(Signal(
            "userinfo_trick",
            Severity.HIGH,
            f"L'adresse contient un « @ » : tout ce qui précède est ignoré, le lien mène en réalité vers {host}.",
            params={"host": host},
        ))

    if is_ip_literal(host):
        signals.append(Signal(
            "ip_address",
            Severity.HIGH,
            "Le lien utilise directement une adresse IP au lieu d'un nom de domaine, "
            "ce que les sites légitimes ne font presque jamais.",
        ))
    elif host:
        parts = split_domain(host)
        if "xn--" in host and not parts.is_official:
            try:
                readable = host.encode("ascii").decode("idna")
            except UnicodeError:
                readable = host
            signals.append(Signal(
                "punycode",
                Severity.MEDIUM,
                f"Le nom de domaine contient des caractères non latins ({readable}), "
                "une technique utilisée pour imiter visuellement un autre site.",
                params={"shown": readable},
            ))
        tld = parts.suffix.rsplit(".", 1)[-1]
        if tld in SUSPICIOUS_TLDS:
            signals.append(Signal(
                "suspicious_tld",
                Severity.LOW,
                f"L'extension .{tld} est très utilisée par les sites frauduleux.",
                params={"tld": tld},
            ))
        if len(_tokens(parts.subdomain)) >= 4:
            signals.append(Signal(
                "many_subdomains",
                Severity.LOW,
                "L'adresse contient un nombre inhabituel de sous-domaines, souvent pour cacher le vrai site.",
            ))
        signals.extend(brand_signals(host))

    if parts_url.scheme == "http":
        signals.append(Signal("no_https", Severity.LOW, "La connexion au site n'est pas chiffrée (HTTP)."))

    ext = file_extension(parts_url.path)
    if ext in DANGEROUS_EXTENSIONS:
        signals.append(Signal(
            "dangerous_download",
            Severity.HIGH,
            f"Le lien télécharge directement un fichier .{ext}. Une application ou un programme "
            "installé depuis un QR code peut prendre le contrôle du téléphone.",
            params={"ext": ext},
        ))

    return signals
