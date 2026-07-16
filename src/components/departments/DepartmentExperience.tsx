import { CarouselNavControls } from "@/components/office/CarouselNavControls";
import type { Department, DepartmentId } from "@/content/types";
import type { OfficeMachineView } from "@/features/office-machine/reducer";
import { DepartmentCopy } from "./DepartmentCopy";
import { DepartmentCTA } from "./DepartmentCTA";
import { OutcomePanel } from "./OutcomePanel";
import styles from "./DepartmentExperience.module.css";

interface DepartmentExperienceProps {
  department: Department;
  machineView: OfficeMachineView;
  departments: Department[];
  onSelectDepartment: (departmentId: DepartmentId) => void;
  onClose: () => void;
}

// Реальная ~90%-область активного отдела (Step 6), полностью заменяет временный
// ActiveDepartmentPanel из Step 5 (см. WORKPLAN.md Step 6 Expected files). DepartmentScene/
// BeforeAfterSequence сознательно не создаются (решение OQ-C, DECISIONS.md 2026-07-15).
export function DepartmentExperience({
  department,
  machineView,
  departments,
  onSelectDepartment,
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

  // Prev/Next по кругу (wrap-around) относительно того же отсортированного порядка, что и rail
  // (WORKPLAN.md Step 7) — полагается на инвариант "ровно 5 отделов" (Step 2), тот же, на который уже
  // неявно полагается DepartmentNavigationRail ("4 доступных кнопки").
  const total = departments.length;
  const currentIndex = departments.findIndex((candidate) => candidate.id === department.id);
  const previousDepartment = departments[(currentIndex - 1 + total) % total];
  const nextDepartment = departments[(currentIndex + 1) % total];

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
      {/* Видимо только на ≤767px (CSS в CarouselNavControls.module.css) — на Desktop/Tablet
          переключение между отделами идёт через DepartmentNavigationRail (rail) в соседней области. */}
      <CarouselNavControls
        previousLabel={`Предыдущий отдел: ${previousDepartment.overviewLabel}`}
        nextLabel={`Следующий отдел: ${nextDepartment.overviewLabel}`}
        onPrevious={() => onSelectDepartment(previousDepartment.id)}
        onNext={() => onSelectDepartment(nextDepartment.id)}
      />
    </section>
  );
}
