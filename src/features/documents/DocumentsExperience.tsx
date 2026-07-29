"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import {
  ALL_CATEGORIES,
  type DocumentCategory,
  type DocumentItem,
  type DocumentsPageCopy,
  filterByCategory,
  selectCategoryOptions,
} from "./documents";
import { DocumentMeta } from "./DocumentMeta";
import { DocumentPreview } from "./DocumentPreview";
import { DocumentsList } from "./DocumentsList";
import styles from "./DocumentsExperience.module.css";
import { useDocuments } from "./useDocuments";

/** Длительность ухода предыдущего предпросмотра. Вместе с появлением нового — 350 мс. */
const PREVIEW_LEAVE_MS = 130;

/** Стабильная ссылка на пустой каталог: иначе новый `[]` на каждом рендере сбрасывал бы мемоизацию. */
const NO_DOCUMENTS: DocumentItem[] = [];

interface DocumentsExperienceProps {
  /**
   * Каталог, отрисованный сервером. `null` переводит экран на клиентскую загрузку через
   * `loadDocuments()` — так будет, когда данные поедут из админ-панели (см. `useDocuments`).
   */
  initialDocuments: DocumentItem[] | null;
  /** Справочник категорий из админ-панели: по нему строятся подписи и порядок фильтров. */
  categories: DocumentCategory[];
  /** Тексты раздела, редактируемые в админ-панели. */
  pageCopy: DocumentsPageCopy;
  taskCtaLabel: string;
  taskCtaHref: string;
}

