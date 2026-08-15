import { colors } from "@/constants/colors";
import type { Zone } from "@/services/api";

const LEAFLET = "https://unpkg.com/leaflet@1.9.4/dist";
// Empreintes officielles de Leaflet : un fichier modifié sur le CDN ne serait pas exécuté
const LEAFLET_CSS_SRI = "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=";
const LEAFLET_JS_SRI = "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=";

export function zoneRadius(reports: number): number {
  return Math.min(22, 4 + 3 * Math.sqrt(reports));
}

export function zoneColor(zone: Pick<Zone, "reports" | "dangerous">): string {
  return zone.dangerous / zone.reports >= 0.5 ? colors.dangerous : colors.suspicious;
}

export function buildMapHtml(zones: Zone[]): string {
  // On ne garde que des nombres : rien de ce qui vient de l'API n'est interprété comme du code
  const markers = zones.map((zone) => ({
    lat: Number(zone.latitude),
    lon: Number(zone.longitude),
    radius: zoneRadius(Number(zone.reports)),
    color: zoneColor(zone),
    label: `${Number(zone.reports)} signalements, dont ${Number(zone.dangerous)} dangereux`,
  }));

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="${LEAFLET}/leaflet.css" integrity="${LEAFLET_CSS_SRI}" crossorigin="">
<style>html, body, #map { height: 100%; margin: 0; background: ${colors.background}; }</style>
</head>
<body>
<div id="map"></div>
<script src="${LEAFLET}/leaflet.js" integrity="${LEAFLET_JS_SRI}" crossorigin=""></script>
<script>
  var markers = ${JSON.stringify(markers)};
  var map = L.map("map", { zoomControl: true }).setView([46.6, 2.5], 5);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap",
    maxZoom: 14
  }).addTo(map);
  markers.forEach(function (m) {
    L.circleMarker([m.lat, m.lon], {
      radius: m.radius,
      color: "#ffffff",
      weight: 2,
      fillColor: m.color,
      fillOpacity: 0.75
    }).bindPopup(m.label).addTo(map);
  });
</script>
</body>
</html>`;
}
