// Reprend ce que l'application affiche pour ce lien : score et raisons sont ceux de la vraie analyse
const REASONS = [
  { level: "high", text: "paypa1-securite.top imitates paypal.com by swapping letters for lookalike characters." },
  { level: "low", text: "The .top extension is widely used by fraudulent sites." },
];

export default function ScanExample() {
  return (
    <figure className="scan">
      <figcaption>What the app shows after a scan</figcaption>
      <div className="scan-card">
        <p className="scan-verdict">
          <span>Suspicious link</span>
          <span>55/100</span>
        </p>
        <div className="scan-score" aria-hidden="true">
          <div style={{ width: "55%" }} />
        </div>
        <p className="scan-label">This link leads to</p>
        <p className="scan-domain">paypa1-securite.top</p>
        <ul>
          {REASONS.map((reason) => (
            <li key={reason.text} className={`reason-${reason.level}`}>
              {reason.text}
            </li>
          ))}
        </ul>
      </div>
    </figure>
  );
}
