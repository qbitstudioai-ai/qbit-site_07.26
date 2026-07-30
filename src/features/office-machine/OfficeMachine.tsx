"use client";

import { useEffect, useMemo, useReducer, useRef } from "react";
import { Header } from "@/components/homepage/Header";
import { HeroCopy } from "@/components/homepage/HeroCopy";
import { HeroInfoPanel } from "@/components/homepage/HeroInfoPanel";
import { HeroOfficeVisual } from "@/components/homepage/HeroOfficeVisual";
import { OfficeExperience } from "@/components/office/OfficeExperience";
import type { Department, HomepageCopy, OfficeZone } from "@/content/types";
import type { ContactChannel } from "@/features/contacts/contactData";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import styles from "./OfficeMachine.module.css";
import { initOfficeMachineState, officeMachineReducer, type OfficeSectionId } from "./reducer";
import { OVERVIEW_MAP_FIRST_CONTROL, sectionHeadingId } from "./focusTargets";
import { buildOfficeSections, closeReturnCandidateIds } from "./sections";
import { useDepartmentUrlSync } from "./url-sync";

// Ориентировочная длительность (docs/07-motion-system.md "Уровень Transition") — книгоучёт для
// focus-management/CSS-классов, не строгий acceptance-критерий.
const OPEN_DURATION_MS = 800;
const SWITCH_DURATION_MS = 600;
const CLOSE_DURATION_MS = 700;

// Step 8. Прежний комментарий здесь утверждал, что под prefers-reduced-motion эти таймеры "лишь
// продвигают view вперёд, не блокируя доступность контента". Это было неверно, и правится не
// косметически, а по факту: CSS обнуляется глобально (globals.css), поэтому под reduce fade-out
// отрабатывал мгновенно — а CLOSE_COMPLETE всё равно приходил через 700 мс. Пользователь с reduce
// видел пустую 90%-область эти 700 мс и столько же ждал возврата focus на хотспот. Ровно то, что
// запрещают docs/07 ("критические кнопки после длинной анимации", "оставить все функции"),
// docs/05 (инвариант "reduced motion сохраняет функции") и CLAUDE.md Motion rules ("Critical content
// must not depend on animation completion"). Под reduce длительности схлопываются в 0: переход
// остаётся асинхронным (setTimeout 0 — состояние не меняется во время рендера), но незаметным.
function resolveDurationMs(durationMs: number, prefersReducedMotion: boolean): number {
  return prefersReducedMotion ? 0 : durationMs;
}

interface OfficeMachineProps {
  copy: HomepageCopy;
  departments: Department[];
  officeZones: OfficeZone[];
  contactChannels: ContactChannel[];
  initialRevealed: boolean;
  initialSectionId: OfficeSectionId | null;
}

