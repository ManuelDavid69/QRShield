import dangerScreen from "../assets/screens/danger.png";
import { useLang } from "../i18n";
import PhoneShot from "./PhoneShot";

const CHAIN_URLS = ["court.example/3xK9q", "promo-parking.example", "paypa1-securite.top"];

export default function Features() {
  const { t } = useLang();

  return (
    <div className="highlights">
      <article className="highlight">
        <div className="highlight-text">
          <h2>{t.redirectTitle}</h2>
          <p>{t.redirectText}</p>
        </div>
        <div className="chain-panel">
          <ol className="chain">
            {CHAIN_URLS.map((url, index) => (
              <li key={url}>
                <span className="chain-label">{t.chain[index]}</span>
                <span className="chain-url">{url}</span>
              </li>
            ))}
          </ol>
          <p className="scribble chain-note">
            <svg viewBox="0 0 48 40" aria-hidden="true">
              <path d="M44 34C30 36 14 28 8 7M3 15 8 6l8 6" />
            </svg>
            {t.chainNote}
          </p>
        </div>
      </article>

      <article className="highlight highlight-flip">
        <div className="highlight-text">
          <h2>{t.lookalikeTitle}</h2>
          <p>{t.lookalikeText}</p>
        </div>
        <div className="lookalikes-block">
          {/* Le premier caractère du dernier domaine est un а cyrillique, comme dans une vraie attaque */}
          <ul className="lookalikes">
            <li>
              paypa<mark>1</mark>-securite.top
            </li>
            <li>
              amaz<mark>0</mark>n-livraison.fr
            </li>
            <li>
              <mark>а</mark>pple.com
            </li>
          </ul>
          <p className="scribble lookalike-note">{t.lookalikeNote}</p>
        </div>
      </article>

      <article className="highlight highlight-verdict">
        <div className="highlight-text">
          <h2>{t.verdictTitle}</h2>
          <p>{t.verdictText}</p>
        </div>
        <div className="phone-peek">
          <PhoneShot src={dangerScreen} alt={t.verdictAlt} />
        </div>
      </article>
    </div>
  );
}
