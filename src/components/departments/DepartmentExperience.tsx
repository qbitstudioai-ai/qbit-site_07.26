import { useState } from "react";
import { CarouselNavControls } from "@/components/office/CarouselNavControls";
import type { Department, DepartmentId } from "@/content/types";
import type { OfficeMachineView } from "@/features/office-machine/reducer";
import { DepartmentCopy } from "./DepartmentCopy";
import { DepartmentCTA } from "./DepartmentCTA";
import { MobilePainGainAccordion } from "./MobilePainGainAccordion";
import { PainGainPanel } from "./PainGainPanel";
import styles from "./DepartmentExperience.module.css";

interface DepartmentExperienceProps {
  department: Department;
  machineView: OfficeMachineView;
  departments: Department[];
  /** Единый контакт сайта — тот же, что у основного CTA в hero (Amendment 10). */
  contactHref: string;
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
  contactHref,
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

  // Step 15.5, исправление по skeptic Phase B (BLOCKING-1). Каскад обязан быть ОДНОСТОРОННЕЙ
  // защёлкой: показали блок — он больше не гаснет никогда.
  //
  // Первая редакция завершала каскад чистым CSS: `.experience:has(button:focus-visible) { animation:
  // none }`. Условие обратимо, а возврат `animation` по спецификации запускает анимацию ЗАНОВО —
  // вместе с `backwards`-fill, который снова держит opacity 0 всю задержку. Замер: после полностью
  // отыгранного каскада обычный Tab к рельсу гасил CTA и «Закрыть» ещё на 3 секунды, и так сколько
  // угодно раз. То есть правило, написанное ради клавиатурных пользователей, било именно по ним, и
  // хуже, чем буквальная реализация: та прятала кнопки один раз при открытии, эта — многократно
  // посреди работы.
  const [cascadeDone, setCascadeDone] = useState(false);

  // Защёлка ставится по одному из двух событий, что наступит раньше:
  //  • закончилась анимация последней ступени (нормальный ход каскада);
  //  • фокус пришёл на КОНТРОЛ внутри панели — пользователь пошёл по экрану с клавиатуры, и держать
  //    его контролы невидимыми нельзя. Именно контрол, а не любой элемент: при открытии отдела фокус
  //    программно уходит на <h2 tabindex="-1"> (docs/05), и замер показал, что заголовок матчит
  //    :focus-visible — реакция на него защёлкнула бы каскад до того, как он начался.
  const latchCascade = () => setCascadeDone(true);

  return (
    <section
      className={`${styles.experience} ${transitionClassName}`}
      aria-label={department.overviewLabel}
      data-cascade-done={cascadeDone}
      onFocus={(event) => {
        if ((event.target as HTMLElement).closest("a, button")) latchCascade();
      }}
    >
      {/* Step 15.5: каскад появления блоков, 1 с между соседями. Класс каскада вешается НА САМ
          корневой элемент блока, а не на обёртку вокруг него: у .copy есть `flex-shrink: 0` и
          `max-width: 60%`, и обёртка забрала бы себе роль flex-элемента — карточка начала бы
          сжиматься, а выравнивание заголовка по колонке болей (проверяется e2e) поехало бы.
          Перезапуск каскада при смене отдела обеспечивает key на самом DepartmentExperience
          (OfficeExperience.tsx): компонент перемонтируется целиком, поэтому и CSS-анимации
          стартуют заново, и защёлка cascadeDone сбрасывается. Отдельные key на блоках для этого не
          нужны — они бы лишь дублировали то, что уже делает key родителя. */}
      <DepartmentCopy department={department} className={styles.stageCopy} />
      {/* key={department.id} принудительно размонтирует/монтирует заново оба компонента при
          SWITCH_DEPARTMENT (OQ-P3) — DepartmentExperience сам НЕ размонтируется при переключении
          между отделами (в отличие от MobileDepartmentCarousel), поэтому без key их локальный
          useState (выбранный/раскрытый пункт боли) молча перенёс бы устаревший индекс с предыдущего
          отдела на новый (найдено при skeptic Phase A review, WORKPLAN.md Step 7.3). Оба компонента
          всегда в DOM одновременно — видимость переключает только CSS по ширине (тот же паттерн, что
          карта/карусель, Step 7). */}
      <PainGainPanel key={`desktop-${department.id}`} painPoints={department.painPoints} />
      <MobilePainGainAccordion key={`mobile-${department.id}`} painPoints={department.painPoints} />
      {/* Четвёртый блок каскада. Появляется последним ВИЗУАЛЬНО, но в DOM и в дереве доступности он
          с первого кадра: CTA и «Закрыть» кликабельны и достижимы клавиатурой всё это время
          (CLAUDE.md «CTA remains easy to reach», docs/07 про критические кнопки после анимации). */}
      <div className={`${styles.actions} ${styles.stageActions}`} onAnimationEnd={latchCascade}>
        <DepartmentCTA label={department.ctaLabel} href={contactHref} />
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
