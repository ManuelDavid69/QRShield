import { useLang } from "../i18n";

const SCORING_URL = "https://github.com/ManuelDavid69/QRShield/blob/main/backend/app/services/scoring.py";

// Vraie réponse de l'API pour ce lien, raccourcie aux champs utiles
const RESPONSE = `POST /scans
{ "content": "https://paypa1-securite.top/login" }

201 Created
{
  "verdict": "suspicious",
  "analysis": {
    "domain": "paypa1-securite.top",
    "score": 55,
    "reasons": [
      { "code": "brand_lookalike", "severity": "high" },
      { "code": "suspicious_tld", "severity": "low" },
      { "code": "unreachable", "severity": "info" }
    ],
    "redirect_chain": [
      "https://paypa1-securite.top/login"
    ]
  }
}`;

export default function AnalysisExample() {
  const { t } = useLang();

  return (
    <div className="example">
      <div>
        <h2>{t.exampleTitle}</h2>
        <p>{t.exampleText}</p>
        <p>{t.exampleScore}</p>
        <p>
          <a href={SCORING_URL} target="_blank" rel="noreferrer">
            {t.exampleSource}
          </a>
        </p>
      </div>
      <pre className="code">
        <code>{RESPONSE}</code>
      </pre>
    </div>
  );
}
