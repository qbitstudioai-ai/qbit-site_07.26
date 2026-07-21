import type { ProcessStep, ProcessStepStatus } from "@/content/types";
import { RouteMarker } from "@/components/graphics/RouteMarker";
import styles from "./BeforeAfterSequence.module.css";

interface BeforeAfterSequenceProps {
  /** Шаги процесса «сейчас» (ручной ход с потерями). */
  beforeSteps: ProcessStep[];
  /** Шаги процесса «после автоматизации». */
  automationSteps: ProcessStep[];
  /** id заголовка блока — доступное имя региона (уникально на отдел). */
  headingId: string;
}

/**
 * Маркер шага, форма которого кодирует статус (Step 20).
 *
 * Смысл несёт ФОРМА, а не цвет (`CLAUDE.md`: «Meaning never relies only on colour»): треугольник —
 * проблема/внимание, галочка — решено. Цвет из палитры лишь усиливает форму (янтарь у «сейчас»,
 * шалфей у «после»), но по одному цвету статус не восстанавливается. aria-hidden: маркер —
 * визуальная половина, вторую половину несёт колонка («Сейчас»/«После автоматизации») текстом.
 */
function StepMarker({ status }: { status?: ProcessStepStatus }) {
  const shape =
    status === "success" ? (
      // Галочка — шаг «после»: работа доведена до результата.
      <polyline
        points="3.5,8.5 6.5,11.5 12.5,4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ) : status === "critical" ? (
      // Сплошной треугольник — критическая потеря (заявки теряются).
      <polygon points="8,2.5 14,13.5 2,13.5" fill="currentColor" />
    ) : status === "warning" ? (
      // Контурный треугольник — ручной шаг/риск.
      <polygon
        points="8,2.5 14,13.5 2,13.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="miter"
      />
    ) : (
      // Кольцо — нейтральный шаг без явного статуса.
      <circle cx="8" cy="8" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
    );

  return (
    <svg viewBox="0 0 16 16" role="presentation" aria-hidden="true" focusable="false">
      {shape}
    </svg>
  );
}

function StepList({ steps, phase }: { steps: ProcessStep[]; phase: "before" | "after" }) {
  return (
    <ol className={styles.steps}>
      {steps.map((step) => (
        <li key={step.id} className={styles.step}>
          <span className={`${styles.marker} ${styles[phase]}`}>
            <StepMarker status={step.status} />
          </span>
          <span className={styles.stepText}>
            <span className={styles.stepLabel}>{step.label}</span>
            <span className={styles.stepDescription}>{step.description}</span>
            {step.actor ? <span className={styles.stepActor}>{step.actor}</span> : null}
          </span>
        </li>
      ))}
    </ol>
  );
}

/**
 * Последовательность «до/после» отдела (Step 20, `docs/03` «BeforeAfterSequence»).
 *
 * Показывает трансформацию процесса: колонка «Сейчас» (ручной ход с потерями) → колонка «После
 * автоматизации». Это доказательство ценности — те самые «меньше потерянных заявок / быстрее ответ /
 * меньше ручной работы», ради которых продаётся продукт (`docs/06`).
 *
 * Форма — DOM/SVG-диаграмма (решение пользователя 2026-07-21), НЕ фото-сцены: точнее передаёт
 * конкретные шаги словами и не заводит второй механизм рендера сцены поверх `SceneCrossfade`
 * (инвариант Step 18). Компонент data-driven: работает для любого отдела с заполненными
 * `beforeSteps`/`automationSteps` (сегодня — только «Продажи», пилот Этапа 3; остальные — Этапы 4–7).
 *
 * Оба состояния и весь их текст присутствуют в дереве доступности ВСЕГДА и не зависят от анимации
 * (`CLAUDE.md`: «Critical content must not depend on animation completion»): анимируется только
 * декоративный коннектор между колонками, текст держится на opacity 1. reduced-motion гасит коннектор.
 */
export function BeforeAfterSequence({
  beforeSteps,
  automationSteps,
  headingId,
}: BeforeAfterSequenceProps) {
  return (
    <section className={styles.card} aria-labelledby={headingId}>
      <h3 id={headingId} className={styles.heading}>
        Как меняется работа
      </h3>
      <div className={styles.columns}>
        <div className={styles.column}>
          <p className={`${styles.columnHeading} ${styles.before}`}>Сейчас</p>
          <StepList steps={beforeSteps} phase="before" />
        </div>
        {/* Коннектор «сейчас → после» — единственный анимируемый элемент, декоративный (aria-hidden).
            Форма — тот же треугольник-маршрут логотипа, что и в рельсе (RouteMarker), ради единого
            графического языка. На ≤767px колонки встают друг под друга, и коннектор поворачивается
            вниз (CSS). */}
        <div className={styles.connector} aria-hidden="true">
          <RouteMarker direction="right" className={styles.connectorMarker} />
        </div>
        <div className={styles.column}>
          <p className={`${styles.columnHeading} ${styles.after}`}>После автоматизации</p>
          <StepList steps={automationSteps} phase="after" />
        </div>
      </div>
    </section>
  );
}
