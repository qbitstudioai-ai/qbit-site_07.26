import { getHomepageCopy } from "@/content/homepage-copy";
import styles from "./HeroCopy.module.css";

export function HeroCopy() {
  const copy = getHomepageCopy();

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
        <button type="button" className={styles.primaryCta}>
          {copy.primaryCta}
        </button>
        <a href="#office-map" className={styles.secondaryCta}>
          {copy.secondaryCta}
        </a>
      </div>
    </section>
  );
}
