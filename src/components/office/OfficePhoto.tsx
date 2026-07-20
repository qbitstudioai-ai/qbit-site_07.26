"use client";

import Image, { type StaticImageData } from "next/image";
import { useRef, useState } from "react";
import { OFFICE_SCENE_WIDTHS, type OfficeSceneSources } from "./departmentPhotos";
import styles from "./OfficePhoto.module.css";

interface OfficePhotoProps {
  src: StaticImageData;
  /** Класс самого <Image> (object-fit, затемнение и т.п.) — специфичен для места использования. */
  className?: string;
}

// data-photo-fallback — стабильный, не хешируемый CSS Modules хук для e2e/unit-проверок (тот же
// приём, что data-revealed в OfficeExperience). className места использования сохраняется и на
// плейсхолдере: он несёт не только object-fit (для <span> это no-op), но и геометрию/слой —
// border-radius и z-index у фона 10/90, а filter: brightness() у него же удерживает тот самый тёмный
// backdrop, на который рассчитан контент поверх. Отбросив класс, плейсхолдер сломал бы раскладку
// сильнее, чем само выпавшее фото.
function PhotoFallback({ className }: { className?: string }) {
  const fallbackClassName = className ? `${styles.fallback} ${className}` : styles.fallback;
  return <span aria-hidden="true" data-photo-fallback="true" className={fallbackClassName} />;
}

// Единственная точка рендера фотослоя офиса (WORKPLAN.md Step 8: visual layer этого milestone — это
// фото next/image, не WebGL/Canvas). Все фото офиса декоративны (alt=""): подпись отдела в rail и
// весь текст 90%-области — самостоятельный HTML рядом, не подпись к картинке. Поэтому ошибка
// загрузки не обязана поднимать состояние машины (docs/05 SCENE_ERROR/error-fallback — см. Out of
// scope Step 8): достаточно заменить битую картинку детерминированным нейтральным плейсхолдером,
// коммерческий путь (5 HTML-кнопок, текст, CTA) не зависит от фото вовсе.
export function OfficePhoto({ src, className }: OfficePhotoProps) {
  const [hasFailed, setHasFailed] = useState(false);

  if (hasFailed) {
    return <PhotoFallback className={className} />;
  }

  return (
    <Image
      src={src}
      alt=""
      fill
      unoptimized
      className={className}
      onError={() => setHasFailed(true)}
    />
  );
}

interface OfficeScenePhotoProps {
  /** Производные одной сцены (AVIF + WebP), упорядоченные по OFFICE_SCENE_WIDTHS. */
  sources: OfficeSceneSources;
  /** `sizes` для srcset — сколько места сцена занимает во вьюпорте. */
  sizes: string;
  className?: string;
  /**
   * Step 16: сцена «готова к показу» — успешно декодирована ЛИБО провалилась. Вызывается ровно один
   * раз за монтирование. Нужна SceneCrossfade, который держит предыдущую сцену до этого момента:
   * без такого сигнала переход между отделами проходил бы через пустоту (Step 13, skeptic Phase B,
   * NON-BLOCKING-1 — измеренное окно без сцены 73–1261 мс на медленном канале).
   * Провал тоже считается готовностью: иначе при недоступной сцене прежняя висела бы вечно.
   */
  onReady?: () => void;
}

/**
 * Адаптивная сцена офиса (Step 12): тот же fallback-контракт, что у {@link OfficePhoto}, но с
 * реальным выбором ширины и формата браузером.
 *
 * Почему `<picture>` с ручным srcset, а не `<Image>`:
 * 1. Производные уже предгенерированы под нужные ширины и форматы (Step 10), поэтому фотослой
 *    раздаётся `unoptimized` — повторная обработка через `/next/image` не нужна и в прошлом привела
 *    к исчерпанию эфемерных портов под e2e (см. departmentPhotos.ts). Но `<Image unoptimized>` при
 *    этом НЕ строит srcset — адаптивность оказалась бы номинальной (риск, зафиксированный в
 *    WORKPLAN.md Step 10).
 * 2. `<picture>` — единственный способ дать браузеру выбор между AVIF и WebP-фолбэком.
 *
 * Дескрипторы ширины берутся из {@link OFFICE_SCENE_WIDTHS}, а НЕ из `StaticImageData.width`:
 * Turbopack не декодирует AVIF и эмитит его как есть, поэтому у AVIF-импортов `.width` ненадёжен
 * (предупреждение из Step 10). Ширины из массива констант совпадают с реальными по построению
 * (scripts/generate-office-images.mjs).
 */
