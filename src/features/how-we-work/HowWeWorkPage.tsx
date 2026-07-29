"use client";

import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./HowWeWorkPage.module.css";

type ScenePoint = {
  label: string;
  title: string;
  description: string;
  image: string;
  mobileImage: string;
};

const laptopTerminalText =
  "Готовых решений у нас нет. Потому что ваш бизнес — не шаблон.\n\nСначала — понять процессы и цель. Потом — спроектировать систему.\n\nИ только потом — подключаем AI там, где он действительно ускоряет.\n\n\nОт Вас нужна полная открытость. Расскажите о своей боли или что Вас больше всего бесит.";

const laptopTypos = [
  { index: 8, wrongText: "ш" },
  { index: 80, wrongText: "цц" },
  { index: 173, wrongText: "йств" },
];

const chalkboardLines = [
  "1. Описываем процесс (pipeline) — как задача должна работать",
  "2. Подбираем инструменты: n8n, Python, Supabase, AI и др.",
  "3. Собираем и тестируем на своих серверах, API, LLM, БД",
  "4. Передаём систему: код, документация, инструкции — либо разворачиваем у себя и сопровождаем.",
  "5. Не уходим, когда сдан проект.",
  "\n\nНаш сервер и сопровождение: никаких забот о хостинге, обновлениях и контроле. Мы следим, чтобы  ваша голова «не болела».",
];

const corkboardNotes = [
  {
    title: "Честность",
    text: "Не продаём, если не видим результата для вас.\n\nБывало — отказывались от задач: это не наше или заказчику не нужно.",
    tone: "yellow",
  },
  {
    title: "Прозрачность",
    text: "Вы всегда знаете, на каком мы этапе.\n\nМожем согласовывать каждый шаг или взять всё на себя — как вам удобнее.",
    tone: "white",
  },
  {
    title: "Сопровождение",
    text: "Не исчезаем после сдачи. Вопрос, проблема, пожелание — звоните, пишите, стучите.\n\nМы на связи.",
    tone: "violet",
  },
  {
    title: "Подход",
    text: "Не коробка.\n\nДаже если задача похожа на предыдущую — собираем решение под ваш процесс и цели.",
    tone: "pink",
  },
];

const paperLines = [
  "Привет! Меня зовут Павел.",
  "Я отвечаю за решения в Qbit и за результат, который вы получите.",
  "Автоматизация не решит всё. Но она освободит людей от рутины, снизит затраты и даст вам прозрачную картину бизнеса — без ручного контроля.",
  "На каждом шагу будем честны. Не продадим того, что вам не нужно. Доведём до результата. Отношения для меня — партнёрство, а не «сделал — забыл».",
  "Не гадайте, чем автоматизация может помочь. Расскажите о своём бизнесе, целях, болях — а мы найдём решение.",
  "signature-placeholder",
];

const WHEEL_SCENE_THRESHOLD = 95;
const WHEEL_RESET_DELAY = 140;
const SCENE_TRANSITION_LOCK = 1120;
const REDUCED_MOTION_LOCK = 420;
const TOUCH_SWIPE_THRESHOLD = 54;
const ACCENT_REVEAL_DELAY = 1500;
const ACCENT_CONTENT_DELAY = 2000;
const LAPTOP_BOOT_DURATION_MS = 5200;
const LAPTOP_QBIT_EXIT_RATIO = 0.72;
const LAPTOP_TERMINAL_START_DELAY = Math.round(LAPTOP_BOOT_DURATION_MS * LAPTOP_QBIT_EXIT_RATIO);
const LAPTOP_TYPING_SPEED_FACTOR = 0.9;

function getTypingDelay(char: string, index: number) {
  const rhythm = index % 17;
  const humanVariance = Math.floor(Math.random() * 74);

  if (char === "\n") return 420 + Math.floor(Math.random() * 360);
  if (char === " ") return 24 + Math.floor(Math.random() * 62);
  if (char === "." || char === "!" || char === "?") return 440 + Math.floor(Math.random() * 480);
  if (char === "," || char === "—" || char === ":" || char === ";")
    return 180 + Math.floor(Math.random() * 260);
  if (rhythm === 0) return 185 + humanVariance;
  if (rhythm === 7 || rhythm === 11) return 34 + Math.floor(Math.random() * 44);

  return 48 + humanVariance;
}

