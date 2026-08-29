import { useLang } from "../i18n";

// Reprend ce que l'application affiche pour ce lien : score et raisons sont ceux de la vraie analyse
export default function ScanExample() {
  const { t } = useLang();

  return (
    <figure className="scan">
      <figcaption>{t.scanCaption}</figcaption>
      <div className="scan-card">
        <p className="scan-verdict">
          <span>{t.scanVerdict}</span>
          <span>55/100</span>
        </p>
        <div className="scan-score" aria-hidden="true">
          <div style={{ width: "55%" }} />
        </div>
        <p className="scan-label">{t.scanLeadsTo}</p>
        <p className="scan-domain">paypa1-securite.top</p>
        <ul>
          {t.scanReasons.map((reason) => (
            <li key={reason.text} className={`reason-${reason.level}`}>
              {reason.text}
            </li>
          ))}
        </ul>
      </div>
    </figure>
  );
}
