import { useState } from "react";
import type { Department, DepartmentId } from "@/content/types";
import { CarouselNavControls } from "./CarouselNavControls";
import styles from "./MobileDepartmentCarousel.module.css";
import { MOBILE_CAROUSEL_CARD_ID } from "@/features/office-machine/focusTargets";

interface MobileDepartmentCarouselProps {
  departments: Department[];
  onSelectDepartment: (departmentId: DepartmentId) => void;
}

const PROBLEM_ID = "mobile-department-carousel-problem";

// Touch-путь для ≤767px (WORKPLAN.md Step 7, OQ-M3 = (b)): ровно одна карточка отдела за раз,
// переключение только через CarouselNavControls (Prev/Next), без свайпа (OQ-M2 = (b)). Локальное
// browse-состояние (previewIndex) — не office-machine: сам просмотр карточек не диспетчерит
// SELECT_DEPARTMENT, не меняет URL и не переводит машину из "overview" — только явный тап/Enter/
// Space по текущей карточке открывает отдел. previewIndex естественно сбрасывается к 0 при каждом
// новом входе в overview, так как вся overview-ветка размонтируется/монтируется заново при переходе
// в/из department-active (OfficeExperience.tsx) — это ожидаемое поведение (см. AC 17), не баг.
export function MobileDepartmentCarousel({
  departments,
  onSelectDepartment,
}: MobileDepartmentCarouselProps) {
  const [previewIndex, setPreviewIndex] = useState(0);

  const total = departments.length;
  const currentDepartment = departments[previewIndex];
  const previousIndex = (previewIndex - 1 + total) % total;
  const nextIndex = (previewIndex + 1) % total;
  const previousDepartment = departments[previousIndex];
  const nextDepartment = departments[nextIndex];

  return (
    <nav aria-label="Карусель отделов" className={styles.carousel}>
      {/* id стабильный, НЕ привязан к department.id — карусель всегда рендерит ровно одну карточку с
          этим id, независимо от того, какой отдел она сейчас показывает. Требуется для
          focus-restoration fallback в OfficeMachine.tsx (см. WORKPLAN.md Step 7, AC 6): привязка id к
          конкретному отделу ломалась бы для 4 из 5 отделов, так как карусель всегда сбрасывается на
          первый отдел при возврате в overview. */}
      <button
        type="button"
        id={MOBILE_CAROUSEL_CARD_ID}
        className={styles.card}
        aria-label={currentDepartment.overviewLabel}
        aria-describedby={PROBLEM_ID}
        onClick={() => onSelectDepartment(currentDepartment.id)}
      >
        <span className={styles.label}>{currentDepartment.overviewLabel}</span>
        <span id={PROBLEM_ID} className={styles.problem}>
          {currentDepartment.overviewProblem}
        </span>
      </button>
      <CarouselNavControls
        previousLabel={`Предыдущий отдел: ${previousDepartment.overviewLabel}`}
        nextLabel={`Следующий отдел: ${nextDepartment.overviewLabel}`}
        onPrevious={() => setPreviewIndex(previousIndex)}
        onNext={() => setPreviewIndex(nextIndex)}
      />
    </nav>
  );
}
