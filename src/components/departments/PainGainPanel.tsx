import { useState } from "react";
import type { PainPoint } from "@/content/types";
import styles from "./PainGainPanel.module.css";

interface PainGainPanelProps {
  painPoints: PainPoint[];
}

// Desktop/Tablet (≥768px), Step 7.3: 20/80-раскладка "боль/выгода" (docs/03 "Режим 10/90").
// Локальное состояние (OQ-P3 = (a)) — не office-machine: выбор пункта боли не диспетчирует
// редьюсер, не меняет URL. Родитель (DepartmentExperience) передаёт key={department.id}, поэтому
// компонент полностью размонтируется/монтируется заново при SWITCH_DEPARTMENT — состояние
// гарантированно сбрасывается на пункт №1 (OQ-P2/OQ-P3), а не переносит устаревший индекс.
export function PainGainPanel({ painPoints }: PainGainPanelProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selected = painPoints[selectedIndex];

  return (
    <div className={styles.panel} data-testid="pain-gain-panel">
      <ul className={styles.painList}>
        {painPoints.map((point, index) => {
          const isSelected = index === selectedIndex;
          return (
            <li key={point.pain}>
              <button
                type="button"
                className={
                  isSelected
                    ? `${styles.painButton} ${styles.painButtonSelected}`
                    : styles.painButton
                }
                aria-pressed={isSelected}
                onClick={() => setSelectedIndex(index)}
              >
                {point.pain}
              </button>
            </li>
          );
        })}
      </ul>
      {/* aria-live озвучивает смену выгоды при выборе другого пункта боли (не aria-describedby на
          кнопках — текст описывает результат уже выбранного пункта, а не сами кнопки). */}
      <p className={styles.gain} aria-live="polite">
        {selected.gain}
      </p>
    </div>
  );
}
