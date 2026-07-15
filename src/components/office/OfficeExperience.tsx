import type { Department, DepartmentId, OfficeZone } from "@/content/types";
import type { OfficeMachineView } from "@/features/office-machine/reducer";
import { ActiveDepartmentPanel } from "./ActiveDepartmentPanel";
import { OfficeSemanticMap } from "./OfficeSemanticMap";
import styles from "./OfficeExperience.module.css";

interface OfficeExperienceProps {
  interactionHint: string;
  departments: Department[];
  officeZones: OfficeZone[];
  isRevealed: boolean;
  machineView: OfficeMachineView;
  activeDepartmentId: DepartmentId | null;
  onSelectDepartment: (departmentId: DepartmentId) => void;
  onCloseDepartment: () => void;
}

export function OfficeExperience({
  interactionHint,
  departments,
  officeZones,
  isRevealed,
  machineView,
  activeDepartmentId,
  onSelectDepartment,
  onCloseDepartment,
}: OfficeExperienceProps) {
  const sectionClassName = isRevealed
    ? styles.office
    : `${styles.office} ${styles.hiddenUntilRevealed}`;

  const activeDepartment = activeDepartmentId
    ? departments.find((department) => department.id === activeDepartmentId)
    : undefined;

  return (
    // data-revealed — стабильный, не хешируемый хук для тестов (CSS Modules хеширует классы, а
    // фактическое сокрытие через :global(.js) .hiddenUntilRevealed не воспроизводится в jsdom/
    // Vitest — визуальная проверка делается в e2e/Playwright, здесь проверяется структурный факт).
    <section className={sectionClassName} data-revealed={isRevealed}>
      <p className={styles.hint}>{interactionHint}</p>
      <OfficeSemanticMap
        departments={departments}
        officeZones={officeZones}
        onSelectDepartment={onSelectDepartment}
      />
      {activeDepartment && (
        <ActiveDepartmentPanel
          department={activeDepartment}
          machineView={machineView}
          onClose={onCloseDepartment}
        />
      )}
    </section>
  );
}
