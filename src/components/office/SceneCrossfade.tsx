"use client";

import { useEffect, useRef, useState, type AnimationEvent as ReactAnimationEvent } from "react";
import { officeSceneById, type OfficeSceneId } from "./departmentPhotos";
import { OfficeScenePhoto } from "./OfficePhoto";
import styles from "./SceneCrossfade.module.css";

interface SceneCrossfadeProps {
  /** Какая сцена должна быть показана сейчас. */
  sceneId: OfficeSceneId;
  sizes: string;
  /** Класс фотослоя места использования (геометрия, фильтры, скругление). */
  photoClassName: string;
}

/** Длительность проявления приходящей сцены — `scene-dissolve` в SceneCrossfade.module.css. */
export const SCENE_DISSOLVE_MS = 420;
/** Длительность движения приходящей сцены — `scene-dolly` там же. */
export const SCENE_DOLLY_MS = 800;
/**
 * Аварийный порог: за это время переход обязан закончиться сам. Нужен только на случай, когда
 * события анимации не приходят вовсе; в норме не срабатывает и потому намеренно взят с большим
 * запасом — привязывать его к длительностям значило бы вернуть синхронизацию таймера с анимацией,
 * от которой Amendment 15 как раз уходит.
 */
const TRANSITION_TIMEOUT_MS = 3000;

/** Что сейчас показывается и надо ли проигрывать переход. */
interface Reveal {
  id: OfficeSceneId;
  /** false — сцена уже была на экране и её достаточно просто оставить (см. ветку возврата). */
  animate: boolean;
}

/**
 * Переход между сценами отделов (Step 16, OQ-A2-6; эффект переработан Amendment 15).
 *
 * Решаемая задача записана как вход этого шага (Step 13, skeptic Phase B, NON-BLOCKING-1):
 * `OfficeScenePhoto` монтируется с `key` по сцене — это обязательно, иначе признак неудачной
 * загрузки «залипает» и один сбой сети гасит фотослой на весь визит. Но следствие в том, что при
 * переключении отдела старый `<img>` размонтируется НЕМЕДЛЕННО, а новый стартует пустым: измерено
 * окно без сцены 73–1261 мс на канале с задержкой 1.2 с (26 из 45 выборок). Переход, проходящий
 * через пустоту, — не переход.
 *
 * Поэтому во время перехода на экране живут ДВА слоя: приходящий кладётся поверх, уходящий держится
 * под ним. Ключ каждого слоя — САМА СЦЕНА (`scene-<id>`), и это принципиально: при ключе по РОЛИ
 * («уходящий»/«приходящий») уходящий слой оказывался НОВЫМ DOM-элементом, стартовал пустым и
 * удерживать ему было нечего — замерено 16 из 30 выборок без видимой сцены против 0 из 30 сейчас.
 *
 * ГЛАВНОЕ ПРАВИЛО ПОРЯДКА (Amendment 15). Первая редакция снимала уходящий слой по событию загрузки
 * приходящего, а анимацию приходящего отсчитывала от МОНТИРОВАНИЯ — два независимых таймера. При
 * быстрой загрузке уходящий исчезал раньше, чем приходящий успевал проявиться; измеренная
 * непрозрачность приходящей сцены в момент снятия уходящей: задержка сети 0 мс → 0.00, 120 мс →
 * 0.48, 250 мс → 0.77, 600 мс → 0.99. То есть на картинке из кэша (а при повторных переключениях
 * она всегда из кэша) переход снова шёл через пустоту — тот же дефект, только на другом конце
 * диапазона скоростей, и e2e его не видел, потому что ставил задержку 900 мс.
 *
 * Теперь таймер один и причинный:
 *   1. приходящая сцена не показывается вовсе, пока не готова к отрисовке (`.layerPending`);
 *   2. как только готова — начинается показ, и в тот же момент уходящая начинает уходить;
 *   3. слои под приходящей снимаются только после того, как она стала непрозрачной.
 * Ни в одной точке этой цепочки экран не может остаться без кадра.
 *
 * Почему провал загрузки тоже считается готовностью: иначе недоступная сцена нового отдела оставила
 * бы на экране сцену предыдущего навсегда — пользователь видел бы чужой отдел и не понял бы, что
 * произошло. При провале приходящий слой — это плейсхолдер Step 8, и он честно занимает своё место.
 */
