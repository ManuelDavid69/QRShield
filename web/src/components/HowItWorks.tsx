import { useLang } from "../i18n";

export default function HowItWorks() {
  const { t } = useLang();

  return (
    <div className="how-panel">
      <svg className="how-path" viewBox="0 0 1000 420" preserveAspectRatio="none" aria-hidden="true">
        <path d="M225 215C265 205 300 220 335 250M395 240C480 130 600 130 695 195" />
      </svg>
      <h2>{t.howTitle}</h2>
      <ol className="how-steps">
        {t.steps.map((step, index) => (
          <li key={step.title}>
            <span className="how-number" aria-hidden="true">
              {index + 1}
            </span>
            <h3>{step.title}</h3>
            <p>{step.text}</p>
            {index === 0 && <p className="scribble how-note">{t.stepNote}</p>}
          </li>
        ))}
      </ol>
    </div>
  );
}