export function DocumentsExperience({
  initialDocuments,
  categories: categoryCatalog,
  pageCopy,
  taskCtaLabel,
  taskCtaHref,
}: DocumentsExperienceProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const { state, reload } = useDocuments(initialDocuments);

  const [activeCategory, setActiveCategory] = useState<string>(ALL_CATEGORIES);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"list" | "document">("list");
  const swapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mobileBackRef = useRef<HTMLButtonElement>(null);

  const documents = useMemo(
    () => (state.status === "ready" ? state.documents : NO_DOCUMENTS),
    [state],
  );

  const categories = useMemo(
    () => selectCategoryOptions(documents, categoryCatalog),
    [documents, categoryCatalog],
  );
  const visibleDocuments = useMemo(
    () => filterByCategory(documents, activeCategory),
    [documents, activeCategory],
  );

  /**
   * Активный документ ВЫЧИСЛЯЕТСЯ, а не хранится вторым состоянием. Отсюда бесплатно следуют два
   * требования: первый документ активен сразу при открытии раздела, и после смены категории
   * выбор, выпавший из фильтра, заменяется первым доступным — без эффекта-синхронизатора и без
   * кадра с пустым предпросмотром.
   */
  const activeDocument =
    visibleDocuments.find((item) => item.id === activeId) ?? visibleDocuments[0] ?? null;

  useEffect(
    () => () => {
      if (swapTimerRef.current) clearTimeout(swapTimerRef.current);
    },
    [],
  );

  const handleSelect = useCallback(
    (item: DocumentItem) => {
      setMobileView("document");

      if (item.id === activeDocument?.id) return;
      if (swapTimerRef.current) clearTimeout(swapTimerRef.current);

      setPendingId(item.id);
      swapTimerRef.current = setTimeout(
        () => {
          setActiveId(item.id);
          setPendingId(null);
        },
        prefersReducedMotion ? 0 : PREVIEW_LEAVE_MS,
      );
    },
    [activeDocument?.id, prefersReducedMotion],
  );

  const handleCategoryChange = useCallback((categoryId: string) => {
    setActiveCategory(categoryId);
  }, []);

  const returnToList = useCallback(() => setMobileView("list"), []);

  // На мобильном выбор документа СКРЫВАЕТ список — элемент, на котором стоял фокус. Без переноса
  // фокуса он улетел бы на <body>, и клавиатурный пользователь начал бы обход заново. На десктопе
  // кнопка скрыта (display: none), поэтому вызов там ничего не делает и фокус остаётся в списке.
  useEffect(() => {
    if (mobileView !== "document") return;
    mobileBackRef.current?.focus();
  }, [mobileView]);

  // Escape на мобильном возвращает к списку — тот же жест, что закрывает отдел на главной.
  useEffect(() => {
    if (mobileView !== "document") return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMobileView("list");
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [mobileView]);

  return (
    <main className={styles.experience} aria-label="Документы QBit-Studio-Ai">
      <div className={styles.backdrop} aria-hidden="true">
        <picture>
          <source
            type="image/avif"
            srcSet="/dox/dox-960.avif 960w, /dox/dox-1600.avif 1600w"
            sizes="100vw"
          />
          <source
            type="image/webp"
            srcSet="/dox/dox-960.webp 960w, /dox/dox-1600.webp 1600w"
            sizes="100vw"
          />
          {/* Требуемый публичный адрес фотографии. Современные браузеры возьмут производную выше,
              этот источник остаётся честным fallback-ом. */}
          <img
            src="/dox/dox.png"
            alt=""
            width={1672}
            height={941}
            decoding="async"
            fetchPriority="high"
            data-documents-background
          />
        </picture>
        <span className={styles.scrim} />
      </div>

      <div className={styles.controls}>
        <Link className={styles.back} href="/" aria-label="Назад на главную">
          <span aria-hidden="true">←</span>
          Назад
        </Link>
        <div className={styles.intro}>
          <h1>{pageCopy.headline}</h1>
          <p>{pageCopy.subheading}</p>
        </div>
        <a
          className={styles.primaryAction}
          href={taskCtaHref}
          target="_blank"
          rel="noopener noreferrer"
        >
          {taskCtaLabel}
        </a>
      </div>

      {state.status === "loading" ? (
        <div className={styles.panel} data-documents-status="loading">
          <p className={styles.statusNote} role="status">
            Загружаем документы
          </p>
          <div className={styles.skeleton} aria-hidden="true">
            <div className={styles.skeletonList}>
              {Array.from({ length: 5 }, (_, index) => (
                <span key={index} className={styles.skeletonRow} />
              ))}
            </div>
            <div className={styles.skeletonSheet} />
          </div>
        </div>
      ) : null}

      {state.status === "error" ? (
        <div className={styles.panel} data-documents-status="error">
          <div className={styles.statusBlock}>
            <p className={styles.statusTitle} role="status">
              Не удалось загрузить документы
            </p>
            <p className={styles.statusNote}>
              Проверьте соединение и попробуйте ещё раз — файлы никуда не делись.
            </p>
            <button type="button" className={styles.retry} onClick={reload}>
              Повторить
            </button>
          </div>
        </div>
      ) : null}

      {state.status === "ready" && documents.length === 0 ? (
        <div className={styles.panel} data-documents-status="empty">
          <div className={styles.statusBlock}>
            <p className={styles.statusTitle}>{pageCopy.emptyMessage}</p>
            <p className={styles.statusNote}>
              Как только материалы появятся, они будут доступны здесь для просмотра и скачивания.
            </p>
          </div>
        </div>
      ) : null}

      {state.status === "ready" && documents.length > 0 ? (
        <div className={styles.panel} data-mobile-view={mobileView} data-documents-status="ready">
          <section className={styles.catalogColumn} aria-label="Каталог документов">
            <DocumentsList
              items={visibleDocuments}
              activeId={activeDocument?.id ?? null}
              onSelect={handleSelect}
              categories={categories}
              activeCategory={activeCategory}
              onCategoryChange={handleCategoryChange}
            />
          </section>

          <section className={styles.viewerColumn} aria-label="Просмотр документа">
            <button
              ref={mobileBackRef}
              type="button"
              className={styles.mobileBack}
              onClick={returnToList}
            >
              <span aria-hidden="true">←</span>
              Назад к документам
            </button>

            {activeDocument ? (
              <>
                <DocumentPreview
                  key={activeDocument.id}
                  item={activeDocument}
                  isLeaving={pendingId !== null}
                />
                <DocumentMeta key={`meta-${activeDocument.id}`} item={activeDocument} />
              </>
            ) : null}
          </section>
        </div>
      ) : null}
    </main>
  );
}
