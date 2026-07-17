"use client";

import Image, { type StaticImageData } from "next/image";
import { useState } from "react";
import styles from "./OfficePhoto.module.css";

interface OfficePhotoProps {
  src: StaticImageData;
  /** Класс самого <Image> (object-fit, затемнение и т.п.) — специфичен для места использования. */
  className?: string;
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
    // className места использования сохраняется и на плейсхолдере: он несёт не только object-fit
    // (для <span> это no-op), но и геометрию/слой — border-radius и z-index у фона 10/90, а
    // filter: brightness() у него же удерживает тот самый тёмный backdrop, на который рассчитан
    // контент поверх. Отбросив класс, плейсхолдер сломал бы раскладку сильнее, чем само выпавшее фото.
    const fallbackClassName = className ? `${styles.fallback} ${className}` : styles.fallback;
    // data-photo-fallback — стабильный, не хешируемый CSS Modules хук для e2e/unit-проверок
    // (тот же приём, что data-revealed в OfficeExperience).
    return <span aria-hidden="true" data-photo-fallback="true" className={fallbackClassName} />;
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
