import type { HomepageCopy } from "@/content/types";
import styles from "./HeroCopy.module.css";

interface HeroCopyProps {
  copy: HomepageCopy;
  onActivate: () => void;
  isHiddenAfterReveal: boolean;
}

export function HeroCopy({ copy, onActivate, isHiddenAfterReveal }: HeroCopyProps) {
  const sectionClassName = isHiddenAfterReveal
    ? `${styles.hero} ${styles.hiddenAfterReveal}`
    : styles.hero;

  return (
    <section className={sectionClassName}>
      <h1 id="hero-heading" tabIndex={-1} className={styles.headline}>
        {copy.headline}
      </h1>
      <p className={styles.subheadline}>{copy.subheadline}</p>
      <ul className={styles.valuePoints}>
        {copy.valuePoints.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
      <div className={styles.ctaRow}>
        <button type="button" className={styles.primaryCta} onClick={onActivate}>
          {copy.primaryCta}
        </button>
        <a
          href="#office-map"
          className={styles.secondaryCta}
          onClick={(event) => {
            event.preventDefault();
            onActivate();
          }}
        >
          {copy.secondaryCta}
        </a>
      </div>
    </section>
  );
}
