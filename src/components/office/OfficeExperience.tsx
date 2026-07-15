import type { Department, OfficeZone } from "@/content/types";
import { OfficeSemanticMap } from "./OfficeSemanticMap";
import styles from "./OfficeExperience.module.css";

interface OfficeExperienceProps {
  interactionHint: string;
  departments: Department[];
  officeZones: OfficeZone[];
  isRevealed: boolean;
}

export function OfficeExperience({
  interactionHint,
  departments,
  officeZones,
  isRevealed,
}: OfficeExperienceProps) {
  const sectionClassName = isRevealed
    ? styles.office
    : `${styles.office} ${styles.hiddenUntilRevealed}`;

  return (
    // data-revealed — стабильный, не хешируемый хук для тестов (CSS Modules хеширует классы, а
    // фактическое сокрытие через :global(.js) .hiddenUntilRevealed не воспроизводится в jsdom/
    // Vitest — визуальная проверка делается в e2e/Playwright, здесь проверяется структурный факт).
    <section className={sectionClassName} data-revealed={isRevealed}>
      <p className={styles.hint}>{interactionHint}</p>
      <OfficeSemanticMap departments={departments} officeZones={officeZones} />
    </section>
  );
}
