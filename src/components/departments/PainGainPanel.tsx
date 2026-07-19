import { useState } from "react";
import type { PainPoint } from "@/content/types";
import { TypedText } from "./TypedText";
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
                {/* Слот постоянной ширины: занимает место и когда пуст, поэтому появление глифа
                    не смещает текст и не меняет перенос строк (Amendment 12 — именно из-за таких
                    сдвигов пришлось отказаться от жирного начертания у выбранного пункта).
                    aria-hidden обязателен: без него глиф попал бы в вычисляемое имя кнопки, и
                    выбранный пункт назывался бы иначе, чем невыбранный, — имя контрола менялось бы
                    от состояния. Смысл выбранности несёт aria-pressed. */}
                <span className={styles.painMarker} aria-hidden="true">
                  {isSelected ? "▸" : ""}
                </span>
                {point.pain}
              </button>
            </li>
          );
        })}
      </ul>
      {/* aria-live озвучивает смену выгоды при выборе другого пункта боли (не aria-describedby на
          кнопках — текст описывает результат уже выбранного пункта, а не сами кнопки).
          Amendment 12: блок переехал из-под списка вправо и печатается посимвольно. aria-live здесь
          остаётся корректным именно потому, что TypedText держит в DOM полный текст с первого кадра
          (см. док-комментарий там) — иначе объявление шло бы обрывками.
          key={selected.pain} перезапускает печать при смене пункта: без него React переиспользовал бы
          состояние и новый текст мог бы доехать уже «напечатанным». */}
      <p className={styles.gain} aria-live="polite">
        <TypedText key={selected.pain} text={selected.gain} />
      </p>
    </div>
  );
}
