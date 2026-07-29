import styles from "./PainSolutionImpulse.module.css";

export interface PainSolutionImpulseGeometry {
  runId: number;
  sourceIndex: number;
  path: string;
  width: number;
  height: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  entryY: number;
}

interface PainSolutionImpulseProps {
  geometry: PainSolutionImpulseGeometry;
}

/**
 * Единственный направленный motion-акцент экрана отдела.
 *
 * SVG занимает уже существующий PainGainPanel и не участвует в раскладке. Геометрию вычисляет
 * родитель одним DOM-read pass; сам импульс проигрывается нативно внутри SVG, поэтому React не
 * получает покадровых обновлений.
 */
export function PainSolutionImpulse({ geometry }: PainSolutionImpulseProps) {
  const gradientId = `pain-impulse-gradient-${geometry.runId}`;

  return (
    <svg
      className={styles.overlay}
      viewBox={`0 0 ${geometry.width} ${geometry.height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
      data-pain-solution-impulse
      data-impulse-run={geometry.runId}
      data-impulse-source={geometry.sourceIndex}
      data-impulse-start-x={geometry.startX}
      data-impulse-start-y={geometry.startY}
      data-impulse-end-x={geometry.endX}
      data-impulse-end-y={geometry.endY}
    >
      <defs>
        <linearGradient
          id={gradientId}
          x1={geometry.startX}
          y1={geometry.startY}
          x2={geometry.endX}
          y2={geometry.endY}
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="rgba(143, 87, 34, 0.2)" />
          <stop offset="0.56" stopColor="rgba(181, 124, 65, 0.72)" />
          <stop offset="1" stopColor="rgba(244, 217, 177, 0.9)" />
        </linearGradient>
      </defs>
      <path
        className={styles.path}
        d={geometry.path}
        pathLength={1}
        vectorEffect="non-scaling-stroke"
        stroke={`url(#${gradientId})`}
      />
      <circle className={styles.tail} r="4.2">
        <animateMotion path={geometry.path} dur="700ms" fill="freeze" />
      </circle>
      <circle className={styles.pulse} r="2.2">
        <animateMotion path={geometry.path} dur="700ms" fill="freeze" />
      </circle>
    </svg>
  );
}
