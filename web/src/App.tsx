import { useEffect, useMemo, useState } from "react";
import DataTable from "./components/DataTable";
import RankedBars from "./components/RankedBars";
import ScanExample from "./components/ScanExample";
import WeeklyBars from "./components/WeeklyBars";
import ZoneMap from "./components/ZoneMap";
import { useLang } from "./i18n";
import { fetchStats, fetchZones } from "./services/api";
import type { CommunityStats, Zone } from "./services/api";
import { nearestCity } from "./utils/cities";

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

  const domainRows = useMemo(
    () => (stats?.top_domains ?? []).map((item) => ({ label: item.domain, value: item.reports })),
    [stats],
  );

  const cityRows = useMemo(() => {
    const totals = new Map<string, number>();
    for (const zone of zones) {
      const label = nearestCity(zone.latitude, zone.longitude);
      totals.set(label, (totals.get(label) ?? 0) + zone.reports);
    }
    return [...totals.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [zones]);

  const formatNumber = (value: number) => value.toLocaleString(locale);

  return (
    <div className="page">
      <nav className="topbar">
        <span className="wordmark">QRShield</span>
        <div className="topbar-links">
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
            {t.source}
          </a>
        </div>
      </nav>

      <header className="hero">
        <div className="hero-text">
          <p className="kicker">{t.kicker}</p>
          <h1>{t.title}</h1>
          <p className="lead">{t.lead}</p>
        </div>
        <ScanExample />
      </header>

      {showDemo && (
        <p className="note">
          <strong>{t.demoLabel}</strong>
          {t.demoBefore}
          <code>.example</code>
          {t.demoAfter}
        </p>
      )}

      {failed && <p className="state">{t.unavailable}</p>}
      {!failed && !stats && <p className="state">{t.loading}</p>}

      {stats && (
        <main>
          <section className="figures" aria-label={t.figuresLabel}>
            <p>
              <span className="figure-value">{formatNumber(stats.total_reports)}</span>
              <span className="figure-label">{t.reports}</span>
            </p>
            <p>
              <span className="figure-value">{formatNumber(stats.dangerous_reports)}</span>
              <span className="figure-label">{t.dangerousLinks}</span>
            </p>
            <p>
              <span className="figure-value">{formatNumber(stats.zones)}</span>
              <span className="figure-label">{t.areas}</span>
            </p>
            <p className="figures-period">{t.period(stats.period_days)}</p>
          </section>

          <section className="section">
            <h2>
              <span className="number">01</span> {t.whereTitle}
            </h2>
            <ZoneMap zones={zones} />
            <DataTable zones={zones} />
          </section>

          <section className="section">
            <h2>
              <span className="number">02</span> {t.whatTitle}
            </h2>
            <div className="columns">
              <div>
                <h3>{t.perWeek}</h3>
                <WeeklyBars weekly={stats.weekly} />
              </div>
              <div>
                <h3>{t.threatType}</h3>
                <RankedBars rows={threatRows} unit={t.reports} />
              </div>
              <div>
                <h3>{t.cities}</h3>
                <RankedBars rows={cityRows} unit={t.reports} />
              </div>
              <div>
                <h3>{t.domains}</h3>
                <RankedBars rows={domainRows} unit={t.reports} mono />
              </div>
            </div>
          </section>

          <section className="section">
            <h2>
              <span className="number">03</span> {t.scanTitle}
            </h2>
            <ol className="steps">
              {t.steps.map((step) => (
                <li key={step.title}>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </li>
              ))}
            </ol>
          </section>

          <section className="section">
            <h2>
              <span className="number">04</span> {t.privacyTitle}
            </h2>
            <p className="section-intro">{t.privacyIntro}</p>
            <ul className="checks">
              {t.privacy.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="section">
            <h2>
              <span className="number">05</span> {t.bugsTitle}
            </h2>
            <p className="section-intro">{t.bugsIntro}</p>
            <div className="lessons">
              {t.bugs.map((lesson) => (
                <article key={lesson.title}>
                  <h3>{lesson.title}</h3>
                  <p>{lesson.text}</p>
                </article>
              ))}
            </div>
          </section>
        </main>
      )}

      <footer className="footer">
        <p>{t.footer}</p>
        <p className="stack">FastAPI · PostgreSQL + PostGIS · React Native · React · Docker</p>
      </footer>
    </div>
  );
}
