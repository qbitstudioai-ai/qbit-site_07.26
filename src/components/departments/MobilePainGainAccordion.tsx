import { useState } from "react";
import type { PainPoint } from "@/content/types";
import styles from "./MobilePainGainAccordion.module.css";

interface MobilePainGainAccordionProps {
  painPoints: PainPoint[];
}

// Mobile (≤767px), Step 7.3, OQ-P6: отдельный столбик/аккордеон вместо боковой 20/80-раскладки
// PainGainPanel — на узкой ширине колонка 80% была бы непригодна для использования. Тап/Enter/Space
// по пункту боли раскрывает его выгоду (заменяет ранее раскрытый пункт, не аккумулирует несколько
// открытых сразу — один открытый пункт за раз, тот же принцип "одна активная деталь", что уже
// применяется в MobileDepartmentCarousel/PainGainPanel). Локальное состояние, key={department.id} от
// родителя сбрасывает на пункт №1 при переключении отдела (OQ-P2/OQ-P3), как и в PainGainPanel.
export function MobilePainGainAccordion({ painPoints }: MobilePainGainAccordionProps) {
  const [expandedIndex, setExpandedIndex] = useState(0);

  return (
    <ul
      className={`${styles.accordion} ${styles.stageAccordion}`}
      data-testid="mobile-pain-gain-accordion"
    >
      {painPoints.map((point, index) => {
        const isExpanded = index === expandedIndex;
        const gainId = `mobile-pain-gain-${index}`;
        return (
          <li key={point.pain} className={styles.item}>
            <button
              type="button"
              className={styles.painButton}
              aria-expanded={isExpanded}
              aria-controls={gainId}
              onClick={() => setExpandedIndex(index)}
            >
              {point.pain}
            </button>
            {isExpanded && (
              <p id={gainId} className={styles.gain}>
                {point.gain}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