export function SceneCrossfade({ sceneId, sizes, photoClassName }: SceneCrossfadeProps) {
  // Стек сцен: последняя — текущая, всё, что под ней, — ещё не снятые предыдущие.
  //
  // Глубина стека ограничена сверху ШЕСТЬЮ (overview + пять отделов) и не может расти дальше:
  // добавление происходит только когда сцены в стеке ещё нет, а возврат к уже присутствующей
  // схлопывает стек.
  const [layers, setLayers] = useState<OfficeSceneId[]>([sceneId]);
  const [reveal, setReveal] = useState<Reveal | null>(null);

  // Зеркало `layers` для обработчиков и таймеров. Пишется ТОЛЬКО внутри эффектов и колбэков, никогда
  // во время рендера (запись в ref на этапе рендера ломает конкурентный рендеринг и запрещена
  // правилом react-hooks/refs), поэтому оно же, а не state, является источником истины для решений
  // «этот слой ещё верхний?» — state в момент срабатывания таймера может быть из старого замыкания.
  const layersRef = useRef<OfficeSceneId[]>([sceneId]);
  const previousSceneIdRef = useRef(sceneId);

  useEffect(() => {
    if (previousSceneIdRef.current === sceneId) return;
    previousSceneIdRef.current = sceneId;

    // Возврат к сцене, которая ещё в стеке (пользователь передумал до загрузки новой): её <img>
    // уже смонтирован и декодирован, ждать нечего — схлопываем немедленно.
    // Без этой ветки стек оставался бы из двух слоёв НАВСЕГДА: сигнал готовности приходит не чаще
    // одного раза за монтирование, поэтому повторно поднятый наверх слой его уже не пришлёт
    // (skeptic Phase B Step 16, NB-1 — воспроизведено на пути A → B(ещё грузится) → A).
    const isAlreadyMounted = layersRef.current.includes(sceneId);
    const next = isAlreadyMounted ? [sceneId] : [...layersRef.current, sceneId];
    layersRef.current = next;
    setLayers(next);

    // ...и показываем её БЕЗ анимации: эта сцена уже на экране, проигрывать ей проявление с нуля
    // значило бы моргнуть в пустоту — ровно тем дефектом, против которого весь Amendment 15.
    if (isAlreadyMounted) setReveal({ id: sceneId, animate: false });
  }, [sceneId]);

  const collapseTo = (id: OfficeSceneId) => {
    // Верхний слой мог смениться, пока играл переход (быстрое переключение отделов). Тогда снимать
    // нижние нельзя: это выбросило бы актуальную сцену.
    if (layersRef.current[layersRef.current.length - 1] !== id) return;
    if (layersRef.current.length === 1) return;
    layersRef.current = [id];
    setLayers([id]);
  };

  /**
   * Переход ведётся САМОЙ АНИМАЦИЕЙ, а не таймером, и это главный урок Amendment 15.
   *
   * Исходный дефект возник ровно из-за двух независимых клапанов на один поток: слой снимался по
   * событию загрузки, а анимация шла от монтирования. Первая попытка починки эту болезнь не
   * вылечила, а только сузила — снятие нижних слоёв отсчитывалось таймером от начала показа, то
   * есть JS-часы по-прежнему синхронизировались с CSS-часами «на глазок», через фиксированный
   * запас. CSS-анимация стартует с ближайшей отрисовкой, таймер — немедленно, и величина
   * расхождения зависит от нагрузки, то есть не ограничена ничем.
   *
   * Событие окончания анимации снимает вопрос синхронизации полностью: снятие слоя привязано не к
   * предполагаемому моменту, а к фактически случившемуся.
   */
  const handleAnimationEnd = (event: ReactAnimationEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.dataset.sceneGleam) return; // декоративный слой, к смене сцен отношения не имеет

    const photos = event.currentTarget.querySelectorAll(
      ":scope > picture, :scope > [data-photo-fallback]",
    );
    const topPhoto = photos[photos.length - 1];
    if (!topPhoto?.contains(target)) return;

    const finishedId = layersRef.current[layersRef.current.length - 1];

    // Первая доигравшая анимация — проявление: оно по построению короче движения (сторож на это
    // есть в unit-тестах). Значит, приходящий кадр уже непрозрачен и закрыл нижние собой.
    collapseTo(finishedId);

    // Когда на слое не осталось работающих анимаций — переход окончен: снимаем классы перехода и
    // световой пробег. Проверка по getAnimations, а не по имени анимации или их числу: имена
    // хешируются CSS Modules, а число различается в reduced motion (там трек один).
    const stillRunning = target
      .getAnimations()
      .some((animation) => animation.playState === "running");
    if (stillRunning) return;

    setReveal((current) =>
      current?.id === finishedId && current.animate ? { id: finishedId, animate: false } : current,
    );
  };

  // Страховка на случай, если события анимации не придут вовсе (анимации отключены на уровне
  // системы/браузера, слой не отрисовывается). Без неё стек в такой ситуации остался бы из двух
  // слоёв навсегда. Порог заведомо больше любой легальной анимации, поэтому в норме таймер не
  // срабатывает никогда и на синхронизацию перехода не влияет.
  useEffect(() => {
    if (!reveal?.animate) return;
    const revealedId = reveal.id;
    const timer = window.setTimeout(() => collapseTo(revealedId), TRANSITION_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [reveal]);

  // Сцена готова к отрисовке (успешно декодирована ЛИБО провалилась) — сигнал начать показ.
  //
  // Проверка «это всё ещё верхний слой» здесь ОБЯЗАТЕЛЬНА. Сигнал от уже неактуальной сцены сдвинул
  // бы `reveal` на неё, а тогда верхний — и уже показанный — слой снова получил бы `.layerPending`,
  // то есть opacity 0, и экран остался бы без сцены до следующего переключения. Аварийный таймер
  // это не лечит: он схлопывает стек к `revealedId`, который в такой ситуации не верхний, и выходит
  // по первой же проверке.
  //
  // Фактически такой сигнал сейчас и не доходит: `onReady` передаётся только верхнему слою, поэтому
  // у неактуального он `undefined`. Но это ПОБОЧНЫЙ эффект места привязки пропа, а не защита:
  // рефакторинг, который навесит `onReady` на все слои, вернул бы чёрный экран. Инвариант должен
  // держаться на явном условии, а не на том, где сейчас оказался проп.
  const handleReady = (readyId: OfficeSceneId) => {
    if (layersRef.current[layersRef.current.length - 1] !== readyId) return;
    setReveal({ id: readyId, animate: true });
  };

  const topId = layers[layers.length - 1];
  const isRevealingTop = reveal?.id === topId;
  const isPlaying = isRevealingTop && reveal.animate;

  const layerClassName = (isTop: boolean) => {
    if (isTop) {
      if (!isRevealingTop) return styles.layerPending;
      // Сцена уже была на экране (ветка возврата): ни движения, ни проявления — просто остаётся.
      // Осознанный компромисс: если этот слой в момент возврата ещё уезжал (`.layerReceding`), он
      // мгновенно вернётся с 1.045 в 1. Это в разы мягче, чем моргнуть в пустоту, и достижимо
      // только кликом «назад в тот же отдел» в пределах примерно 800 мс.
      return reveal.animate ? styles.layerIncoming : styles.layerSettled;
    }
    // Нижние слои уезжают только вместе с показом верхнего; пока верхний ждёт готовности, нижний
    // обязан стоять непрозрачным — он и есть то, что видит пользователь.
    return isPlaying ? styles.layerReceding : styles.layerOutgoing;
  };

  return (
    <div
      className={styles.stack}
      aria-hidden="true"
      data-scene-crossfade={sceneId}
      onAnimationEnd={handleAnimationEnd}
    >
      {layers.map((id, index) => (
        <OfficeScenePhoto
          key={`scene-${id}`}
          sources={officeSceneById[id]}
          sizes={sizes}
          className={`${photoClassName} ${layerClassName(index === layers.length - 1)}`}
          onReady={index === layers.length - 1 ? () => handleReady(id) : undefined}
        />
      ))}
      {/* Световой пробег живёт ровно один переход: ключ по сцене перемонтирует его на каждом
          переключении, иначе CSS-анимация проиграла бы только в первый раз. */}
      {isPlaying ? (
        <span
          key={`gleam-${topId}`}
          aria-hidden="true"
          data-scene-gleam="true"
          className={styles.gleam}
        />
      ) : null}
    </div>
  );
}
