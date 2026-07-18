"""Tests du moteur d'analyse complet, avec des composants factices (aucun réseau)."""

from datetime import UTC, datetime, timedelta

import pytest

from app.models.enums import Verdict
from app.services.analysis.reputation import ReputationError, VirusTotalStats
from app.services.analysis.safe_fetch import FetchError, FetchResult, Hop
from app.services.analysis.signals import Severity, Signal
from app.services.qr_analyzer import AnalysisOutcome, UrlAnalyzer

NORMAL_URL = "https://monrestaurant.fr/menu"


class FakeFetcher:
    def __init__(self, result: FetchResult) -> None:
        self._result = result

    def fetch(self, url: str) -> FetchResult:
        return self._result


class FakeSafeBrowsing:
    def __init__(self, threats: list[str] | Exception) -> None:
        self._threats = threats

    def check(self, urls: list[str]) -> list[str]:
        if isinstance(self._threats, Exception):
            raise self._threats
        return self._threats


class FakeVirusTotal:
    def __init__(self, stats: VirusTotalStats | None | Exception) -> None:
        self._stats = stats

    def lookup(self, url: str) -> VirusTotalStats | None:
        if isinstance(self._stats, Exception):
            raise self._stats
        return self._stats


class FakeRdap:
    def __init__(self, created: datetime | None) -> None:
        self._created = created

    def registration_date(self, domain: str) -> datetime | None:
        return self._created


def page(url: str, status: int = 200, content_type: str | None = "text/html") -> FetchResult:
    return FetchResult(chain=[Hop(url=url, status=status)], final_url=url, content_type=content_type)


def analyze(url: str, result: FetchResult, **services: object) -> AnalysisOutcome:
    return UrlAnalyzer(fetcher=FakeFetcher(result), **services).analyze(url)


def signals_for(outcome: AnalysisOutcome, code: str) -> list[Signal]:
    return [signal for signal in outcome.signals if signal.code == code]


def test_site_normal() -> None:
    outcome = analyze(NORMAL_URL, page(NORMAL_URL))

    assert outcome.verdict is Verdict.SAFE
    assert outcome.score == 0
    assert outcome.details["redirect_chain"] == [{"url": NORMAL_URL, "status": 200}]


def test_safe_browsing_dangereux() -> None:
    outcome = analyze(NORMAL_URL, page(NORMAL_URL), safe_browsing=FakeSafeBrowsing(["SOCIAL_ENGINEERING"]))

    assert outcome.verdict is Verdict.DANGEROUS
    signals = signals_for(outcome, "safe_browsing")
    assert len(signals) == 1
    assert signals[0].severity is Severity.CRITICAL
    assert outcome.details["checks"]["safe_browsing"] == {"threats": ["SOCIAL_ENGINEERING"]}


def test_safe_browsing_en_panne() -> None:
    outcome = analyze(
        NORMAL_URL,
        page(NORMAL_URL),
        safe_browsing=FakeSafeBrowsing(ReputationError("panne")),
    )

    assert outcome.details["checks"]["safe_browsing"] == "erreur"
    assert outcome.verdict is Verdict.SAFE


def test_services_non_configures() -> None:
    outcome = analyze(NORMAL_URL, page(NORMAL_URL))

    assert outcome.details["checks"]["safe_browsing"] == "non configuré"
    assert outcome.details["checks"]["virustotal"] == "non configuré"


@pytest.mark.parametrize(
    ("stats", "expected"),
    [
        (VirusTotalStats(malicious=5, suspicious=0, harmless=60, undetected=10), Severity.CRITICAL),
        (VirusTotalStats(malicious=1, suspicious=0, harmless=60, undetected=10), Severity.HIGH),
    ],
)
def test_virustotal(stats: VirusTotalStats, expected: Severity) -> None:
    outcome = analyze(NORMAL_URL, page(NORMAL_URL), virustotal=FakeVirusTotal(stats))

    signals = signals_for(outcome, "virustotal")
    assert len(signals) == 1
    assert signals[0].severity is expected


