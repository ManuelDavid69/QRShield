import { useLang } from "../i18n";
import type { Zone } from "../services/api";
import { nearestCity } from "../utils/cities";

interface DataTableProps {
  zones: Zone[];
}

export default function DataTable({ zones }: DataTableProps) {
  const { locale, t } = useLang();
  const rows = zones.slice(0, 20);

  return (
    <details className="data-table">
      <summary>{t.tableToggle}</summary>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">{t.tableCity}</th>
              <th scope="col" className="num">
                {t.tableReports}
              </th>
              <th scope="col" className="num">
                {t.tableDangerous}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((zone) => (
              <tr key={`${zone.latitude}-${zone.longitude}`}>
                <td>{nearestCity(zone.latitude, zone.longitude)}</td>
                <td className="num">{zone.reports.toLocaleString(locale)}</td>
                <td className="num">{zone.dangerous.toLocaleString(locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
