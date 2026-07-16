import type { Department } from "@/content/types";
import type { OfficeMachineView } from "@/features/office-machine/reducer";
import { DepartmentCopy } from "./DepartmentCopy";
import { DepartmentCTA } from "./DepartmentCTA";
import { OutcomePanel } from "./OutcomePanel";
import styles from "./DepartmentExperience.module.css";

interface DepartmentExperienceProps {
  department: Department;
  machineView: OfficeMachineView;
  onClose: () => void;
}

// Реальная ~90%-область активного отдела (Step 6), полностью заменяет временный
// ActiveDepartmentPanel из Step 5 (см. WORKPLAN.md Step 6 Expected files). DepartmentScene/
// BeforeAfterSequence сознательно не создаются (решение OQ-C, DECISIONS.md 2026-07-15).
export function DepartmentExperience({
  department,
  machineView,
  onClose,
}: DepartmentExperienceProps) {
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
      className={`${styles.experience} ${transitionClassName}`}
      aria-label={department.overviewLabel}
    >
      <DepartmentCopy department={department} />
      <OutcomePanel outcomes={department.outcomes} />
      <div className={styles.actions}>
        <DepartmentCTA label={department.ctaLabel} />
        <button type="button" className={styles.close} onClick={onClose}>
          Закрыть
        </button>
      </div>
    </section>
  );
}
