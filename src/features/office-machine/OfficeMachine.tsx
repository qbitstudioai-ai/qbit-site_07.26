"use client";

import { useEffect, useReducer, useRef } from "react";
import { Header } from "@/components/homepage/Header";
import { HeroCopy } from "@/components/homepage/HeroCopy";
import { OfficeExperience } from "@/components/office/OfficeExperience";
import type { Department, DepartmentId, HomepageCopy, OfficeZone } from "@/content/types";
import styles from "./OfficeMachine.module.css";
import { initOfficeMachineState, officeMachineReducer } from "./reducer";
import { useDepartmentUrlSync } from "./url-sync";

// Ориентировочная длительность (docs/07-motion-system.md "Уровень Transition") — книгоучёт для
// focus-management/CSS-классов, не строгий acceptance-критерий; под prefers-reduced-motion реальная
// CSS transition/animation обнуляется глобально (globals.css), эти таймеры лишь продвигают
// наблюдаемый `view` вперёд по docs/05, не блокируя доступность контента (Motion rules CLAUDE.md).
const OPEN_DURATION_MS = 800;
const SWITCH_DURATION_MS = 600;
const CLOSE_DURATION_MS = 700;

interface OfficeMachineProps {
  copy: HomepageCopy;
  departments: Department[];
  officeZones: OfficeZone[];
  initialRevealed: boolean;
  initialDepartmentId: DepartmentId | null;
}

export function OfficeMachine({
  copy,
  departments,
  officeZones,
  initialRevealed,
  initialDepartmentId,
}: OfficeMachineProps) {
  const [state, dispatch] = useReducer(
    officeMachineReducer,
    { initialRevealed, initialDepartmentId },
    initOfficeMachineState,
  );

  useDepartmentUrlSync(state.activeDepartmentId);

  useEffect(() => {
    if (state.view === "department-opening") {
      const timer = setTimeout(() => dispatch({ type: "OPEN_COMPLETE" }), OPEN_DURATION_MS);
      return () => clearTimeout(timer);
    }
    if (state.view === "department-switching") {
      const timer = setTimeout(() => dispatch({ type: "SWITCH_COMPLETE" }), SWITCH_DURATION_MS);
      return () => clearTimeout(timer);
    }
    if (state.view === "department-closing") {
      const timer = setTimeout(() => dispatch({ type: "CLOSE_COMPLETE" }), CLOSE_DURATION_MS);
      return () => clearTimeout(timer);
    }
  }, [state.view]);

  // Escape закрывает активный отдел из любого department-*-состояния (docs/11).
  useEffect(() => {
    if (state.activeDepartmentId === null) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        dispatch({ type: "ESCAPE" });
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [state.activeDepartmentId]);

  const previousActiveIdRef = useRef<DepartmentId | null>(null);
  const lastNonNullActiveIdRef = useRef<DepartmentId | null>(null);
  const previousViewRef = useRef(state.view);

  useEffect(() => {
    const previousView = previousViewRef.current;
    previousViewRef.current = state.view;

    // Focus переносится на заголовок открытого/переключённого отдела (docs/05 department-opening,
    // docs/11) — срабатывает и при открытии из overview, и при переключении между отделами.
    if (state.activeDepartmentId && state.activeDepartmentId !== previousActiveIdRef.current) {
      document
        .getElementById(`department-heading-${state.activeDepartmentId}`)
        ?.focus({ preventScroll: true });
    }
    if (state.activeDepartmentId) {
      lastNonNullActiveIdRef.current = state.activeDepartmentId;
    }
    previousActiveIdRef.current = state.activeDepartmentId;

    // Focus возвращается на кнопку-хотспот, которая открыла отдел, после завершения закрытия
    // (docs/11 "после закрытия focus возвращается"). На ≤767px OfficeSemanticMap скрыта
    // (display:none) — .focus() на скрытом элементе no-op, поэтому пробуем по очереди: (1)
    // hotspot-<id> (сработает на Desktop/Tablet, где карта видима); (2) стабильный
    // mobile-department-carousel-card (сработает на mobile — карусель после сброса на первый отдел
    // всегда рендерит этот id). offsetParent !== null — дешёвая проверка видимости, без CSS-brekpoint
    // проверки/matchMedia (WORKPLAN.md Step 7, AC 6).
    if (state.view === "overview" && previousView === "department-closing") {
      const returnId = lastNonNullActiveIdRef.current;
      if (returnId) {
        const candidateIds = [`hotspot-${returnId}`, "mobile-department-carousel-card"];
        const target = candidateIds
          .map((id) => document.getElementById(id))
          .find((el): el is HTMLElement => el !== null && el.offsetParent !== null);
        target?.focus({ preventScroll: true });
      }
    }

    // Step 7.2: hero скрывается сразу после ACTIVATE_CTA — без переноса focus он терялся бы на
    // <body> (docs/11 "Focus"). Тот же принцип "перебрать кандидатов, взять первый видимый", что и
    // close-fallback выше: первая кнопка карты (Desktop/Tablet) либо карточка карусели (Mobile).
    if (state.view === "overview" && previousView === "hero") {
      const candidates = [
        document.querySelector<HTMLElement>('[aria-label="Отделы компании"] button'),
        document.getElementById("mobile-department-carousel-card"),
      ];
      const target = candidates.find(
        (el): el is HTMLElement => el !== null && el.offsetParent !== null,
      );
      target?.focus({ preventScroll: true });
    }

    // Возврат в hero (кнопка "Выйти из офиса" в OfficeExperience, над картой отделов) — focus
    // переносится на заголовок hero, тем же принципом, что и открытие отдела (focus на
    // department-heading-<id>): пользователь должен ощутить, что оказался на новом экране, а не
    // потерять focus на <body>.
    if (state.view === "hero" && previousView !== "hero") {
      document.getElementById("hero-heading")?.focus({ preventScroll: true });
    }
  }, [state.view, state.activeDepartmentId]);

  const handleActivateCta = () => dispatch({ type: "ACTIVATE_CTA" });
  const handleReturnToHero = () => dispatch({ type: "RETURN_TO_HERO" });

  const handleSelectDepartment = (departmentId: DepartmentId) => {
    if (state.activeDepartmentId === null) {
      dispatch({ type: "SELECT_DEPARTMENT", departmentId });
    } else {
      dispatch({ type: "SWITCH_DEPARTMENT", departmentId });
    }
  };

  const handleCloseDepartment = () => dispatch({ type: "CLOSE_DEPARTMENT" });

  return (
    <>
      <Header tagline={copy.tagline} />
      <main className={styles.main}>
        <HeroCopy
          copy={copy}
          onActivate={handleActivateCta}
          isHiddenAfterReveal={state.view !== "hero"}
        />
        <OfficeExperience
          interactionHint={copy.interactionHint}
          returnToOfficeLabel={copy.returnToOfficeLabel}
          departments={departments}
          officeZones={officeZones}
          isRevealed={state.view !== "hero"}
          machineView={state.view}
          activeDepartmentId={state.activeDepartmentId}
          onSelectDepartment={handleSelectDepartment}
          onCloseDepartment={handleCloseDepartment}
          onReturnHome={handleReturnToHero}
        />
      </main>
    </>
  );
}
