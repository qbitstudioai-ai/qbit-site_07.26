import { getHomepageCopy } from "@/content/homepage-copy";
import { OfficeSemanticMap } from "./OfficeSemanticMap";
import styles from "./OfficeExperience.module.css";

export function OfficeExperience() {
  const { interactionHint } = getHomepageCopy();

  return (
    <section className={styles.office}>
      <p className={styles.hint}>{interactionHint}</p>
      <OfficeSemanticMap />
    </section>
  );
}
