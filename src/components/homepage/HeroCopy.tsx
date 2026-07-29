import type { HomepageCopy } from "@/content/types";
import styles from "./HeroCopy.module.css";

interface HeroCopyProps {
  copy: HomepageCopy;
  onActivate: () => void;
  isHiddenAfterReveal: boolean;
}

function BenefitIcon({ index }: { index: number }) {
  const paths = [
    "M13 2 5 13h6l-1 9 8-12h-6z",
    "M4 7h11m0 0-3-3m3 3-3 3M20 17H9m0 0 3-3m-3 3 3 3",
    "M12 3 5 5v5c0 4 2.4 6.8 5 8 2.6-1.2 5-4 5-8V8zM9.5 13l1.7 1.7 3.5-4",
    "M2.5 12s3.5-5 9.5-5 9.5 5 9.5 5-3.5 5-9.5 5-9.5-5-9.5-5Zm9.5 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  ];

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={paths[index] ?? paths[0]} />
    </svg>
  );
}

export function HeroCopy({ copy, onActivate, isHiddenAfterReveal }: HeroCopyProps) {
  const sectionClassName = isHiddenAfterReveal
    ? `${styles.hero} ${styles.hiddenAfterReveal}`
    : styles.hero;
  const accentPhrase = "с помощью ИИ";
  const accentIndex = copy.headline.lastIndexOf(accentPhrase);
  const headlineStart = accentIndex >= 0 ? copy.headline.slice(0, accentIndex) : copy.headline;
  const headlineAccent = accentIndex >= 0 ? accentPhrase : "";
  const headlineEnd =
    accentIndex >= 0 ? copy.headline.slice(accentIndex + accentPhrase.length) : "";

  return (
    <section className={sectionClassName}>
      <p className={styles.eyebrow}>{copy.eyebrow}</p>
      <h1 id="hero-heading" tabIndex={-1} className={styles.headline}>
        {headlineStart}
        {headlineAccent ? <span>{headlineAccent}</span> : null}
        {headlineEnd}
      </h1>
      <p className={styles.subheadline}>{copy.subheadline}</p>
      <div className={styles.ctaRow}>
        <a
          href={copy.contactHref}
          className={styles.ctaAccent}
          target="_blank"
          rel="noopener noreferrer"
        >
          {copy.primaryCta}
        </a>
        <a
          href="#office-map"
          className={styles.ctaQuiet}
          onClick={(event) => {
            event.preventDefault();
            onActivate();
          }}
        >
          {copy.secondaryCta}
        </a>
      </div>
      <p className={styles.ctaNote}>{copy.ctaNote}</p>
      <ul className={styles.valuePoints}>
        {copy.valuePoints.map((point, index) => (
          <li key={point}>
            <span className={styles.valueIcon}>
              <BenefitIcon index={index} />
            </span>
            <span>{point}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