export function OfficeMachine({
  copy,
  departments,
  officeZones,
  contactChannels,
  initialRevealed,
  initialSectionId,
}: OfficeMachineProps) {
  const [state, dispatch] = useReducer(
    officeMachineReducer,
    { initialRevealed, initialSectionId },
    initOfficeMachineState,
  );

  useDepartmentUrlSync(state.activeSectionId);

  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (state.view === "department-opening") {
      const timer = setTimeout(
        () => dispatch({ type: "OPEN_COMPLETE" }),
        resolveDurationMs(OPEN_DURATION_MS, prefersReducedMotion),
      );
      return () => clearTimeout(timer);
    }
    if (state.view === "department-switching") {
      const timer = setTimeout(
        () => dispatch({ type: "SWITCH_COMPLETE" }),
        resolveDurationMs(SWITCH_DURATION_MS, prefersReducedMotion),
      );
      return () => clearTimeout(timer);
    }
    if (state.view === "department-closing") {
      const timer = setTimeout(
        () => dispatch({ type: "CLOSE_COMPLETE" }),
        resolveDurationMs(CLOSE_DURATION_MS, prefersReducedMotion),
      );
      return () => clearTimeout(timer);
    }
  }, [state.view, prefersReducedMotion]);

  // Escape закрывает активный отдел из любого department-*-состояния (docs/11).
  useEffect(() => {
    if (state.activeSectionId === null) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        dispatch({ type: "ESCAPE" });
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [state.activeSectionId]);

  // Реестр разделов (Step 18) — источник знания о том, какой контрол открыл раздел. useMemo, а не
  // вычисление внутри эффекта: иначе новый массив на каждый рендер попадал бы в зависимости эффекта
  // и перезапускал бы перенос фокуса на ровном месте.
  const sections = useMemo(
    () => buildOfficeSections(departments, copy.taskSection),
    [departments, copy.taskSection],
  );

  const previousActiveIdRef = useRef<OfficeSectionId | null>(null);
  const lastNonNullActiveIdRef = useRef<OfficeSectionId | null>(null);
  const previousViewRef = useRef(state.view);

  useEffect(() => {
    const previousView = previousViewRef.current;
    previousViewRef.current = state.view;

    // Focus переносится на заголовок открытого/переключённого отдела (docs/05 department-opening,
    // docs/11) — срабатывает и при открытии из overview, и при переключении между отделами.
    if (state.activeSectionId && state.activeSectionId !== previousActiveIdRef.current) {
      document
        .getElementById(sectionHeadingId(state.activeSectionId))
        ?.focus({ preventScroll: true });
    }
    if (state.activeSectionId) {
      lastNonNullActiveIdRef.current = state.activeSectionId;
    }
    previousActiveIdRef.current = state.activeSectionId;

    // Focus возвращается на контрол, который раздел ОТКРЫЛ, после завершения закрытия
    // (docs/11 "после закрытия focus возвращается"). Список кандидатов и их порядок живут в
    // focusTargets.ts вместе со схемой id — см. там же разбор дефекта, из-за которого этот код
    // отправлял фокус на <body> при закрытии «Вашей задачи». offsetParent !== null — дешёвая
    // проверка видимости, без CSS-breakpoint проверки/matchMedia (WORKPLAN.md Step 7, AC 6).
    //
    // Step 15 / Amendment 13 изменил не этот код, а факт, на который он опирался. Прежняя редакция
    // комментария объясняла порядок кандидатов тем, что «на ≤767px OfficeSemanticMap скрыта
    // (display:none)» — с Amendment 13 карта на мобильном видима, поэтому первый кандидат срабатывает
    // на ВСЕХ ширинах, и focus возвращается на зону закрытого отдела везде одинаково. Карусельный
    // кандидат остаётся живым фолбэком для случая, когда карта не отрисована, но сегодня ни один
    // e2e до него не доходит (честно записано в WORKLOG Step 15).
    if (state.view === "overview" && previousView === "department-closing") {
      const returnId = lastNonNullActiveIdRef.current;
      if (returnId) {
        const target = closeReturnCandidateIds(sections, returnId)
          .map((id) => document.getElementById(id))
          .find((el): el is HTMLElement => el !== null && el.offsetParent !== null);
        target?.focus({ preventScroll: true });
      }
    }

    // Step 7.2: hero скрывается сразу после ACTIVATE_CTA — без переноса focus он терялся бы на
    // <body> (docs/11 "Focus"). Тот же принцип "перебрать кандидатов, взять первый видимый", что и
    // close-fallback выше. Порядок кандидатов совпадает с порядком чтения: карта идёт раньше
    // карусели в DOM, поэтому со Step 15 / Amendment 13 (карта видима и на мобильном) focus
    // попадает на первую зону сцены на всех ширинах. Обратный порядок отправил бы пользователя в
    // конец экрана, откуда до сцены пришлось бы возвращаться Shift+Tab.
    if (state.view === "overview" && previousView === "hero") {
      const candidates = [document.querySelector<HTMLElement>(OVERVIEW_MAP_FIRST_CONTROL)];
      const target = candidates.find(
        (el): el is HTMLElement => el !== null && el.offsetParent !== null,
      );
      target?.focus({ preventScroll: true });
    }

    // Возврат в hero — focus переносится на заголовок hero, тем же принципом, что и открытие отдела
    // (focus на department-heading-<id>): пользователь должен ощутить, что оказался на новом экране,
    // а не потерять focus на <body>. Точек входа две, и обе идут через RETURN_TO_HERO: кнопка
    // "Выйти из офиса" в OfficeExperience (над картой отделов, Step 7.4) и логотип в Header
    // (Step 7.6) — этот эффект покрывает обе, отдельной логики на каждую не нужно.
    if (state.view === "hero" && previousView !== "hero") {
      document.getElementById("hero-heading")?.focus({ preventScroll: true });
    }
  }, [state.view, state.activeSectionId, sections]);

  const handleActivateCta = () => dispatch({ type: "ACTIVATE_CTA" });
  const handleReturnToHero = () => dispatch({ type: "RETURN_TO_HERO" });

  // Со Step 12.7 выбирается не только отдел, но и раздел «Ваша задача» — отсюда OfficeSectionId.
  const handleSelectDepartment = (departmentId: OfficeSectionId) => {
    if (state.activeSectionId === null) {
      dispatch({ type: "SELECT_DEPARTMENT", departmentId });
    } else {
      dispatch({ type: "SWITCH_DEPARTMENT", departmentId });
    }
  };

  const handleCloseDepartment = () => dispatch({ type: "CLOSE_DEPARTMENT" });

  return (
    <>
      <Header
        links={copy.heroLinks}
        phoneLabel={copy.headerPhone}
        phoneHref={copy.headerPhoneHref}
        phoneAccessibleLabel={copy.headerPhoneAccessibleLabel}
        onReturnHome={handleReturnToHero}
      />
      <main className={styles.main}>
        {/* Раскладка hero (Amendment 26): офисный visual проходит широким нижним слоем под продающим
            блоком и двумя floating-карточками. На узких ширинах — одна колонка в том же порядке.
            heroGrid скрывается ЦЕЛИКОМ после входа в офис (heroGridHidden), иначе как flex-элемент
            main он держал бы место и не давал OfficeExperience занять экран. HeroCopy получает тот
            же флаг сокрытия для no-JS-совместимости и существующей unit-проверки. */}
        <div
          data-hero-grid
          className={
            state.view !== "hero" ? `${styles.heroGrid} ${styles.heroGridHidden}` : styles.heroGrid
          }
        >
          <div className={styles.heroVisualCell}>
            <HeroOfficeVisual />
          </div>
          <div className={styles.heroCopyCell}>
            <HeroCopy
              copy={copy}
              onActivate={handleActivateCta}
              isHiddenAfterReveal={state.view !== "hero"}
            />
          </div>
          <div className={styles.heroInfoCell}>
            <HeroInfoPanel copy={copy.heroInfoPanel} contactHref={copy.contactHref} />
          </div>
        </div>
        <OfficeExperience
          interactionHint={copy.interactionHint}
          officeOverview={copy.officeOverview}
          returnToOfficeLabel={copy.returnToOfficeLabel}
          contactHref={copy.contactHref}
          taskCopy={copy.taskSection}
          departments={departments}
          officeZones={officeZones}
          contactChannels={contactChannels}
          isRevealed={state.view !== "hero"}
          machineView={state.view}
          activeSectionId={state.activeSectionId}
          onSelectDepartment={handleSelectDepartment}
          onCloseDepartment={handleCloseDepartment}
          onReturnHome={handleReturnToHero}
        />
      </main>
    </>
  );
}
