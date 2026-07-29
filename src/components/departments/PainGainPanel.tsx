import {
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import type { PainPoint } from "@/content/types";
import { RouteMarker } from "@/components/graphics/RouteMarker";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { PainSolutionImpulse, type PainSolutionImpulseGeometry } from "./PainSolutionImpulse";
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
// Step 15.5: ступени каскада появления, общий шаг 1 с (требование пользователя). Числа объявлены
// здесь, а не только в CSS, потому что их обязаны знать оба механизма — и анимация видимости блока,
// и старт печати текста внутри него. Разъехавшись, они дали бы напечатанный текст в невидимом окне.
const INITIAL_DELAY_MS = 1400;
const IMPULSE_TYPING_DELAY_MS = 700;
const IMPULSE_ARRIVAL_MS = 560;
const IMPULSE_CLEANUP_MS = 1100;
const MAX_TYPING_DURATION_MS = 1900;
const MIN_STEP_MS = 10;
const MAX_STEP_MS = 34;

interface ImpulseState {
  geometry: PainSolutionImpulseGeometry | null;
  arrived: boolean;
}

type ImpulseAction =
  | { type: "launch"; geometry: PainSolutionImpulseGeometry }
  | { type: "remeasure"; geometry: PainSolutionImpulseGeometry }
  | { type: "arrive"; runId: number }
  | { type: "finish"; runId: number };

function impulseReducer(state: ImpulseState, action: ImpulseAction): ImpulseState {
  if (action.type === "launch") return { geometry: action.geometry, arrived: false };
  if (action.type === "remeasure") {
    if (!state.geometry || state.geometry.runId !== action.geometry.runId) return state;
    return { ...state, geometry: action.geometry };
  }
  if (!state.geometry || state.geometry.runId !== action.runId) return state;
  if (action.type === "arrive") return { ...state, arrived: true };
  return { geometry: null, arrived: false };
}

function roundCoordinate(value: number) {
  return Math.round(value * 100) / 100;
}

function measureImpulse(
  panel: HTMLDivElement,
  source: HTMLButtonElement,
  target: HTMLElement,
  runId: number,
  sourceIndex: number,
): PainSolutionImpulseGeometry {
  const panelRect = panel.getBoundingClientRect();
  const sourceRect = source.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const startX = roundCoordinate(sourceRect.right - panelRect.left);
  const startY = roundCoordinate(sourceRect.top - panelRect.top + sourceRect.height / 2);
  const targetTop = targetRect.top - panelRect.top;
  const targetBottom = targetRect.bottom - panelRect.top;
  const endX = roundCoordinate(targetRect.left - panelRect.left + 1);
  const endY = roundCoordinate(Math.min(targetBottom - 16, Math.max(targetTop + 16, startY)));
  const distance = Math.max(18, endX - startX);
  const handle = Math.min(28, distance * 0.46);
  const path = `M ${startX} ${startY} C ${roundCoordinate(startX + handle)} ${startY}, ${roundCoordinate(endX - handle)} ${endY}, ${endX} ${endY}`;

  return {
    runId,
    sourceIndex,
    path,
    width: roundCoordinate(panelRect.width),
    height: roundCoordinate(panelRect.height),
    startX,
    startY,
    endX,
    endY,
    entryY: roundCoordinate(endY - targetTop),
  };
}

// Повторный клик по УЖЕ выбранной боли ничего не перезапускает. Проверка выполняется до изменения
// state: так не появляется ни новый run-id импульса, ни новый startDelay у TypedText.

export function PainGainPanel({ painPoints }: PainGainPanelProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const prefersReducedMotion = usePrefersReducedMotion();
  // Отличает первый показ отдела от осознанного выбора другой боли. Сравнивать selectedIndex с 0
  // нельзя: пользователь может выбрать первый пункт повторно, и это уже «смена боли», а не открытие.
  const [hasChosen, setHasChosen] = useState(false);
  // Номер пункта, чей текст ответа уже проявлен. Метка привязана к ВЫБОРУ, а не к отделу: см.
  // разбор у самого <span> ниже.
  const [shownIndex, setShownIndex] = useState<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const gainRef = useRef<HTMLElement>(null);
  const painButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const runIdRef = useRef(0);
  const [impulse, dispatchImpulse] = useReducer(impulseReducer, {
    geometry: null,
    arrived: false,
  });
  const activeImpulseRunId = impulse.geometry?.runId;
  const selected = painPoints[selectedIndex];
  const typingStepMs = Math.min(
    MAX_STEP_MS,
    Math.max(MIN_STEP_MS, Math.floor(MAX_TYPING_DURATION_MS / selected.gain.length)),
  );

  useEffect(() => {
    const runId = activeImpulseRunId;
    if (!runId) return;

    const arrivalTimer = window.setTimeout(
      () => dispatchImpulse({ type: "arrive", runId }),
      IMPULSE_ARRIVAL_MS,
    );
    const cleanupTimer = window.setTimeout(
      () => dispatchImpulse({ type: "finish", runId }),
      IMPULSE_CLEANUP_MS,
    );

    return () => {
      window.clearTimeout(arrivalTimer);
      window.clearTimeout(cleanupTimer);
    };
  }, [activeImpulseRunId]);

  useLayoutEffect(() => {
    const runId = activeImpulseRunId;
    const panel = panelRef.current;
    const source = painButtonRefs.current[selectedIndex];
    const target = gainRef.current;
    if (!runId || !panel || !source || !target) return;

    const remeasure = () => {
      dispatchImpulse({
        type: "remeasure",
        geometry: measureImpulse(panel, source, target, runId, selectedIndex),
      });
    };

    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => remeasure());
    observer?.observe(panel);
    observer?.observe(source);
    observer?.observe(target);
    window.addEventListener("resize", remeasure);

    /**
     * `ResizeObserver` следит за РАЗМЕРОМ и по устройству не видит смещения.
     *
     * У кнопки боли есть `:hover { transform: translateX(2px) }` с переходом. Геометрия снимается
     * синхронно в обработчике клика — то есть до того, как этот переход отработает, — и дальше
     * оставалась устаревшей: линия начиналась там, где кнопка БЫЛА, а не там, где она видна.
     * Наблюдатель размера этого не ловил, потому что ширина и высота не менялись.
     *
     * Переход завершился — пересчитываем. Задержка не нужна: событие приходит ровно тогда, когда
     * положение окончательно установилось.
     */
    const handleTransitionEnd = (event: TransitionEvent) => {
      // Только смещение самой кнопки. У неё переходят четыре свойства (фон, рамка, transform, тень),
      // и событие всплывает ещё и от дочерних узлов — без этой проверки один клик давал бы пять с
      // лишним пересчётов подряд. Пересчёт меняет состояние, то есть каждый лишний вызов — лишний
      // рендер и сдвиг таймингов соседних анимаций.
      if (event.target !== source || event.propertyName !== "transform") return;
      remeasure();
    };
    source.addEventListener("transitionend", handleTransitionEnd);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", remeasure);
      source.removeEventListener("transitionend", handleTransitionEnd);
    };
  }, [activeImpulseRunId, selectedIndex]);

  const gainStyle = impulse.geometry
    ? ({ "--impulse-entry-y": `${impulse.geometry.entryY}px` } as CSSProperties)
    : undefined;

  return (
    <div
      ref={panelRef}
      className={styles.panel}
      data-testid="pain-gain-panel"
      data-impulse-state={impulse.geometry ? (impulse.arrived ? "arrived" : "travelling") : "idle"}
    >
      <section className={`${styles.painCard} ${styles.stagePains}`}>
        <h3 className={styles.cardTitle}>Что происходит сейчас</h3>
        <ul className={styles.painList}>
          {painPoints.map((point, index) => {
            const isSelected = index === selectedIndex;
            return (
              <li key={point.pain}>
                <button
                  ref={(node) => {
                    painButtonRefs.current[index] = node;
                  }}
                  type="button"
                  className={
                    isSelected
                      ? `${styles.painButton} ${styles.painButtonSelected}`
                      : styles.painButton
                  }
                  aria-pressed={isSelected}
                  onClick={(event) => {
                    if (isSelected) return;
                    setSelectedIndex(index);
                    setHasChosen(true);
                    setShownIndex(null);

                    const panel = panelRef.current;
                    const target = gainRef.current;
                    if (!prefersReducedMotion && panel && target) {
                      runIdRef.current += 1;
                      dispatchImpulse({
                        type: "launch",
                        geometry: measureImpulse(
                          panel,
                          event.currentTarget,
                          target,
                          runIdRef.current,
                          index,
                        ),
                      });
                    }
                  }}
                >
                  <span className={styles.painMarker} aria-hidden="true">
                    {isSelected ? <RouteMarker direction="right" /> : null}
                  </span>
                  {point.pain}
                </button>
              </li>
            );
          })}
        </ul>
      </section>
      {impulse.geometry && !prefersReducedMotion ? (
        <PainSolutionImpulse key={impulse.geometry.runId} geometry={impulse.geometry} />
      ) : null}
      {/* aria-live озвучивает смену выгоды при выборе другого пункта боли (не aria-describedby на
          кнопках — текст описывает результат уже выбранного пункта, а не сами кнопки).
          Amendment 12: блок переехал из-под списка вправо и печатается посимвольно. aria-live здесь
          остаётся корректным именно потому, что TypedText держит в DOM полный текст с первого кадра
          (см. док-комментарий там) — иначе объявление шло бы обрывками.
          key={selected.pain} перезапускает печать при смене пункта: без него React переиспользовал бы
          состояние и новый текст мог бы доехать уже «напечатанным». */}
      {/* Step 15.5. Здесь встречаются ДВА разных каскада, и различать их существенно:
          • при открытии/переключении отдела окно пояснения — третья ступень общего каскада (2 с),
            и появляется САМО ОКНО целиком (класс на <p>);
          • при выборе другой боли внутри уже открытого отдела остальные блоки не трогаются вовсе, а
            здесь заново появляется ТЕКСТ через 1 с (класс на внутреннем <span>).

          Почему перезапуск анимации сделан ключом на внутреннем <span>, а не на самом <p>: CSS
          перезапускает анимацию только при перемонтировании узла, но <p> — это живой регион
          (aria-live), и замена самого его узла — известный способ ПОТЕРЯТЬ объявление в части
          скринридеров. Живой регион обязан оставаться смонтированным, а меняться должно его
          содержимое — именно на смену содержимого живые регионы и рассчитаны. Заодно это защищает
          инвариант Amendment 12: геометрию окна задаёт список болей, и она не трогается вовсе.

          Задержка печати передаётся в TypedText тем же числом: иначе текст печатался бы под ещё
          невидимым блоком и к моменту появления оказался бы уже набранным. */}
      <section
        ref={gainRef}
        className={`${hasChosen ? styles.gain : `${styles.gain} ${styles.gainInitial}`} ${
          impulse.arrived ? styles.gainImpulseArrived : ""
        }`}
        style={gainStyle}
        data-gain-panel="true"
      >
        <h3 className={styles.cardTitle}>После внедрения</h3>
        <p className={styles.gainCopy} aria-live="polite">
          {/* Защёлка НА ТЕКУЩИЙ ВЫБОР (Step 17, решение пользователя 2026-07-20).

            Дефект, который она закрывает, измерен skeptic-ревью: `.panel` переключается
            медиазапросом через `display` (grid выше 768px, none ниже), а повторный показ элемента
            ПЕРЕЗАПУСКАЕТ CSS-анимацию вместе с `backwards`-fill. После ресайза через 768px текст
            ответа исчезал на 1.2 с — пропадал ответ, который пользователь только что прочитал.
            Триггеры бытовые: поворот планшета, изменение зума, открытие devtools.

            Защёлка отдела (`data-cascade-done`) здесь НЕ подходит: под ней анимация отключилась бы
            навсегда, и смена боли перестала бы показывать текст с задержкой в 1 секунду — а это
            прямое требование пользователя. Поэтому метка привязана к номеру выбранного пункта: она
            сбрасывается на каждом новом выборе, то есть задержка сохраняется, но однажды показанный
            текст ресайзом уже не гасится. */}
          <span
            key={selectedIndex}
            data-gain-shown={shownIndex === selectedIndex}
            onAnimationEnd={() => setShownIndex(selectedIndex)}
            className={hasChosen ? styles.gainTextReveal : undefined}
            style={
              hasChosen
                ? ({
                    "--gain-reveal-delay": `${IMPULSE_TYPING_DELAY_MS}ms`,
                  } as CSSProperties)
                : undefined
            }
          >
            <TypedText
              text={selected.gain}
              stepMs={typingStepMs}
              startDelayMs={hasChosen ? IMPULSE_TYPING_DELAY_MS : INITIAL_DELAY_MS}
            />
          </span>
        </p>
        {selected.howItWorks ? (
          <div className={styles.howItWorks}>
            <p className={styles.howItWorksLabel}>Как работает</p>
            <p className={styles.howItWorksCopy}>{selected.howItWorks}</p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
