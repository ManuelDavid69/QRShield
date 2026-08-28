import { useEffect, useMemo, useState } from "react";
import DataTable from "./components/DataTable";
import RankedBars from "./components/RankedBars";
import ScanExample from "./components/ScanExample";
import WeeklyBars from "./components/WeeklyBars";
import ZoneMap from "./components/ZoneMap";
import { fetchStats, fetchZones } from "./services/api";
import type { CommunityStats, ThreatType, Zone } from "./services/api";
import { nearestCity } from "./utils/cities";

const REPO_URL = "https://github.com/ManuelDavid69/QRShield";

const THREAT_LABELS: Record<ThreatType, string> = {
  phishing: "Phishing",
  malware: "Malware downloads",
  other: "Other scams",
};

const EMPTY_ZONES: Zone[] = [];

const STEPS = [
  {
    title: "Follow the link",
    text: "The server follows every redirect to the real destination. It only reads headers, it never downloads the page.",
  },
  {
    title: "Read the address",
    text: "paypa1.com, amaz0n-livraison.fr, a Cyrillic а in apple.com, the @ trick. A lot of scams are visible in the URL itself.",
  },
  {
    title: "Ask around",
    text: "Google Safe Browsing, VirusTotal and the age of the domain. Scam sites are often only a few days old.",
  },
  {
    title: "Give a verdict",
    text: "Every clue has a weight and they add up to a score out of 100. You see each reason, and you decide what to do.",
  },
];

const LESSONS = [
  {
    title: "The Wi-Fi password showed up in plain text",
    text: "On Android, the camera library returns a reformatted version of Wi-Fi QR codes, without the WIFI: prefix. My unit tests used the raw text, so they all passed. I only saw it when I scanned a real code with my phone.",
  },
  {
    title: "The camera kept running behind the other tabs",
    text: "I had paused it with a prop that Android silently ignores. The flashlight stayed on when I changed tabs, and that is how I noticed. The camera could still read QR codes in the background, so it now closes for real.",
  },
  {
    title: "A safe verdict could show up on the wrong link",
    text: "If a new link arrived while a result was open, the screen kept the previous analysis. A phishing link ended up with a green verdict. It only happened through deep links, but that is exactly what an attacker would use.",
  },
];

const PRIVACY = [
  "A report has no account, no email and no link back to the scan.",
  "Locations are snapped to a grid of about one kilometer.",
  "A zone only appears once it has at least two reports.",
  "Only the domain is kept, never the full link, and only the day, never the time.",
];

interface PageData {
  zones: Zone[];
  stats: CommunityStats;
}

function formatNumber(value: number): string {
  return value.toLocaleString("en-US");
}

export default function App() {
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
        label: THREAT_LABELS[item.threat],
        value: item.count,
      })),
    [stats],
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

  return (
    <div className="page">
      <nav className="topbar">
        <span className="wordmark">QRShield</span>
        <a href={REPO_URL} target="_blank" rel="noreferrer">
          Source code on GitHub
        </a>
      </nav>

      <header className="hero">
        <div className="hero-text">
          <p className="kicker">A student security project</p>
          <h1>Someone stuck a fake QR code on a parking meter. Would you have noticed?</h1>
          <p className="lead">
            I'm Manuel, a fourth-year computer science and networks student at CPE Lyon. We all scan
            QR codes without thinking, so I built an app that checks where a code really leads
            before you open it.
          </p>
        </div>
        <ScanExample />
      </header>

      {showDemo && (
        <p className="note">
          <strong>Heads-up:</strong> nobody uses the app yet, so the numbers below are made up. The
          domains end in <code>.example</code> so that no real site gets accused.
        </p>
      )}

      {failed && <p className="state">The data is not available right now.</p>}
      {!failed && !stats && <p className="state">Loading the data…</p>}

      {stats && (
        <main>
          <section className="figures" aria-label="Key figures">
            <p>
              <span className="figure-value">{formatNumber(stats.total_reports)}</span>
              <span className="figure-label">reports</span>
            </p>
            <p>
              <span className="figure-value">{formatNumber(stats.dangerous_reports)}</span>
              <span className="figure-label">dangerous links</span>
            </p>
            <p>
              <span className="figure-value">{formatNumber(stats.zones)}</span>
              <span className="figure-label">areas</span>
            </p>
            <p className="figures-period">over the last {stats.period_days} days</p>
          </section>

          <section className="section">
            <h2>
              <span className="number">01</span> Where they were reported
            </h2>
            <ZoneMap zones={zones} />
            <DataTable zones={zones} />
          </section>

          <section className="section">
            <h2>
              <span className="number">02</span> What the reports look like
            </h2>
            <div className="columns">
              <div>
                <h3>Reports per week</h3>
                <WeeklyBars weekly={stats.weekly} />
              </div>
              <div>
                <h3>Type of threat</h3>
                <RankedBars rows={threatRows} unit="reports" />
              </div>
              <div>
                <h3>Most affected cities</h3>
                <RankedBars rows={cityRows} unit="reports" />
              </div>
              <div>
                <h3>Most reported domains</h3>
                <RankedBars rows={domainRows} unit="reports" mono />
              </div>
            </div>
          </section>

          <section className="section">
            <h2>
              <span className="number">03</span> What happens when you scan
            </h2>
            <ol className="steps">
              {STEPS.map((step) => (
                <li key={step.title}>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </li>
              ))}
            </ol>
          </section>

          <section className="section">
            <h2>
              <span className="number">04</span> How reports stay anonymous
            </h2>
            <p className="section-intro">
              A public map can easily show where people go, so I designed the table to make that
              impossible rather than promising not to look.
            </p>
            <ul className="checks">
              {PRIVACY.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="section">
            <h2>
              <span className="number">05</span> Bugs only a real phone could find
            </h2>
            <p className="section-intro">
              All the automated tests were green. These three showed up when I tested on my actual
              phone, and they taught me more than the rest of the project.
            </p>
            <div className="lessons">
              {LESSONS.map((lesson) => (
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
        <p>Personal project by Manuel David, CPE Lyon.</p>
        <p className="stack">FastAPI · PostgreSQL + PostGIS · React Native · React · Docker</p>
      </footer>
    </div>
  );
}