def test_virustotal_inconnu() -> None:
    outcome = analyze(NORMAL_URL, page(NORMAL_URL), virustotal=FakeVirusTotal(None))

    assert outcome.details["checks"]["virustotal"] == "inconnu"
    assert signals_for(outcome, "virustotal") == []


@pytest.mark.parametrize(
    ("days", "expected"),
    [(5, "new_domain"), (60, "recent_domain"), (730, None)],
)
def test_age_du_domaine(days: int, expected: str | None) -> None:
    created = datetime.now(UTC) - timedelta(days=days)
    outcome = analyze(NORMAL_URL, page(NORMAL_URL), rdap=FakeRdap(created))

    age = outcome.details["checks"]["domain_age_days"]
    if expected is None:
        assert signals_for(outcome, "new_domain") == []
        assert signals_for(outcome, "recent_domain") == []
        assert isinstance(age, int) and age > 700
    else:
        signals = signals_for(outcome, expected)
        assert len(signals) == 1
        assert signals[0].severity is (Severity.HIGH if expected == "new_domain" else Severity.MEDIUM)


def test_raccourcisseur() -> None:
    result = FetchResult(
        chain=[
            Hop(url="https://bit.ly/x", status=301),
            Hop(url="https://site.example/page", status=200),
        ],
        final_url="https://site.example/page",
        content_type="text/html",
    )

    outcome = analyze("https://bit.ly/x", result)

    assert signals_for(outcome, "url_shortener")
    assert outcome.final_url == "https://site.example/page"
    assert outcome.domain == "site.example"


def test_changement_de_domaine() -> None:
    result = FetchResult(
        chain=[
            Hop(url="https://a-site.fr/", status=301),
            Hop(url="https://autre-site.com/", status=200),
        ],
        final_url="https://autre-site.com/",
        content_type="text/html",
    )

    outcome = analyze("https://a-site.fr/", result)

    assert signals_for(outcome, "domain_change")


def test_redirection_non_http() -> None:
    result = FetchResult(
        chain=[Hop(url="https://site.example/", status=302)],
        final_url="https://site.example/",
        error=FetchError.NON_HTTP_REDIRECT,
        rejected_target="intent://x",
    )

    outcome = analyze("https://site.example/", result)

    signals = signals_for(outcome, "non_http_redirect")
    assert len(signals) == 1
    assert signals[0].severity is Severity.HIGH
    assert "intent:" in signals[0].message


def test_telechargement_dangereux() -> None:
    result = FetchResult(
        chain=[Hop(url="https://site.example/app", status=200)],
        final_url="https://site.example/app",
        content_type="application/vnd.android.package-archive",
    )

    outcome = analyze("https://site.example/app", result)

    assert signals_for(outcome, "dangerous_download")


def test_faux_paypal_tout_neuf() -> None:
    url = "https://paypa1-securite.top/login"
    created = datetime.now(UTC) - timedelta(days=3)

    outcome = analyze(url, page(url), rdap=FakeRdap(created))

    assert outcome.verdict is Verdict.DANGEROUS


def test_aucun_code_de_signal_en_double() -> None:
    result = FetchResult(
        chain=[
            Hop(url="http://45.13.22.8/a", status=301),
            Hop(url="http://45.13.22.8/b", status=200),
        ],
        final_url="http://45.13.22.8/b",
        content_type="text/html",
    )

    outcome = analyze("http://45.13.22.8/a", result)

    found = [signal.code for signal in outcome.signals]
    assert len(found) == len(set(found))


def test_http_redirige_vers_https_non_penalise() -> None:
    fetch = FetchResult(
        chain=[Hop(url="http://github.com", status=301), Hop(url="https://github.com/", status=200)],
        final_url="https://github.com/",
    )
    outcome = UrlAnalyzer(fetcher=FakeFetcher(fetch)).analyze("http://github.com")
    assert "no_https" not in {s.code for s in outcome.signals}
    assert outcome.score == 0
