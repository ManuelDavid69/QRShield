import { useEffect, useRef } from "react";
import L from "leaflet";
import { useLang } from "../i18n";
import type { Zone } from "../services/api";
import { nearestCity } from "../utils/cities";

interface ZoneMapProps {
  zones: Zone[];
}

const FRANCE_CENTER: L.LatLngTuple = [46.6, 2.5];
const INITIAL_ZOOM = window.innerWidth < 720 ? 5 : 6;

export default function ZoneMap({ zones }: ZoneMapProps) {
  const { t } = useLang();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const map = L.map(container, { scrollWheelZoom: false }).setView(FRANCE_CENTER, INITIAL_ZOOM);

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
      maxZoom: 14,
    }).addTo(map);

    mapRef.current = map;

    // StrictMode monte deux fois : on détruit la carte pour éviter l'instance fantôme.
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    const layer = L.layerGroup().addTo(map);

    for (const zone of zones) {
      const radius = Math.min(4 + 3 * Math.sqrt(zone.reports), 22);
      const mostlyDangerous = zone.reports > 0 && zone.dangerous / zone.reports >= 0.5;
      const city = nearestCity(zone.latitude, zone.longitude);

      L.circleMarker([zone.latitude, zone.longitude], {
        radius,
        color: "#fffdf8",
        weight: 2,
        fillOpacity: 0.75,
        fillColor: mostlyDangerous ? "#c8321e" : "#d9920f",
      })
        .bindTooltip(
          `<strong>${city}</strong><br />${t.mapTooltip(zone.reports, zone.dangerous)}`,
        )
        .addTo(layer);
    }

    return () => {
      mapRef.current?.removeLayer(layer);
    };
  }, [zones, t]);

  return (
    <div className="map-block">
      <div ref={containerRef} className="map" />
      <div className="map-legend">
        <span className="legend-item">
          <span className="legend-dot legend-dot-danger" aria-hidden="true" />
          {t.legendDangerous}
        </span>
        <span className="legend-item">
          <span className="legend-dot legend-dot-warning" aria-hidden="true" />
          {t.legendSuspicious}
        </span>
        <span>{t.legendSize}</span>
      </div>
          </div>
  );
}
