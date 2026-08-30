import { useEffect, useMemo, useState } from "react";
import dangerScreen from "./assets/screens/danger.png";
import historyScreen from "./assets/screens/history.png";
import statsScreen from "./assets/screens/stats.png";
import suspectScreen from "./assets/screens/suspect.png";
import DataTable from "./components/DataTable";
import PhoneShot from "./components/PhoneShot";
import RankedBars from "./components/RankedBars";
import WeeklyBars from "./components/WeeklyBars";
import ZoneMap from "./components/ZoneMap";
import { useLang } from "./i18n";
import { fetchStats, fetchZones } from "./services/api";
import type { CommunityStats, Zone } from "./services/api";

const REPO_URL = "https://github.com/ManuelDavid69/QRShield";
const README_URL = `${REPO_URL}#readme`;

const EMPTY_ZONES: Zone[] = [];

interface PageData {
  zones: Zone[];
  stats: CommunityStats;
}

export default function App() {
  const { lang, locale, setLang, t } = useLang();
  const [data, setData] = useState<PageData | null>(null);
  const [failed, setFailed] = useState(false);
  const showDemo = import.meta.env.VITE_DEMO_DATA !== "false";

  useEffect(() => {
    let active = true;

    Promise.all([fetchZones(), fetchStats()])
      .then(([zoneList, stats]) => {
        if (active) {
          setData({ zones: zoneList.zones, stats });
        }
      })
      .catch(() => {
        if (active) {
          setFailed(true);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const stats = data?.stats ?? null;
  const zones = data?.zones ?? EMPTY_ZONES;

  const threatRows = useMemo(
    () =>
      (stats?.threats ?? []).map((item) => ({
        label: t.threats[item.threat],
        value: item.count,
      })),
    [stats, t],
  );

  const formatNumber = (value: number) => value.toLocaleString(locale);

  return (
    <>
      <header className="header">
        <div className="container header-row">
          <a className="logo" href="#top">
            <svg viewBox="0 0 32 32" aria-hidden="true">
              <rect width="32" height="32" rx="6" />
              <path d="M9 9h6v6H9zM17 9h6v6h-6zM9 17h6v6H9zM18 18h2v2h-2zM21 21h2v2h-2z" />
            </svg>
            QRShield
          </a>
          <nav className="nav-links">
            <a href="#checks">{t.navChecks}</a>
            <a href="#map">{t.navMap}</a>
            <a href="#privacy">{t.navPrivacy}</a>
          </nav>
          <div className="header-actions">
            <div className="lang-switch" role="group" aria-label="Language / Langue">
              {(["en", "fr"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={lang === option}
                  onClick={() => setLang(option)}
                >
                  {option.toUpperCase()}
                </button>
              ))}
            </div>
            <a href={REPO_URL} target="_blank" rel="noreferrer">
              GitHub
            </a>
          </div>
        </div>
      </header>

      <main id="top">
        <section className="hero">
          <div className="container hero-grid">
            <div className="hero-text">
              <h1>{t.title}</h1>
              <p className="lead">{t.lead}</p>
              <p className="actions">
                <a className="button" href={REPO_URL} target="_blank" rel="noreferrer">
                  {t.ctaCode}
                </a>
                <a href="#map">{t.ctaMap}</a>
              </p>
              <p className="byline">{t.byline}</p>
            </div>
            <div className="hero-phone">
              <PhoneShot src={suspectScreen} alt={t.heroAlt} />
            </div>
          </div>
        </section>

        <section id="checks" className="section">
          <div className="container checks">
            <div>
              <h2>{t.checksTitle}</h2>
              <ul className="prose-list">
                {t.checks.map((item) => (
                  <li key={item.title}>
                    <strong>{item.title}</strong> {item.text}
                  </li>
                ))}
              </ul>
              <p className="limit">{t.checksLimit}</p>
            </div>
            <PhoneShot src={dangerScreen} alt={t.dangerAlt} />
          </div>
        </section>

        <section className="section section-alt">
          <div className="container after">
            <div>
              <h2>{t.afterTitle}</h2>
              <ul className="prose-list">
                {t.after.map((item) => (
                  <li key={item.title}>
                    <strong>{item.title}</strong> {item.text}
                  </li>
                ))}
              </ul>
            </div>
            <div className="fan">
              <PhoneShot src={statsScreen} alt={t.statsAlt} />
              <PhoneShot src={historyScreen} alt={t.historyAlt} />
            </div>
          </div>
        </section>

        <section id="map" className="section">
          <div className="container">
            <h2>{t.mapTitle}</h2>
            <p className="section-intro">{t.mapIntro}</p>
            {showDemo && <p className="section-intro">{t.demoNote}</p>}

            {failed && <p className="state">{t.unavailable}</p>}
            {!failed && !stats && <p className="state">{t.loading}</p>}

            {stats && (
              <>
                <p className="figures">
                  <span className="figure-value">{formatNumber(stats.total_reports)}</span> {t.reports},{" "}
                  <span className="figure-value">{formatNumber(stats.dangerous_reports)}</span>{" "}
                  {t.dangerousLinks}, <span className="figure-value">{formatNumber(stats.zones)}</span>{" "}
                  {t.areas}. {t.period(stats.period_days)}
                </p>

                <ZoneMap zones={zones} />
                <DataTable zones={zones} />

                <div className="charts">
                  <div>
                    <h3>{t.perWeek}</h3>
                    <WeeklyBars weekly={stats.weekly} />
                  </div>
                  <div>
                    <h3>{t.threatType}</h3>
                    <RankedBars rows={threatRows} unit={t.reports} />
                  </div>
                </div>
              </>
            )}
          </div>
        </section>

        <section id="privacy" className="section section-alt">
          <div className="container privacy">
            <div>
              <h2>{t.privacyTitle}</h2>
              <p className="section-intro">{t.privacyIntro}</p>
            </div>
            <ul className="prose-list">
              {t.privacy.map((item) => (
                <li key={item.title}>
                  <strong>{item.title}</strong> {item.text}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="section">
          <div className="container tech">
            <h2>{t.techTitle}</h2>
            {t.tech.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            <p>
              <a href={README_URL} target="_blank" rel="noreferrer">
                {t.techLink}
              </a>
            </p>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="container footer-row">
          <p>{t.footer}</p>
          <p>
            <a href={REPO_URL} target="_blank" rel="noreferrer">
              GitHub
            </a>{" "}
            · {t.license}
          </p>
        </div>
      </footer>
    </>
  );
}
