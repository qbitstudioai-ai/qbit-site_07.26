"use client";

import { type CSSProperties, useState } from "react";
import type { DocumentItem } from "./documents";
import { DocumentGlyph } from "./DocumentIcons";
import styles from "./DocumentsExperience.module.css";

/**
 * Заглушка формата. Показывается в двух случаях: у записи нет `previewUrl` (офисные форматы и txt —
 * изображение предпросмотра готовит сервер) и изображение не загрузилось. Текст в обоих случаях
 * один: пользователю важно, что предпросмотра нет, а не почему.
 */
export function DocumentTypeFallback({ item }: { item: DocumentItem }) {
  return (
    <div className={styles.fallback} data-document-fallback>
      <DocumentGlyph className={styles.fallbackGlyph} />
      <p className={styles.fallbackType}>{item.fileType.toUpperCase()}</p>
      <p className={styles.fallbackTitle}>{item.title}</p>
      <p className={styles.fallbackNote}>Предпросмотр недоступен</p>
    </div>
  );
}

interface DocumentPreviewProps {
  item: DocumentItem;
  /** Момент смены документа: слой уезжает вниз и гаснет, пока не смонтируется следующий. */
  isLeaving: boolean;
}

/** Пропорции листа по умолчанию — верхние ~60% страницы A4 (210 / (297 × 0.6)). */
const PAGE_ASPECT = 1.19;

export function DocumentPreview({ item, isLeaving }: DocumentPreviewProps) {
  const [hasImageError, setHasImageError] = useState(false);
  /**
   * Пропорции реального изображения известны только после загрузки, и от них зависит способ показа:
   *  — вертикальный документ (страница) обрезается контейнером сверху вниз, низ уходит в затемнение;
   *  — горизонтальный (слайд презентации, альбомный скан) показывается целиком, без обрезки,
   *    иначе у него срезало бы левый и правый край.
   * До загрузки лист держит пропорции страницы — так он не «прыгает» при появлении.
   */
  const [naturalAspect, setNaturalAspect] = useState<number | null>(null);

  const showImage = Boolean(item.previewUrl) && !hasImageError;
  const isWide = naturalAspect !== null && naturalAspect >= 1;
  const sheetAspect = isWide ? naturalAspect : PAGE_ASPECT;

  return (
    <div
      className={`${styles.stage} ${isLeaving ? styles.stageLeaving : ""}`}
      data-document-preview={item.id}
    >
      <figure
        className={styles.sheet}
        style={{ "--sheet-aspect": sheetAspect } as CSSProperties}
        data-preview-mode={showImage ? (isWide ? "wide" : "page") : "fallback"}
      >
        {showImage ? (
          // Обычный <img>: previewUrl приходит из данных (в будущем — из админ-панели), его размеры
          // заранее неизвестны, а next/image потребовал бы статического импорта либо конфигурации
          // внешнего домена.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className={styles.sheetImage}
            src={item.previewUrl}
            alt={`Первая страница документа «${item.title}»`}
            decoding="async"
            onLoad={(event) => {
              const { naturalWidth, naturalHeight } = event.currentTarget;
              if (naturalWidth > 0 && naturalHeight > 0) {
                setNaturalAspect(naturalWidth / naturalHeight);
              }
            }}
            onError={() => setHasImageError(true)}
          />
        ) : (
          <DocumentTypeFallback item={item} />
        )}
        {showImage && !isWide ? <span className={styles.sheetFade} aria-hidden="true" /> : null}
      </figure>
    </div>
  );
}
