import styles from "./CarouselNavControls.module.css";

interface CarouselNavControlsProps {
  previousLabel: string;
  nextLabel: string;
  onPrevious: () => void;
  onNext: () => void;
}

// Презентационный, без собственной бизнес-логики (WORKPLAN.md Step 7) — переиспользуется в двух
// местах с разной семантикой действия: MobileDepartmentCarousel (overview, локальный browse, без
// диспетча в редьюсер) и DepartmentExperience (department-active, реальный SWITCH_DEPARTMENT).
// Видим только на ≤767px (CSS media query внутри .module.css); клавиатурная активация — нативная
// Enter/Space семантика <button>, отдельный keydown-обработчик не нужен.
export function CarouselNavControls({
  previousLabel,
  nextLabel,
  onPrevious,
  onNext,
}: CarouselNavControlsProps) {
  return (
    <div className={styles.controls}>
      <button
        type="button"
        className={styles.navButton}
        aria-label={previousLabel}
        onClick={onPrevious}
      >
        ← Назад
      </button>
      <button type="button" className={styles.navButton} aria-label={nextLabel} onClick={onNext}>
        Далее →
      </button>
    </div>
  );
}