export function OfficeScenePhoto({ sources, sizes, className, onReady }: OfficeScenePhotoProps) {
  const [hasFailed, setHasFailed] = useState(false);
  // Ref, а не state: onReady обязан сработать ровно один раз за монтирование, но сам факт «уже
  // сработал» на рендер не влияет. State здесь вызвал бы лишний ре-рендер на каждой смене сцены.
  const hasSignalledRef = useRef(false);
  const signalReady = () => {
    if (hasSignalledRef.current) return;
    hasSignalledRef.current = true;
    onReady?.();
  };

  // Amendment 15: «готова» = ГОТОВА К ОТРИСОВКЕ, а не «загрузилась». Событие load срабатывает, когда
  // получены байты, но битмап ещё не декодирован; отрисовка первого кадра тогда приходится на тот же
  // кадр, в котором стартует анимация приближения, и декодирование полноэкранного AVIF/WebP отъедает
  // его целиком. Именно на этом стыке пользователь и видел рывок в начале перехода.
  // decode() резолвится, когда кадр можно рисовать без работы в основном потоке, — переход стартует
  // на подготовленной картинке.
  // Отказ decode() (элемент сняли, сменился src) тоже считается готовностью: держать ради него
  // предыдущую сцену на экране бессмысленно, а SceneCrossfade сигнал от неактуального слоя
  // игнорирует по построению.
  const signalWhenPaintable = (img: HTMLImageElement) => {
    if (hasSignalledRef.current) return;
    if (typeof img.decode !== "function") {
      signalReady();
      return;
    }
    img.decode().then(signalReady, signalReady);
  };

  if (hasFailed) {
    return <PhotoFallback className={className} />;
  }

  const srcSetOf = (derivatives: readonly StaticImageData[]) =>
    derivatives.map((image, index) => `${image.src} ${OFFICE_SCENE_WIDTHS[index]}w`).join(", ");

  // Фолбэк-`src` — самая широкая WebP-производная: её понимает любой браузер, поддерживающий WebP,
  // а srcset выше всё равно перекрывает выбор там, где он поддерживается.
  const widestWebp = sources.webp[sources.webp.length - 1];

  // Сцена приходит в SSR-разметке, поэтому браузер начинает грузить её ещё при разборе HTML — то
  // есть ЗАДОЛГО до того, как React повесит onError при гидратации. Если загрузка провалилась в это
  // окно, событие error уже прошло, обработчик его не увидит, и на месте сцены остался бы битый
  // <img> вместо плейсхолдера (найдено e2e-тестом с блокировкой фотослоя, не теоретически).
  // Поэтому состояние проверяется ещё и на монтировании. Признак провала — все три условия сразу:
  //   currentSrc !== ""  — браузер уже выбрал кандидата из <picture> (иначе загрузка и не начиналась);
  //   complete           — и завершил с ним работу;
  //   naturalWidth === 0 — и не получил ни одного пикселя.
  // Проверка на currentSrc здесь не формальность: без неё условие истинно и в jsdom, который
  // изображения не загружает в принципе, — компонент всегда откатывался бы в плейсхолдер под
  // unit-тестами, хотя в браузере всё в порядке. Тот же приём применяет next/image — по этой
  // причине OfficePhoto выше в подобной подстраховке не нуждается.
  const detectAlreadyFailed = (img: HTMLImageElement | null) => {
    if (!img || !img.currentSrc || !img.complete) return;
    if (img.naturalWidth === 0) {
      setHasFailed(true);
      // Провал — тоже готовность: держать прежнюю сцену вечно из-за недоступной новой нельзя.
      signalReady();
      return;
    }
    // Картинка уже была в кэше и загрузилась до навешивания onLoad — событие мы бы не увидели.
    signalWhenPaintable(img);
  };

  return (
    <picture>
      <source type="image/avif" srcSet={srcSetOf(sources.avif)} sizes={sizes} />
      <source type="image/webp" srcSet={srcSetOf(sources.webp)} sizes={sizes} />
      {/* Голый <img> вместо next/image — осознанно, см. док-комментарий выше: next/image не умеет
          multi-format <picture> поверх предгенерированных производных, а `unoptimized` отключает
          построение srcset. Фото декоративно (alt=""), размеры задаёт CSS. */}
      <img
        ref={detectAlreadyFailed}
        src={widestWebp.src}
        alt=""
        className={className}
        decoding="async"
        // Сцена не нужна для первой отрисовки: hero — самостоятельный HTML, а офис раскрывается
        // только по CTA. Низкий приоритет убирает конкуренцию с критическими ресурсами, но не
        // откладывает загрузку — к моменту нажатия CTA сцена уже на месте.
        fetchPriority="low"
        onLoad={(event) => signalWhenPaintable(event.currentTarget)}
        onError={() => {
          setHasFailed(true);
          signalReady();
        }}
      />
    </picture>
  );
}
