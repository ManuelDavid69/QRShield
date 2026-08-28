// Copie les données de l'API locale dans un fichier, pour publier la page sans serveur.
// Lancer depuis web/ : node scripts/export-demo.mjs
import { mkdirSync, writeFileSync } from "node:fs";

const API_URL = process.env.VITE_API_URL ?? "http://127.0.0.1:8000";

async function getJson(path) {
  const response = await fetch(`${API_URL}${path}`);
  if (!response.ok) throw new Error(`${path} : ${response.status}`);
  return response.json();
}

const [zones, stats] = await Promise.all([getJson("/community/zones"), getJson("/community/stats")]);

// Ce fichier est public : il ne doit contenir que les données fictives du script de démonstration
const realDomains = stats.top_domains.filter(({ domain }) => !domain.endsWith(".example"));
if (realDomains.length > 0) {
  throw new Error(`Export refusé, domaines réels : ${realDomains.map(({ domain }) => domain).join(", ")}`);
}

mkdirSync("public", { recursive: true });
writeFileSync("public/demo-data.json", `${JSON.stringify({ zones, stats }, null, 2)}\n`);
console.log(`${stats.total_reports} signalements et ${zones.zones.length} zones exportés`);
