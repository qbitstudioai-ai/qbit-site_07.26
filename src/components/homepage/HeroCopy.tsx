import type { HomepageCopy } from "@/content/types";
import styles from "./HeroCopy.module.css";

interface HeroCopyProps {
  copy: HomepageCopy;
  onActivate: () => void;
}

export function HeroCopy({ copy, onActivate }: HeroCopyProps) {
  return (
    <section className={styles.hero}>
      <h1 className={styles.headline}>{copy.headline}</h1>
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
