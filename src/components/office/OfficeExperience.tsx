import { DepartmentExperience } from "@/components/departments/DepartmentExperience";
import type { Department, DepartmentId, OfficeZone } from "@/content/types";
import type { OfficeMachineView } from "@/features/office-machine/reducer";
import { DepartmentNavigationRail } from "./DepartmentNavigationRail";
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

  // Тот же порядок отделов (по officeZones y, затем x), что и в OfficeSemanticMap — общий для
  // хотспотов overview и для DepartmentNavigationRail, чтобы порядок отделов не расходился между
  // двумя состояниями (низкий риск, техническая деталь исполнения, см. WORKPLAN.md Step 6).
  const sortedDepartments = officeZones
    .slice()
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map((zone) => {
      const department = departments.find((d) => d.id === zone.departmentId);
      if (!department) {
        throw new Error(
          `OfficeExperience: no department found for zone.departmentId="${zone.departmentId}"`,
        );
      }
      return department;
    });

  return (
    // data-revealed — стабильный, не хешируемый хук для тестов (CSS Modules хеширует классы, а
    // фактическое сокрытие через :global(.js) .hiddenUntilRevealed не воспроизводится в jsdom/
    // Vitest — визуальная проверка делается в e2e/Playwright, здесь проверяется структурный факт).
    <section className={sectionClassName} data-revealed={isRevealed}>
      {activeDepartment ? (
        // 10/90-раскладка (Step 6): DepartmentExperience идёт первым в DOM (Tab: содержимое
        // 90%-области → 4 элемента rail), но визуально размещается справа через
        // grid-template-areas — порядок Tab не совпадает с визуальным порядком слева направо
        // (WORKPLAN.md Step 6 acceptance criterion 5).
        <div className={styles.shell10x90}>
          <div className={styles.mainArea}>
            <DepartmentExperience
              department={activeDepartment}
              machineView={machineView}
              onClose={onCloseDepartment}
            />
          </div>
          <div className={styles.railArea}>
            <DepartmentNavigationRail
              departments={sortedDepartments}
              activeDepartmentId={activeDepartment.id}
              onSelectDepartment={onSelectDepartment}
            />
          </div>
        </div>
      ) : (
        <>
          <p className={styles.hint}>{interactionHint}</p>
          <OfficeSemanticMap
            departments={departments}
            officeZones={officeZones}
            onSelectDepartment={onSelectDepartment}
          />
        </>
      )}
    </section>
  );
}
