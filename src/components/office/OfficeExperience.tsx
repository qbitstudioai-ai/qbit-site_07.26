import { useEffect } from "react";
import { DepartmentExperience } from "@/components/departments/DepartmentExperience";
import type {
  Department,
  OfficeOverviewCopy,
  OfficeOverviewStory,
  OfficeZone,
  TaskSectionCopy,
} from "@/content/types";
import type { OfficeMachineView, OfficeSectionId } from "@/features/office-machine/reducer";
import { TaskSectionExperience } from "@/components/task/TaskSectionExperience";
import {
  OFFICE_SCENE_SIZES,
  OFFICE_SCENE_WIDTHS,
  officeSceneById,
  type OfficeSceneId,
} from "./departmentPhotos";
import { DepartmentNavigationRail } from "./DepartmentNavigationRail";
import { SceneCrossfade } from "./SceneCrossfade";
import { OfficeSemanticMap } from "./OfficeSemanticMap";
import styles from "./OfficeExperience.module.css";
import { TASK_ENTRY_BUTTON_ID } from "@/features/office-machine/focusTargets";
import { buildOfficeSections } from "@/features/office-machine/sections";

interface OfficeExperienceProps {
  interactionHint: string;
  /** Контент трёхколоночного обзорного экрана. В production всегда передаётся из homepage-copy. */
  officeOverview?: OfficeOverviewCopy;
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

interface OverviewStoryProps {
  story: OfficeOverviewStory;
  side: "left" | "right";
}

const preloadedDepartmentScenes = new Set<OfficeSceneId>();
const departmentScenePreloadImages: HTMLImageElement[] = [];

function preloadDepartmentScene(sceneId: OfficeSceneId) {
  if (sceneId === "overview" || preloadedDepartmentScenes.has(sceneId)) return;
  preloadedDepartmentScenes.add(sceneId);

  const sources = officeSceneById[sceneId].avif;
  const image = new Image();
  image.decoding = "async";
  image.fetchPriority = "low";
  image.sizes = OFFICE_SCENE_SIZES;
  image.srcset = sources
    .map((source, index) => `${source.src} ${OFFICE_SCENE_WIDTHS[index]}w`)
    .join(", ");
  image.src = sources[sources.length - 1].src;

  // Сохраняем ссылку на объект до конца сессии: браузер не должен отменить low-priority запрос
  // из-за сборки временного Image до того, как ресурс окажется в HTTP-кэше.
  departmentScenePreloadImages.push(image);
}

function OverviewStory({ story, side }: OverviewStoryProps) {
  const headingId = `office-overview-story-${side}`;

  return (
    <aside
      className={`${styles.asideSlot} ${styles.story} ${side === "right" ? styles.storyWarm : ""}`}
      aria-labelledby={headingId}
      data-overview-slot={side}
    >
      <div className={styles.storyInner}>
        <p id={headingId} className={styles.storyTitle}>
          {story.title}
        </p>
        {story.paragraphs.map((paragraph) => (
          <p key={paragraph} className={styles.storyParagraph}>
            {paragraph}
          </p>
        ))}
      </div>
    </aside>
  );
}

export function OfficeExperience({
  interactionHint,
  officeOverview,
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
  useEffect(() => {
    if (!isRevealed) return;

    const preload = () => {
      for (const department of departments) {
        preloadDepartmentScene(department.id as OfficeSceneId);
      }
    };

    // Активный кадр остаётся приоритетным. Остальные пять сцен прогреваются в idle-окне, но не
    // позднее 800 мс, чтобы первое переключение отдела уже попадало в кэш.
    if ("requestIdleCallback" in window) {
      const idleId = window.requestIdleCallback(preload, { timeout: 800 });
      return () => window.cancelIdleCallback(idleId);
    }

    const timerId = globalThis.setTimeout(preload, 0);
    return () => globalThis.clearTimeout(timerId);
  }, [departments, isRevealed]);

  const sectionClassName = isRevealed
    ? styles.office
    : `${styles.office} ${styles.hiddenUntilRevealed}`;

  // Тот же порядок отделов (по officeZones y, затем x), что и в OfficeSemanticMap — общий для
  // хотспотов overview и для DepartmentNavigationRail, чтобы порядок отделов не расходился между
  // двумя состояниями (низкий риск, техническая деталь исполнения, см. WORKPLAN.md Step 6).
  // Зона без отдела пропускается, а не роняет рендер: отдел мог быть снят с публикации в
  // админ-панели. Согласование делает `HomepageShell`; здесь — второй рубеж, чтобы никакой будущий
  // вызывающий не смог обрушить главную страницу рассогласованными данными.
  const sortedDepartments = officeZones
    .slice()
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map((zone) => departments.find((d) => d.id === zone.departmentId))
    .filter((department): department is (typeof departments)[number] => department !== undefined);

  // Реестр разделов (Step 18) — единственный источник знания «какие разделы бывают и что о них
  // известно». До него сцена, содержимое 90%-области, пункт рельса и цель возврата фокуса решались
  // отдельными ветками `activeSectionId === TASK_SECTION_ID` в четырёх файлах.
  const sections = buildOfficeSections(sortedDepartments, taskCopy);
  const activeSection = sections.find((section) => section.id === activeSectionId);

  // 10/90-раскладка одна на все разделы: они отличаются только содержимым 90%-области, поэтому
  // шелл, рельс и переходы у них общие (Step 12.7).
  const hasActiveSection = Boolean(activeSection);

  // Сцена позади раскладки (Step 13). Какая именно — записано в реестре: у отдела своя, у раздела
  // иного рода остаётся мастер-сцена overview, то есть офис как общий контекст.
  const activeSceneId = (activeSection?.sceneId ?? "overview") as OfficeSceneId;

  const activeDepartment =
    activeSection?.kind === "department"
      ? sortedDepartments.find((department) => department.id === activeSection.id)
      : undefined;

  return (
    // data-revealed — стабильный, не хешируемый хук для тестов (CSS Modules хеширует классы, а
    // фактическое сокрытие через :global(.js) .hiddenUntilRevealed не воспроизводится в jsdom/
    // Vitest — визуальная проверка делается в e2e/Playwright, здесь проверяется структурный факт).
    <section
      className={sectionClassName}
      data-revealed={isRevealed}
      data-office-mode={hasActiveSection ? "section" : "overview"}
    >
      {hasActiveSection ? null : (
        <>
          {/* Возврат в hero — над картой отделов (докс. решение пользователя 2026-07-16: "над
              подразделениями, выше Дирекция"), не в Header. Виден только в overview. */}
          {/* Amendment 30: возврат, спокойная инструкция и коммерческий CTA образуют один
              семантически и визуально общий ряд. Это освобождает высоту прежней второй строки,
              не меняя геометрию сцены, зон или путь Telegram. */}
          <div className={styles.overviewControls} data-overview-controls>
            <a
              href="#hero-heading"
              className={styles.returnButton}
              onClick={(event) => {
                event.preventDefault();
                onReturnHome();
              }}
            >
              {returnToOfficeLabel}
            </a>
            {officeOverview ? (
              <p className={styles.instructionTitle}>
                <span className={styles.instructionMark} aria-hidden="true" />
                {officeOverview.instruction}
              </p>
            ) : null}
            <a
              id={TASK_ENTRY_BUTTON_ID}
              className={styles.taskEntryButton}
              href={contactHref}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={officeOverview?.ctaAccessibleLabel ?? taskCopy.overviewCtaLabel}
            >
              {taskCopy.overviewCtaLabel}
            </a>
          </div>
          <p className={styles.hint}>{interactionHint}</p>
        </>
      )}

      {/* ОБЩИЙ СЦЕН-СЛОЙ (Step 18). Живёт ВНЕ ветки активного раздела и потому переживает открытие
          и закрытие отдела — в этом весь смысл шага.

          До этого сцену рисовали ДВА независимых места: overview — своим фотослоем внутри карты
          офиса, department-active — контейнером перехода внутри 10/90-раскладки. При открытии
          отдела первая ветка размонтировалась целиком, вторая монтировалась заново, и удерживать
          предыдущий кадр было НЕЧЕМ: измерено 89–138 мс белого экрана на localhost, 378/759/1444 мс
          при задержках 300/600/1200 мс и 863 мс на мобильном Fast 3G. Это ровно тот дефект, ради
          которого делался Amendment 15, на другом конце пути — и ни один из трёх его сторожей не
          мог его увидеть, потому что все они входят сразу в отдел и щупают путь отдел→отдел.

          Теперь кадр принадлежит одному слою, а состояния офиса отвечают только за то, что лежит
          ПОВЕРХ него: overview — за пять зон, department-active — за 10/90-раскладку. Переход между
          состояниями стал сменой сцены внутри живого контейнера, то есть обычным случаем
          SceneCrossfade, который он уже умеет держать.

          «Ваша задача» — не отдел и своей сцены не имеет: под ней остаётся мастер-сцена overview,
          то есть офис как общий контекст (Step 12.7). Следствие подъёма: вход в этот раздел с
          overview теперь вообще не меняет сцену, поэтому и перехода не играет.

          В DOM по-прежнему попадают ТОЛЬКО активная и предыдущая сцены. По прямому ТЗ Amendment 31
          остальные сцены отделов после раскрытия офиса прогреваются low-priority запросами в
          idle-окне: это не создаёт скрытых фотослоёв, но убирает паузу первого переключения. */}
      <div className={styles.stageRow} data-stage-mode={hasActiveSection ? "section" : "overview"}>
        {/* Забронированные места под будущий текст слева и справа от сцены (запрос пользователя
            2026-07-18, см. WORKPLAN.md Amendment 9). Сейчас они пустые и НИЧЕГО не рисуют: видимая
            заглушка с рамкой читалась бы как недоделанный интерфейс. Они занимают поля, которые и
            так пустуют — кадр сцены ограничен по высоте, а не по ширине, поэтому колонки забирают
            свободную ширину и сцену не сжимают. На ширинах < 1280px и в department-active колонки
            схлопываются (см. .module.css). */}
        {!hasActiveSection && officeOverview ? (
          <OverviewStory story={officeOverview.leftStory} side="left" />
        ) : (
          <div className={styles.asideSlot} data-overview-slot="left" />
        )}
        <div className={styles.officeCenter} data-office-center>
          <div className={styles.stage}>
            {/* Step 13: позади раскладки — сцена ИМЕННО ЭТОГО отдела, а не одно общее фото офиса
              (пересмотр решения docs/03 "Режим 10/90" по OQ-A2-8). Переключение отдела меняет
              источник, поэтому браузер грузит другой файл — это и создаёт ощущение перехода между
              отделами, ради которого шаг пересмотрен (Amendment 8).
              Step 16: два слоя вместо одного — SceneCrossfade держит предыдущую сцену до готовности
              следующей, поэтому переход идёт между двумя кадрами, а не через дыру. Сброс состояния
              «загрузка провалилась» при смене сцены сохранён: key живёт внутри SceneCrossfade, на
              каждом из слоёв. */}
            <SceneCrossfade
              sceneId={activeSceneId}
              // ОДИН `sizes` на оба состояния — не упрощение: слой персистентный, и менять этот
              // атрибут пришлось бы прямо во время удержания кадра. Разбор, включая наблюдение об
              // обнулении кадра и его границы, — в док-комментарии OFFICE_SCENE_SIZES.
              sizes={OFFICE_SCENE_SIZES}
              photoClassName={styles.stagePhoto}
            />
            {hasActiveSection ? (
              // 10/90-раскладка (Step 6): DepartmentExperience идёт первым в DOM (Tab: содержимое
              // 90%-области → 4 элемента rail), но визуально размещается справа через
              // grid-template-areas — порядок Tab не совпадает с визуальным порядком слева направо
              // (WORKPLAN.md Step 6 acceptance criterion 5).
              <div className={styles.shell10x90}>
                <div className={styles.mainArea}>
                  {activeDepartment ? (
                    // key — перезапуск каскада Step 15.5 при переключении отдела. DepartmentExperience
                    // сам по себе при SWITCH_DEPARTMENT не размонтируется, поэтому без key ни
                    // CSS-анимации ступеней не стартовали бы заново, ни защёлка cascadeDone не
                    // сбрасывалась бы: каскад играл бы только при первом открытии офиса.
                    <DepartmentExperience
                      key={activeDepartment.id}
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
                  <div className={styles.railStack}>
                    <button
                      type="button"
                      className={styles.departmentBackButton}
                      onClick={onCloseDepartment}
                    >
                      <span className={styles.departmentBackArrow} aria-hidden="true">
                        ←
                      </span>
                      Назад к офису
                    </button>
                    <DepartmentNavigationRail
                      departments={sortedDepartments}
                      activeSectionId={activeSectionId}
                      taskCopy={taskCopy}
                      onSelectDepartment={onSelectDepartment}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <OfficeSemanticMap
                departments={departments}
                officeZones={officeZones}
                onSelectDepartment={onSelectDepartment}
              />
            )}
          </div>
        </div>
        {!hasActiveSection && officeOverview ? (
          <OverviewStory story={officeOverview.rightStory} side="right" />
        ) : (
          <div className={styles.asideSlot} data-overview-slot="right" />
        )}
      </div>
    </section>
  );
}
