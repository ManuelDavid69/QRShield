import type { Zone } from "../services/api";
import { nearestCity } from "../utils/cities";

interface DataTableProps {
  zones: Zone[];
}

export default function DataTable({ zones }: DataTableProps) {
  const rows = zones.slice(0, 20);

  return (
    <details className="data-table">
      <summary>Voir les données sous forme de tableau</summary>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">Ville</th>
              <th scope="col" className="num">
                Signalements
              </th>
              <th scope="col" className="num">
                Dont dangereux
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((zone) => (
              <tr key={`${zone.latitude}-${zone.longitude}`}>
                <td>{nearestCity(zone.latitude, zone.longitude)}</td>
                <td className="num">{zone.reports.toLocaleString("fr-FR")}</td>
                <td className="num">{zone.dangerous.toLocaleString("fr-FR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
