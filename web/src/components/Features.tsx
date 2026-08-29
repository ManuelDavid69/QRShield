import { useLang } from "../i18n";

// Même ordre que t.features
const ICONS = [
  "M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  "M12 3 2.5 20h19L12 3zM12 10v4.5M12 17.5v.01",
  "M12 3l8 3v6c0 4.6-3.4 7.8-8 9-4.6-1.2-8-4.4-8-9V6l8-3zM8.5 12l2.5 2.5 4.5-4.5",
  "M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14",
  "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7.5V12l3 2",
  "M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 2h-15l1.5-2zM10 21h4",
];

export default function Features() {
  const { t } = useLang();

  return (
    <ul className="features">
      {t.features.map((feature, index) => (
        <li key={feature.title} className="card">
          <svg className="feature-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d={ICONS[index]} />
          </svg>
          <h3>{feature.title}</h3>
          <p>{feature.text}</p>
        </li>
      ))}
    </ul>
  );
}