function getLaptopTypingDelay(char: string, index: number) {
  const previousDelay = Math.max(18, Math.round(getTypingDelay(char, index) * 0.9));

  return Math.max(16, Math.round(previousDelay * LAPTOP_TYPING_SPEED_FACTOR));
}

export function HowWeWorkPage() {
  const scenes = useMemo<ScenePoint[]>(
    () => [
      {
        label: "Миссия и ценности",
        title: "Мы проектируем автоматизацию, которая работает на ваш бизнес.",
        description:
          "Не видим результата — говорим прямо. Не продаём то, что не принесёт пользы.\nПартнёрство для нас важнее одного чека.",
        image: "/how-we-work/mission-values.webp",
        mobileImage: "/how-we-work/mobile/mission-values.webp",
      },
      {
        label: "Анализ",
        title: "Разбираем ваш процесс — ищем, что реально улучшить",
        description:
          "Без волшебных таблеток. Интервью с командой, аудит процессов, честная оценка — где автоматизация даст результат, а где нет.",
        image: "/how-we-work/analysis.webp",
        mobileImage: "/how-we-work/mobile/analysis.webp",
      },
      {
        label: "Внедрение",
        title: "От идеи до работающей системы — шаг за шагом",
        description:
          "Без хаоса и брошенных проектов. Прозрачный процесс: вы всегда знаете, на каком мы этапе и что будет дальше.",
        image: "/how-we-work/implementation.webp",
        mobileImage: "/how-we-work/mobile/implementation.webp",
      },
      {
        label: "Почему Qbit",
        title: '"Спасибо, я подумаю..."',
        description:
          "Одна задача - куча компаний.\nКак сделать правильный выбор?!\nЗадайте вопросы, возможно есть непонимание или что-то тревожит...",
        image: "/how-we-work/why-qbit.webp",
        mobileImage: "/how-we-work/mobile/why-qbit.webp",
      },
      {
        label: "Письмо",
        title: "Фиксирую обещание",
        description:
          "Обещание - это принцип не только в работе, но и в жизни.\nПообещал - сделай! не сможешь сделать - не берись!",
        image: "/how-we-work/letter.webp",
        mobileImage: "/how-we-work/mobile/letter.webp",
      },
    ],
    [],
  );

  /**
   * Сцена и НОМЕР ЕЁ ВКЛЮЧЕНИЯ — одно состояние, а не два.
   *
   * `activation` строго возрастает при каждом переходе, даже если посетитель вернулся в ту же
   * сцену. Он нужен, чтобы отличить «сцену 0 показали впервые» от «сцену 0 показали снова», и
   * благодаря этому ступенчатое появление акцента больше не требует ручного сброса состояния
   * внутри эффекта (см. эффект таймеров ниже).
   *
   * Почему одно состояние, а не два соседних: индекс и номер включения обязаны меняться ОДНИМ
   * обновлением. Двумя вызовами `setState` они бы на один рендер разъехались, и появление
   * акцента моргнуло бы.
   */
  const [scene, setScene] = useState({ index: 0, activation: 0 });
  const activeIndex = scene.index;
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [laptopTypedText, setLaptopTypedText] = useState("");
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [accentReadyToken, setAccentReadyToken] = useState<string | null>(null);
  const [accentContentReadyToken, setAccentContentReadyToken] = useState<string | null>(null);
  const scrollLockUntilRef = useRef(0);
  const transitionTimerRef = useRef<number | undefined>(undefined);
  const wheelAccumulatorRef = useRef(0);
  const wheelResetTimerRef = useRef<number | undefined>(undefined);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const routeProgress = scenes.length > 1 ? (activeIndex / (scenes.length - 1)) * 100 : 100;

  const startTransitionLock = useCallback(
    (nextDirection: 1 | -1) => {
      scrollLockUntilRef.current =
        window.performance.now() +
        (prefersReducedMotion ? REDUCED_MOTION_LOCK : SCENE_TRANSITION_LOCK);
      setDirection(nextDirection);

      if (prefersReducedMotion) return;

      if (transitionTimerRef.current) {
        window.clearTimeout(transitionTimerRef.current);
      }

      setIsTransitioning(true);
      transitionTimerRef.current = window.setTimeout(() => setIsTransitioning(false), 1050);
    },
    [prefersReducedMotion],
  );

  const goToScene = useCallback(
    (direction: 1 | -1) => {
      if (window.performance.now() < scrollLockUntilRef.current) return;

      setScene((current) => {
        const nextIndex = Math.max(0, Math.min(scenes.length - 1, current.index + direction));
        if (nextIndex === current.index) return current;

        startTransitionLock(direction);
        return { index: nextIndex, activation: current.activation + 1 };
      });
    },
    [scenes.length, startTransitionLock],
  );

  const goToSceneIndex = useCallback(
    (nextIndex: number) => {
      if (nextIndex === activeIndex || window.performance.now() < scrollLockUntilRef.current)
        return;

      const nextDirection = nextIndex > activeIndex ? 1 : -1;
      startTransitionLock(nextDirection);
      setScene((current) => ({ index: nextIndex, activation: current.activation + 1 }));
    },
    [activeIndex, startTransitionLock],
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPreference = () => setPrefersReducedMotion(mediaQuery.matches);

    syncPreference();
    mediaQuery.addEventListener("change", syncPreference);

    return () => mediaQuery.removeEventListener("change", syncPreference);
  }, []);

  useEffect(() => {
    return () => {
      if (transitionTimerRef.current) {
        window.clearTimeout(transitionTimerRef.current);
      }

      if (wheelResetTimerRef.current) {
        window.clearTimeout(wheelResetTimerRef.current);
      }
    };
  }, []);

  /**
   * Ступенчатое появление акцента сцены.
   *
   * Раньше этот эффект начинался с трёх синхронных `setState` — «при reduced motion пометить
   * готовым сразу», иначе «сбросить оба состояния в null». Каждый такой вызов означает лишний
   * каскадный рендер сразу после первого (правило `react-hooks/set-state-in-effect`), а сброс
   * ещё и дублировал в состоянии то, что уже выражено сменой сцены.
   *
   * Устранена ПРИЧИНА, а не симптом. Готовность больше не хранится как «номер готовой сцены»,
   * а сравнивается с ТОКЕНОМ текущего показа: номер включения сцены плюс режим движения.
   * Токен строго уникален для каждого показа, поэтому:
   *
   * - сброс не нужен вовсе — старый токен не может совпасть с новым;
   * - возврат в ту же сцену до срабатывания таймера честно проигрывает появление заново
   *   (окно реально достижимо: блокировка перехода 1120 мс короче задержки акцента 1500 мс);
   * - переключение системной настройки «уменьшить движение» тоже меняет токен, то есть
   *   поведение совпадает с прежним и здесь.
   *
   * При reduced motion таймеры не заводятся, а готовность выводится прямо из настройки — акцент
   * виден сразу, как и раньше.
   */
  const revealToken = `${scene.activation}:${prefersReducedMotion ? "reduced" : "full"}`;

  // При reduced motion акцент виден сразу — таймеры в этом режиме не заводятся вовсе.
  const isAccentReady = prefersReducedMotion || accentReadyToken === revealToken;
  const isAccentContentReady = prefersReducedMotion || accentContentReadyToken === revealToken;

  useEffect(() => {
    if (prefersReducedMotion) return;

    const accentTimer = window.setTimeout(() => {
      setAccentReadyToken(revealToken);
    }, ACCENT_REVEAL_DELAY);
    const contentTimer = window.setTimeout(() => {
      setAccentContentReadyToken(revealToken);
    }, ACCENT_CONTENT_DELAY);

    return () => {
      window.clearTimeout(accentTimer);
      window.clearTimeout(contentTimer);
    };
  }, [revealToken, prefersReducedMotion]);

  useEffect(() => {
    const shouldLetTargetScroll = (target: EventTarget | null, deltaY: number) => {
      if (!(target instanceof Element)) return false;

      if (target.closest(".assistant-widget")) {
        return true;
      }

      let element: Element | null = target;

      while (element && element !== document.body) {
        const style = window.getComputedStyle(element);
        const canScrollY =
          /(auto|scroll)/.test(style.overflowY) && element.scrollHeight > element.clientHeight + 4;

        if (canScrollY) {
          const canScrollDown = element.scrollTop + element.clientHeight < element.scrollHeight - 2;
          const canScrollUp = element.scrollTop > 2;

          if ((deltaY > 0 && canScrollDown) || (deltaY < 0 && canScrollUp)) {
            return true;
          }
        }

        element = element.parentElement;
      }

      return false;
    };

    const normalizeDeltaY = (event: WheelEvent) => {
      if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) return event.deltaY * 18;
      if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) return event.deltaY * window.innerHeight;
      return event.deltaY;
    };

    const handleWheel = (event: WheelEvent) => {
      const normalizedDeltaY = normalizeDeltaY(event);

      if (shouldLetTargetScroll(event.target, normalizedDeltaY)) {
        return;
      }

      event.preventDefault();
      if (Math.abs(normalizedDeltaY) < 4) return;

      wheelAccumulatorRef.current += normalizedDeltaY;

      if (wheelResetTimerRef.current) {
        window.clearTimeout(wheelResetTimerRef.current);
      }

      wheelResetTimerRef.current = window.setTimeout(() => {
        wheelAccumulatorRef.current = 0;
      }, WHEEL_RESET_DELAY);

      if (Math.abs(wheelAccumulatorRef.current) < WHEEL_SCENE_THRESHOLD) return;

      const nextDirection = wheelAccumulatorRef.current > 0 ? 1 : -1;
      wheelAccumulatorRef.current = 0;
      goToScene(nextDirection);
    };

    const handleTouchStart = (event: TouchEvent) => {
      if (event.target instanceof Element && event.target.closest(".assistant-widget")) {
        touchStartRef.current = null;
        return;
      }

      const touch = event.touches[0];
      touchStartRef.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
    };

    const handleTouchEnd = (event: TouchEvent) => {
      const start = touchStartRef.current;
      const touch = event.changedTouches[0];
      touchStartRef.current = null;

      if (!start || !touch) return;

      const diffX = touch.clientX - start.x;
      const diffY = touch.clientY - start.y;

      if (Math.abs(diffY) < TOUCH_SWIPE_THRESHOLD || Math.abs(diffY) < Math.abs(diffX) * 1.2)
        return;

      goToScene(diffY < 0 ? 1 : -1);
    };

    window.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [goToScene]);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: number | undefined;

    const wait = (delay: number) =>
      new Promise<void>((resolve) => {
        timeoutId = window.setTimeout(resolve, delay);
      });

    async function typeLaptopText() {
      setLaptopTypedText("");

      if (activeIndex !== 1 || !isAccentContentReady) return;

      if (prefersReducedMotion) {
        setLaptopTypedText(laptopTerminalText);
        return;
      }

      const chars = Array.from(laptopTerminalText);
      let typed = "";
      let typoIndex = 0;

      await wait(LAPTOP_TERMINAL_START_DELAY);
      if (cancelled) return;

      for (let index = 0; index < chars.length; index += 1) {
        if (cancelled) return;

        const typo = laptopTypos[typoIndex];
        if (typo && typo.index === index) {
          const wrongChars = Array.from(typo.wrongText);

          for (const wrongChar of wrongChars) {
            if (cancelled) return;
            typed += wrongChar;
            setLaptopTypedText(typed);
            await wait(Math.round(46 * LAPTOP_TYPING_SPEED_FACTOR));
          }

          await wait(1000);

          for (let wrongIndex = 0; wrongIndex < wrongChars.length; wrongIndex += 1) {
            if (cancelled) return;
            typed = typed.slice(0, -1);
            setLaptopTypedText(typed);
            await wait(Math.round(58 * LAPTOP_TYPING_SPEED_FACTOR));
          }

          await wait(160);
          typoIndex += 1;
        }

        typed += chars[index];
        setLaptopTypedText(typed);
        await wait(getLaptopTypingDelay(chars[index], index));
      }
    }

    typeLaptopText();

    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [isAccentContentReady, activeIndex, prefersReducedMotion]);

  return (
    <section
      className={styles["office-stage"]}
      aria-label="Интерактивная офисная сцена"
      data-reduced-motion={prefersReducedMotion ? true : undefined}
      data-direction={direction}
      data-transitioning={isTransitioning ? true : undefined}
      data-active-scene={activeIndex}
    >
      <div className={styles["office-backgrounds"]} aria-hidden="true">
        {scenes.map((scene, index) => (
          <div
            className={styles["office-background"]}
            data-active={index === activeIndex ? true : undefined}
            data-previous={isTransitioning && index === activeIndex - direction ? true : undefined}
            key={scene.label}
            style={{ backgroundImage: `url(${scene.image})` }}
          />
        ))}
      </div>

      <div className={styles["office-mobile-backgrounds"]} aria-hidden="true">
        {scenes.map((scene, index) => (
          <div
            className={styles["office-mobile-background"]}
            data-active={index === activeIndex ? true : undefined}
            data-previous={isTransitioning && index === activeIndex - direction ? true : undefined}
            key={`${scene.label}-mobile`}
            style={{ backgroundImage: `url(${scene.mobileImage})` }}
          />
        ))}
      </div>

      {/*
        Панель с <h1> стоит здесь, а НЕ ниже слоёв поверхностей, где она была раньше.
        Причина: заметки корковой доски содержат по <h3>, и при прежнем порядке документ доходил
        до четырёх <h3> раньше, чем до единственного <h1> страницы (зафиксировано снимком
        production 2026-07-29).

        Порядок ОТРИСОВКИ при этом не изменился и больше не зависит от позиции в DOM: панель,
        подсказка колеса и индикатор прогресса получили явные `z-index` (4 и 5 против 3 у слоёв
        поверхностей) — см. HowWeWorkPage.module.css. Без этих значений перенос увёл бы панель под
        корковую доску, потому что у равных `z-index` побеждает то, что идёт ниже по документу.
      */}
      <div
        className={styles["office-route-panel"]}
        aria-live="polite"
        key={scenes[activeIndex].label}
      >
        <p className={styles["eyebrow"]}>{scenes[activeIndex].label}</p>
        <h1>{scenes[activeIndex].title}</h1>
        <p>{scenes[activeIndex].description}</p>
      </div>

      <div
        className={styles["office-ai-transition"]}
        data-active={isTransitioning ? true : undefined}
      />
      <div className={styles["office-vignette"]} aria-hidden="true" />

      <div
        className={styles["office-overview-dashboard"]}
        aria-hidden={activeIndex !== 0 || !isAccentReady}
      >
        <Image
          src="/how-we-work/overview-dashboard.jpg"
          alt=""
          width={1200}
          height={800}
          sizes="(max-width: 900px) 0px, 43vw"
          priority={false}
        />
      </div>

      <div className={styles["office-surface-layer"]} aria-hidden={activeIndex !== 2}>
        <div
          className={styles["chalkboard-surface"]}
          data-active={activeIndex === 2 && isAccentReady ? true : undefined}
          data-content-active={activeIndex === 2 && isAccentContentReady ? true : undefined}
        >
          <div className={styles["chalkboard-title"]}>План внедрения</div>
          <div className={styles["chalkboard-lines"]}>
            {chalkboardLines.map((line, index) => (
              <span key={line} style={{ "--line-index": index } as CSSProperties}>
                {line}
              </span>
            ))}
          </div>
          <div className={styles["chalk-piece"]} aria-hidden="true" />
        </div>
      </div>

      <div className={styles["office-surface-layer"]} aria-hidden={activeIndex !== 3}>
        <div
          className={styles["corkboard-surface"]}
          data-active={activeIndex === 3 && isAccentReady ? true : undefined}
          data-content-active={activeIndex === 3 && isAccentContentReady ? true : undefined}
        >
          {corkboardNotes.map((note, index) => (
            <article
              className={styles["cork-note"]}
              data-tone={note.tone}
              key={note.title}
              style={{ "--note-index": index } as CSSProperties}
            >
              <span className={styles["push-pin"]} aria-hidden="true" />
              <h3>{note.title}</h3>
              <p>{note.text}</p>
            </article>
          ))}
          <div
            className={`${styles["cork-thread"]} ${styles["cork-thread-a"]}`}
            aria-hidden="true"
          />
          <div
            className={`${styles["cork-thread"]} ${styles["cork-thread-b"]}`}
            aria-hidden="true"
          />
        </div>
      </div>

      <div className={styles["office-surface-layer"]} aria-hidden={activeIndex !== 4}>
        <div
          className={styles["paper-surface"]}
          data-active={activeIndex === 4 && isAccentReady ? true : undefined}
          data-content-active={activeIndex === 4 && isAccentContentReady ? true : undefined}
        >
          <div className={styles["paper-sheet"]}>
            {paperLines.map((line, index) => (
              <span
                data-signature-placeholder={line === "signature-placeholder" ? true : undefined}
                key={line}
                style={{ "--paper-line-index": index } as CSSProperties}
              >
                {line === "signature-placeholder" ? (
                  <Image
                    alt="Подпись Павла"
                    className={styles["paper-signature-image"]}
                    width={220}
                    height={139}
                    sizes="220px"
                    src="/how-we-work/signature-pavel.png"
                  />
                ) : (
                  line
                )}
              </span>
            ))}
          </div>
          <div className={styles["paper-pen"]} aria-hidden="true" />
        </div>
      </div>

      <div className={styles["office-surface-layer"]} aria-hidden={activeIndex !== 1}>
        <div
          className={styles["laptop-screen-surface"]}
          data-active={activeIndex === 1 && isAccentReady ? true : undefined}
          data-content-active={activeIndex === 1 && isAccentContentReady ? true : undefined}
          style={
            {
              "--laptop-boot-duration": `${LAPTOP_BOOT_DURATION_MS}ms`,
              "--laptop-terminal-delay": `${LAPTOP_TERMINAL_START_DELAY}ms`,
            } as CSSProperties
          }
        >
          <div className={styles["boot-mark"]}>
            <span />
            <span />
            <span />
            <span />
          </div>
          <Image
            className={styles["boot-brand"]}
            src="/logo.svg"
            alt="QBit-Studio-Ai"
            width={144}
            height={144}
          />
          <div className={styles["laptop-typed-text"]} aria-live="polite">
            Готовых решений у нас нет. Потому что ваш бизнес — не шаблон. Сначала — понять процессы
            и цель. Потом — спроектировать систему. И только потом — подключаем AI там, где он
            действительно ускоряет. От Вас нужна полная открытость. Расскажите о своей боли или что
            Вас больше всего бесит.
            <span className={styles["terminal-prompt"]}>PS C:\QBit-Studio-Ai&gt;</span>
            <span className={styles["terminal-output"]}>{laptopTypedText}</span>
            <span className={styles["terminal-cursor"]} aria-hidden="true" />
          </div>
        </div>
      </div>

      {/* `Link`, а не голый `<a>`: адрес внутренний, и обычная ссылка перезагружала бы весь
          документ вместо клиентского перехода. Разметка на выходе та же — `next/link` рисует
          `<a>` с тем же классом и тем же содержимым, поэтому вид, отступы и анимация не
          меняются. */}
      <Link className={styles["return-button"]} href="/" aria-label="Вернуться к первому экрану">
        <span className={styles["return-button__arrow"]} aria-hidden="true">
          ↑
        </span>
        <span>Вернуться</span>
      </Link>

      <div className={styles["office-wheel-hint"]} aria-hidden="true">
        Колесико мыши переключает локации
      </div>

      <div
        className={styles["office-progress"]}
        role="status"
        aria-label={`Шаг ${activeIndex + 1} из ${scenes.length}: ${scenes[activeIndex].label}`}
        style={{ "--route-progress": `${routeProgress}%` } as CSSProperties}
      >
        <div className={styles["office-progress__meta"]}>
          <span>{String(activeIndex + 1).padStart(2, "0")}</span>
          <span>{String(scenes.length).padStart(2, "0")}</span>
        </div>
        <div className={styles["office-progress__track"]} aria-hidden="true">
          <span />
        </div>
      </div>

      <div className={styles["office-route-dots"]} aria-label="Текущая локация">
        {scenes.map((scene, index) => (
          <button
            type="button"
            aria-label={scene.label}
            aria-pressed={index === activeIndex}
            data-active={index === activeIndex ? true : undefined}
            key={scene.label}
            onClick={() => goToSceneIndex(index)}
          />
        ))}
      </div>
    </section>
  );
}
