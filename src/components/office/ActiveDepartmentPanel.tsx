import type { Department } from "@/content/types";
import type { OfficeMachineView } from "@/features/office-machine/reducer";
import styles from "./ActiveDepartmentPanel.module.css";

interface ActiveDepartmentPanelProps {
  department: Department;
  machineView: OfficeMachineView;
  onClose: () => void;
}

// Временный, намеренно неоформленный блок содержимого отдела (Step 5 scope, решение по OQ-D
// "Amendment 3" — см. DECISIONS.md 2026-07-15): полноценная 10/90-раскладка,
// DepartmentNavigationRail и компонентное дерево DepartmentExperience/DepartmentCopy/OutcomePanel/
// DepartmentCTA (docs/09) реализуются в Step 6, который целиком заменяет этот файл, а не расширяет
// его.
export function ActiveDepartmentPanel({
  department,
  machineView,
  onClose,
}: ActiveDepartmentPanelProps) {
  const transitionClassName =
    machineView === "department-opening"
      ? styles.opening
      : machineView === "department-switching"
        ? styles.switching
        : machineView === "department-closing"
          ? styles.closing
          : styles.active;

  return (
    <section
      className={`${styles.panel} ${transitionClassName}`}
      aria-label={department.overviewLabel}
    >
      <h2 id={`department-heading-${department.id}`} tabIndex={-1} className={styles.heading}>
        {department.headline}
      </h2>
      <p className={styles.problem}>{department.problem}</p>
      {department.symptoms.length > 0 && (
        <ul className={styles.symptoms}>
          {department.symptoms.slice(0, 3).map((symptom) => (
            <li key={symptom}>{symptom}</li>
          ))}
        </ul>
      )}
      <ul className={styles.outcomes}>
        {department.outcomes.map((outcome) => (
          <li key={outcome}>{outcome}</li>
        ))}
      </ul>
      <div className={styles.actions}>
        <button type="button" className={styles.cta}>
          {department.ctaLabel}
        </button>
        <button type="button" className={styles.close} onClick={onClose}>
          Закрыть
        </button>
      </div>
    </section>
  );
}
