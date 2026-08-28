import type { Zone } from "../services/api";
import { nearestCity } from "../utils/cities";

interface DataTableProps {
  zones: Zone[];
}

export default function DataTable({ zones }: DataTableProps) {
  const rows = zones.slice(0, 20);

  return (
    <details className="data-table">
      <summary>Show the data as a table</summary>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">City</th>
              <th scope="col" className="num">
                Reports
              </th>
              <th scope="col" className="num">
                Dangerous
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((zone) => (
              <tr key={`${zone.latitude}-${zone.longitude}`}>
                <td>{nearestCity(zone.latitude, zone.longitude)}</td>
                <td className="num">{zone.reports.toLocaleString("en-US")}</td>
                <td className="num">{zone.dangerous.toLocaleString("en-US")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
