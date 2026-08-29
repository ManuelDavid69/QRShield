import { useEffect, useMemo, useState } from "react";
import historyScreen from "./assets/screens/history.png";
import statsScreen from "./assets/screens/stats.png";
import suspectScreen from "./assets/screens/suspect.png";
import DataTable from "./components/DataTable";
import Features from "./components/Features";
import HowItWorks from "./components/HowItWorks";
import PhoneShot from "./components/PhoneShot";
import RankedBars from "./components/RankedBars";
import WeeklyBars from "./components/WeeklyBars";
import ZoneMap from "./components/ZoneMap";
import { useLang } from "./i18n";
import { fetchStats, fetchZones } from "./services/api";
import type { CommunityStats, Zone } from "./services/api";

const REPO_URL = "https://github.com/ManuelDavid69/QRShield";

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
              <rect width="32" height="32" rx="7" />
              <path d="M9 9h6v6H9zM17 9h6v6h-6zM9 17h6v6H9zM18 18h2v2h-2zM21 21h2v2h-2z" />
            </svg>
            QRShield
          </a>
          <nav className="nav-links">
            <a href="#features">{t.navFeatures}</a>
            <a href="#how">{t.navHow}</a>
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
            <a className="header-github" href={REPO_URL} target="_blank" rel="noreferrer">
              GitHub
            </a>
          </div>
        </div>
      </header>

      <main id="top">
        <section className="hero">
          <div className="container hero-grid">
            <div>
              <h1>{t.title}</h1>
              <p className="lead">{t.lead}</p>
              <div className="actions">
                <a className="button button-primary" href={REPO_URL} target="_blank" rel="noreferrer">
                  {t.ctaCode}
                </a>
                <a className="button button-secondary" href="#map">
                  {t.ctaMap}
                </a>
              </div>
              <p className="availability">{t.availability}</p>
            </div>
            <div className="hero-phone">
              <PhoneShot src={suspectScreen} alt={t.heroAlt} />
            </div>
          </div>
        </section>

        <section id="features" className="section section-features">
          <div className="container">
            <Features />
          </div>
        </section>

        <section id="how" className="section section-how">
          <div className="container">
            <HowItWorks />
          </div>
        </section>

        <section className="section section-after">
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
              <p className="after-note">{t.afterNote}</p>
            </div>
            <div className="fan">
              <PhoneShot src={statsScreen} alt={t.statsAlt} />
              <PhoneShot src={historyScreen} alt={t.historyAlt} />
            </div>
          </div>
        </section>

        <section id="map" className="section section-alt">
          <div className="container">
            <h2>{t.mapTitle}</h2>
            <p className="section-intro">{t.mapIntro}</p>
            {showDemo && <p className="note">{t.demoNote}</p>}

            {failed && <p className="state">{t.unavailable}</p>}
            {!failed && !stats && <p className="state">{t.loading}</p>}

            {stats && (
              <>
                <dl className="figures" aria-label={t.figuresLabel}>
                  <div className="card">
                    <dt>{t.reports}</dt>
                    <dd className="figure-value">{formatNumber(stats.total_reports)}</dd>
                  </div>
                  <div className="card">
                    <dt>{t.dangerousLinks}</dt>
                    <dd className="figure-value">{formatNumber(stats.dangerous_reports)}</dd>
                  </div>
                  <div className="card">
                    <dt>{t.areas}</dt>
                    <dd className="figure-value">{formatNumber(stats.zones)}</dd>
                  </div>
                </dl>

                <ZoneMap zones={zones} />
                <DataTable zones={zones} />

                <div className="charts">
                  <div className="card">
                    <h3>{t.perWeek}</h3>
                    <WeeklyBars weekly={stats.weekly} />
                  </div>
                  <div className="card">
                    <h3>{t.threatType}</h3>
                    <RankedBars rows={threatRows} unit={t.reports} />
                    <p className="period">{t.period(stats.period_days)}</p>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>

        <section id="privacy" className="section">
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
      </main>

      <footer className="footer">
        <div className="container footer-row">
          <p>{t.footer}</p>
          <p>FastAPI · PostgreSQL + PostGIS · React Native · React · Docker</p>
        </div>
      </footer>
    </>
  );
}
