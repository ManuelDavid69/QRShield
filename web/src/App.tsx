import { useEffect, useMemo, useState } from "react";
import DataTable from "./components/DataTable";
import RankedBars from "./components/RankedBars";
import WeeklyBars from "./components/WeeklyBars";
import ZoneMap from "./components/ZoneMap";
import { fetchStats, fetchZones } from "./services/api";
import type { CommunityStats, ThreatType, Zone } from "./services/api";
import { nearestCity } from "./utils/cities";

const THREAT_LABELS: Record<ThreatType, string> = {
  phishing: "Hameçonnage",
  malware: "Logiciels malveillants",
  other: "Autres arnaques",
};

const EMPTY_ZONES: Zone[] = [];

interface PageData {
  zones: Zone[];
  stats: CommunityStats;
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
      <header className="head">
        <p className="eyebrow">QRShield</p>
        <h1>Les QR codes piégés signalés en France</h1>
        <p className="lead">
          Un faux QR code collé sur un horodateur ou un menu suffit à voler une carte bancaire. Cette
          carte rassemble, de façon anonyme, les liens dangereux repérés par les utilisateurs de
          l’application QRShield.
        </p>
        <a
          className="link"
          href="https://github.com/ManuelDavid69/QRShield"
          target="_blank"
          rel="noreferrer"
        >
          Voir le code du projet
        </a>
      </header>

      {showDemo && (
        <p className="demo">
          Démonstration : le projet n’a pas encore d’utilisateurs, les chiffres affichés sont fictifs.
        </p>
      )}

      {failed && (
        <p className="state state-error">Les données ne sont pas disponibles pour le moment.</p>
      )}

      {!failed && !stats && <p className="state">Chargement des données…</p>}

      {stats && (
        <main>
          <section className="figures" aria-label="Chiffres clés">
            <div className="figure">
              <span className="figure-value">{stats.total_reports.toLocaleString("fr-FR")}</span>
              <span className="figure-label">signalements</span>
            </div>
            <div className="figure">
              <span className="figure-value">{stats.dangerous_reports.toLocaleString("fr-FR")}</span>
              <span className="figure-label">liens dangereux</span>
            </div>
            <div className="figure">
              <span className="figure-value">{stats.zones.toLocaleString("fr-FR")}</span>
              <span className="figure-label">zones touchées</span>
            </div>
            <p className="figures-period">sur les {stats.period_days} derniers jours</p>
          </section>

          <section className="section">
            <h2>Où ont-ils été signalés ?</h2>
            <ZoneMap zones={zones} />
            <DataTable zones={zones} />
          </section>

          <div className="grid">
            <section className="card">
              <h2>Signalements par semaine</h2>
              <WeeklyBars weekly={stats.weekly} />
            </section>
            <section className="card">
              <h2>Types de menaces</h2>
              <RankedBars rows={threatRows} unit="signalements" />
            </section>
          </div>

          <div className="grid">
            <section className="card">
              <h2>Villes les plus touchées</h2>
              <RankedBars rows={cityRows} unit="signalements" />
            </section>
            <section className="card">
              <h2>Domaines les plus signalés</h2>
              <RankedBars rows={domainRows} unit="signalements" />
            </section>
          </div>

          <section className="section">
            <h2>Comment les données sont protégées</h2>
            <ul className="protections">
              <li>Aucun compte, e-mail ou identifiant n’est associé à un signalement.</li>
              <li>La position est arrondie à une zone d’environ un kilomètre.</li>
              <li>Une zone n’apparaît qu’à partir de deux signalements.</li>
              <li>Seul le domaine est conservé, jamais l’adresse complète du lien.</li>
            </ul>
          </section>
        </main>
      )}

      <footer className="footer">Projet personnel de Manuel David, étudiant à CPE Lyon.</footer>
    </div>
  );
}
