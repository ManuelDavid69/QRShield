interface RankedRow {
  label: string;
  value: number;
}

interface RankedBarsProps {
  rows: RankedRow[];
  unit: string;
}

export default function RankedBars({ rows, unit }: RankedBarsProps) {
  if (rows.length === 0) {
    return <p className="empty">Aucune donnée disponible.</p>;
  }

  const maximum = rows.reduce((highest, row) => Math.max(highest, row.value), 0);

  return (
    <ul className="ranked">
      {rows.map((row) => (
        <li key={row.label} className="ranked-row" title={`${row.value} ${unit}`}>
          <div className="ranked-head">
            <span className="ranked-label">{row.label}</span>
            <span className="ranked-value">{row.value.toLocaleString("fr-FR")}</span>
          </div>
          <div className="ranked-track">
            <div
              className="ranked-fill"
              style={{ width: maximum > 0 ? `${(row.value / maximum) * 100}%` : "0%" }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
