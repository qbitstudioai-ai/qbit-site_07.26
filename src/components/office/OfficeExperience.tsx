import { DepartmentExperience } from "@/components/departments/DepartmentExperience";
import type { Department, OfficeZone } from "@/content/types";
import type { TaskSectionCopy } from "@/content/types";
import {
  TASK_SECTION_ID,
  type OfficeMachineView,
  type OfficeSectionId,
} from "@/features/office-machine/reducer";
import { TaskSectionExperience } from "@/components/task/TaskSectionExperience";
import { officeBackgroundPhoto } from "./departmentPhotos";
import { DepartmentNavigationRail } from "./DepartmentNavigationRail";
import { MobileDepartmentCarousel } from "./MobileDepartmentCarousel";
import { OfficePhoto } from "./OfficePhoto";
import { OfficeSemanticMap } from "./OfficeSemanticMap";
import styles from "./OfficeExperience.module.css";

interface OfficeExperienceProps {
  interactionHint: string;
  returnToOfficeLabel: string;
  /** Единый контакт сайта — прокидывается до CTA внутри отдела (Amendment 10). */
  contactHref: string;
  departments: Department[];
  officeZones: OfficeZone[];
  isRevealed: boolean;
  machineView: OfficeMachineView;
  activeSectionId: OfficeSectionId | null;
  /** Копирайт раздела «Ваша задача» (Step 12.7). */
  taskCopy: TaskSectionCopy;
  onSelectDepartment: (sectionId: OfficeSectionId) => void;
  onCloseDepartment: () => void;
  onReturnHome: () => void;
}

export function OfficeExperience({
  interactionHint,
  returnToOfficeLabel,
  contactHref,
  departments,
  officeZones,
  isRevealed,
  machineView,
  activeSectionId,
  taskCopy,
  onSelectDepartment,
  onCloseDepartment,
  onReturnHome,
}: OfficeExperienceProps) {
  const sectionClassName = isRevealed
    ? styles.office
    : `${styles.office} ${styles.hiddenUntilRevealed}`;

  const isTaskSectionActive = activeSectionId === TASK_SECTION_ID;
  const activeDepartment =
    activeSectionId && !isTaskSectionActive
      ? departments.find((department) => department.id === activeSectionId)
      : undefined;
  // 10/90-раскладка одна на все шесть разделов: пять отделов и «Ваша задача» отличаются только
  // содержимым 90%-области, поэтому шелл, рельс и переходы у них общие (Step 12.7).
  const hasActiveSection = Boolean(activeDepartment) || isTaskSectionActive;

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
      {hasActiveSection ? (
        // 10/90-раскладка (Step 6): DepartmentExperience идёт первым в DOM (Tab: содержимое
        // 90%-области → 4 элемента rail), но визуально размещается справа через
        // grid-template-areas — порядок Tab не совпадает с визуальным порядком слева направо
        // (WORKPLAN.md Step 6 acceptance criterion 5).
        <div className={styles.shell10x90}>
          {/* Step 7.3, docs/03 "Режим 10/90": общее фото офиса позади раскладки, затемнённое —
              "офис остаётся контекстом", не исчезает целиком, когда отдел открыт. Не рендерится
              в overview (см. docs/03 уточнение по OQ-P1) — монтируется только вместе с этой веткой,
              то есть лениво по отношению к самому открытию отдела. */}
          <OfficePhoto src={officeBackgroundPhoto} className={styles.backgroundPhoto} />
          <div className={styles.mainArea}>
            {activeDepartment ? (
              <DepartmentExperience
                department={activeDepartment}
                machineView={machineView}
                departments={sortedDepartments}
                contactHref={contactHref}
                onSelectDepartment={onSelectDepartment}
                onClose={onCloseDepartment}
              />
            ) : (
              <TaskSectionExperience
                copy={taskCopy}
                machineView={machineView}
                contactHref={contactHref}
                onClose={onCloseDepartment}
              />
            )}
          </div>
          <div className={styles.railArea}>
            <DepartmentNavigationRail
              departments={sortedDepartments}
              activeSectionId={activeSectionId}
              taskRailLabel={taskCopy.railLabel}
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
          {/* Step 12.7: вход в «Вашу задачу» стоит в ОДНОМ РЯДУ с «Выйти из офиса», а не отдельной
              строкой под сценой. Причина не косметическая: отдельная строка отнимала высоту у
              кадра сцены, и на низком desktop (docs/08) хотспоты проседали до 43px — ниже порога
              тап-таргета 44px (поймано e2e office-overview, а не замечено на глаз). В общем ряду
              кнопка не стоит ни одного лишнего пикселя по вертикали. */}
          <div className={styles.overviewActions}>
            <button type="button" className={styles.returnButton} onClick={onReturnHome}>
              {returnToOfficeLabel}
            </button>
            <button
              type="button"
              className={styles.taskEntryButton}
              onClick={() => onSelectDepartment(TASK_SECTION_ID)}
            >
              {taskCopy.overviewCtaLabel}
            </button>
          </div>
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
