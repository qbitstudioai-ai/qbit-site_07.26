import Image from "next/image";
import { DepartmentExperience } from "@/components/departments/DepartmentExperience";
import type { Department, DepartmentId, OfficeZone } from "@/content/types";
import type { OfficeMachineView } from "@/features/office-machine/reducer";
import { officeBackgroundPhoto } from "./departmentPhotos";
import { DepartmentNavigationRail } from "./DepartmentNavigationRail";
import { MobileDepartmentCarousel } from "./MobileDepartmentCarousel";
import { OfficeSemanticMap } from "./OfficeSemanticMap";
import styles from "./OfficeExperience.module.css";

interface OfficeExperienceProps {
  interactionHint: string;
  returnToOfficeLabel: string;
  departments: Department[];
  officeZones: OfficeZone[];
  isRevealed: boolean;
  machineView: OfficeMachineView;
  activeDepartmentId: DepartmentId | null;
  onSelectDepartment: (departmentId: DepartmentId) => void;
  onCloseDepartment: () => void;
  onReturnHome: () => void;
}

export function OfficeExperience({
  interactionHint,
  returnToOfficeLabel,
  departments,
  officeZones,
  isRevealed,
  machineView,
  activeDepartmentId,
  onSelectDepartment,
  onCloseDepartment,
  onReturnHome,
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
          {/* Step 7.3, docs/03 "Режим 10/90": общее фото офиса позади раскладки, затемнённое —
              "офис остаётся контекстом", не исчезает целиком, когда отдел открыт. Не рендерится
              в overview (см. docs/03 уточнение по OQ-P1) — монтируется только вместе с этой веткой,
              то есть лениво по отношению к самому открытию отдела. */}
          <Image
            src={officeBackgroundPhoto}
            alt=""
            fill
            unoptimized
            className={styles.backgroundPhoto}
          />
          <div className={styles.mainArea}>
            <DepartmentExperience
              department={activeDepartment}
              machineView={machineView}
              departments={sortedDepartments}
              onSelectDepartment={onSelectDepartment}
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
          {/* Возврат в hero — над картой отделов (докс. решение пользователя 2026-07-16: "над
              подразделениями, выше Дирекция"), не в Header. Виден только в overview: как только
              выбран отдел, эта ветка не рендерится вовсе (см. shell10x90 выше) — обратный путь из
              department-active идёт через уже существующую кнопку "Закрыть" в overview, затем сюда. */}
          <button type="button" className={styles.returnButton} onClick={onReturnHome}>
            {returnToOfficeLabel}
          </button>
          <p className={styles.hint}>{interactionHint}</p>
          <OfficeSemanticMap
            departments={departments}
            officeZones={officeZones}
            onSelectDepartment={onSelectDepartment}
          />
          <MobileDepartmentCarousel
            departments={sortedDepartments}
            onSelectDepartment={onSelectDepartment}
          />
        </>
      )}
    </section>
  );
}
