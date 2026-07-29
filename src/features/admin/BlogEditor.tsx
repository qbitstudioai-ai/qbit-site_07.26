"use client";

import { useCallback, useMemo, useState } from "react";
import {
  ARTICLE_CATEGORIES,
  ARTICLE_PLACEMENTS,
  articlePlacementLabel,
  type ArticleStatus,
} from "@/content/article-placements";
import { formatRuDate } from "@/features/blog/posts";
import styles from "./admin.module.css";
import { MarkdownPreview } from "./MarkdownPreview";
import {
  CheckboxField,
  ConfirmDialog,
  SaveBar,
  SelectField,
  TextAreaField,
  TextField,
} from "./formKit";
import { readApiError, useEditableForm } from "./useEditableForm";

/**
 * Раздел «Блог».
 *
 * Раздел сайта («размещение») выбирается ИЗ СПИСКА, а не вводится текстом: значения приходят из
 * общего справочника `src/content/article-placements.ts`, который читают и админ-панель, и API, и
 * публичные страницы. Статья с выдуманным разделом не появилась бы нигде и выглядела бы как
 * пропавшие данные.
 *
 * Формат текста — Markdown: именно в нём написаны все существующие статьи, и именно его разбирает
 * публичная страница. Поэтому здесь Markdown-редактор с предпросмотром, а не визуальный редактор,
 * который пришлось бы конвертировать туда-обратно.
 */

export interface ArticleRecordView {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  description: string;
  bodyMarkdown: string;
  coverUrl: string;
  coverAlt: string;
  placement: string;
  category: string;
  tags: string[];
  relatedSlugs: string[];
  author: string;
  seoTitle: string;
  seoDescription: string;
  status: ArticleStatus;
  isFeatured: boolean;
  sortOrder: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

type StatusFilter = "all" | "draft" | "published";

const EMPTY_ARTICLE: Omit<ArticleRecordView, "id" | "createdAt" | "updatedAt"> = {
  slug: "",
  title: "",
  excerpt: "",
  description: "",
  bodyMarkdown: "",
  coverUrl: "/blog/workspace-notebook-1672.webp",
  coverAlt: "Рабочий стол с открытым блокнотом",
  placement: ARTICLE_PLACEMENTS[0].value,
  category: ARTICLE_CATEGORIES[0],
  tags: [],
  relatedSlugs: [],
  author: "QBit-Studio-Ai",
  seoTitle: "",
  seoDescription: "",
  status: "draft",
  isFeatured: false,
  sortOrder: 0,
  publishedAt: null,
};

export function BlogEditor({ articles }: { articles: ArticleRecordView[] }) {
  const [records, setRecords] = useState(articles);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [placementFilter, setPlacementFilter] = useState("all");
  const [pendingDelete, setPendingDelete] = useState<ArticleRecordView | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return records.filter((article) => {
      if (query && !article.title.toLowerCase().includes(query)) return false;
      if (statusFilter !== "all" && article.status !== statusFilter) return false;
      if (placementFilter !== "all" && article.placement !== placementFilter) return false;
      return true;
    });
  }, [records, search, statusFilter, placementFilter]);

  const editing = records.find((article) => article.id === editingId) ?? null;

  const confirmDelete = async () => {
    if (!pendingDelete) return;

    setIsDeleting(true);
    const response = await fetch(`/api/admin/articles/${pendingDelete.id}`, { method: "DELETE" });
    setIsDeleting(false);

    if (!response.ok) {
      const failure = await readApiError(response);
      setListError(failure.message);
      setPendingDelete(null);
      return;
    }

    setRecords((current) => current.filter((article) => article.id !== pendingDelete.id));
    if (editingId === pendingDelete.id) setEditingId(null);
    setPendingDelete(null);
    setListError(null);
  };

  /** Копия статьи: тот же текст с пометкой в названии, новый адрес и статус «черновик». */
  const duplicate = async (article: ArticleRecordView) => {
    const payload = {
      ...article,
      slug: `${article.slug}-kopiya`,
      title: `${article.title} (копия)`,
      status: "draft" as ArticleStatus,
      publishedAt: null,
      isFeatured: false,
    };

    const response = await fetch("/api/admin/articles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const failure = await readApiError(response);
      setListError(failure.message);
      return;
    }

    const result = (await response.json()) as { article: ArticleRecordView };
    setRecords((current) => [...current, result.article]);
    setListError(null);
  };

  if (isCreating || editing) {
    return (
      <ArticleForm
        key={editing?.id ?? "new"}
        article={editing}
        onClose={() => {
          setIsCreating(false);
          setEditingId(null);
        }}
        onSaved={(saved) =>
          setRecords((current) => {
            const exists = current.some((article) => article.id === saved.id);
            return exists
              ? current.map((article) => (article.id === saved.id ? saved : article))
              : [...current, saved];
          })
        }
      />
    );
  }

  return (
    <>
      <div className={styles.actions} style={{ marginBottom: 16 }}>
        <button type="button" className={styles.buttonPrimary} onClick={() => setIsCreating(true)}>
          Создать статью
        </button>
      </div>

      {listError ? (
        <p className={styles.messageError} role="alert">
          {listError}
        </p>
      ) : null}

      <div className={styles.filters}>
        <TextField label="Поиск по названию" value={search} onChange={setSearch} />
        <SelectField
          label="Статус"
          value={statusFilter}
          onChange={(next) => setStatusFilter(next as StatusFilter)}
          options={[
            { value: "all", label: "Все" },
            { value: "published", label: "Опубликованные" },
            { value: "draft", label: "Черновики" },
          ]}
        />
        <SelectField
          label="Раздел сайта"
          value={placementFilter}
          onChange={setPlacementFilter}
          options={[
            { value: "all", label: "Все разделы" },
            ...ARTICLE_PLACEMENTS.map((item) => ({ value: item.value, label: item.label })),
          ]}
        />
      </div>

      {visible.length === 0 ? (
        <p className={styles.messageEmpty}>
          {records.length === 0 ? "Данные ещё не добавлены" : "Ничего не найдено по этим условиям"}
        </p>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Название</th>
                <th scope="col">Раздел</th>
                <th scope="col">Статус</th>
                <th scope="col">Публикация</th>
                <th scope="col">Изменена</th>
                <th scope="col">Порядок</th>
                <th scope="col">Действия</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((article) => (
                <tr key={article.id}>
                  <td>
                    <strong>{article.title}</strong>
                    <span className={styles.recordMeta}>/{article.slug}</span>
                  </td>
                  <td>{articlePlacementLabel(article.placement)}</td>
                  <td>
                    <span
                      className={`${styles.badge} ${
                        article.status === "published" ? styles.badgePublished : styles.badgeDraft
                      }`}
                    >
                      {article.status === "published" ? "Опубликована" : "Черновик"}
                    </span>
                  </td>
                  <td className={styles.cellNowrap}>
                    {article.publishedAt ? formatRuDate(article.publishedAt) : "—"}
                  </td>
                  <td className={styles.cellNowrap}>
                    {formatRuDate(article.updatedAt.slice(0, 10))}
                  </td>
                  <td>{article.sortOrder}</td>
                  <td>
                    <div className={styles.tableActions}>
                      <button
                        type="button"
                        className={`${styles.button} ${styles.buttonSmall}`}
                        onClick={() => setEditingId(article.id)}
                      >
                        Редактировать
                      </button>
                      {article.status === "published" ? (
                        <a
                          className={`${styles.buttonGhost} ${styles.buttonSmall}`}
                          href={`/blog/${article.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Открыть ↗
                        </a>
                      ) : null}
                      <button
                        type="button"
                        className={`${styles.button} ${styles.buttonSmall}`}
                        onClick={() => void duplicate(article)}
                      >
                        Копия
                      </button>
                      <button
                        type="button"
                        className={`${styles.buttonDanger} ${styles.buttonSmall}`}
                        onClick={() => setPendingDelete(article)}
                      >
                        Удалить
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pendingDelete ? (
        <ConfirmDialog
          title="Удалить статью?"
          text={`«${pendingDelete.title}» будет удалена без возможности вернуть её через панель. Предыдущая версия сохранится в истории изменений базы.`}
          isBusy={isDeleting}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setPendingDelete(null)}
        />
      ) : null}
    </>
  );
}

type ArticleFormValue = Omit<ArticleRecordView, "id" | "createdAt" | "updatedAt">;

/**
 * Служебные поля записи в форму не попадают: идентификатор и даты создания/изменения ставит
 * сервер, и их присутствие в значении формы делало бы «есть несохранённые изменения» истинным
 * сразу после сохранения.
 */
function toFormValue(article: ArticleRecordView): ArticleFormValue {
  const value = { ...article } as Partial<ArticleRecordView>;
  delete value.id;
  delete value.createdAt;
  delete value.updatedAt;
  return value as ArticleFormValue;
}

function ArticleForm({
  article,
  onClose,
  onSaved,
}: {
  article: ArticleRecordView | null;
  onClose: () => void;
  onSaved: (article: ArticleRecordView) => void;
}) {
  const initial: ArticleFormValue = useMemo(
    () => (article ? toFormValue(article) : { ...EMPTY_ARTICLE }),
    [article],
  );

  const [showPreview, setShowPreview] = useState(false);

  const save = useCallback(
    async (value: ArticleFormValue) => {
      const response = await fetch(
        article ? `/api/admin/articles/${article.id}` : "/api/admin/articles",
        {
          method: article ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(value),
        },
      );

      if (!response.ok) throw await readApiError(response);

      const payload = (await response.json()) as { article: ArticleRecordView };
      onSaved(payload.article);
      return toFormValue(payload.article);
    },
    [article, onSaved],
  );

  const form = useEditableForm(initial, save);
  const { value, setValue, fieldErrors, isDirty } = form;

  const update = <K extends keyof ArticleFormValue>(key: K, next: ArticleFormValue[K]) =>
    setValue((current) => ({ ...current, [key]: next }));

  /** Смена статуса — то же сохранение, только с другим значением: отдельного роута ему не нужно. */
  const saveWithStatus = async (status: ArticleStatus) => {
    setValue((current) => ({
      ...current,
      status,
      publishedAt:
        status === "published"
          ? (current.publishedAt ?? new Date().toISOString().slice(0, 10))
          : current.publishedAt,
    }));
    // Сохранение выполнится следующим кликом «Сохранить»: так владелец сайта видит, что именно
    // изменилось, до отправки. Скрытая публикация «одной кнопкой мимо формы» была бы неожиданной.
  };

  return (
    <div>
      <div className={styles.actions} style={{ marginBottom: 16 }}>
        <button
          type="button"
          className={styles.button}
          onClick={() => {
            if (
              isDirty &&
              !window.confirm("Есть несохранённые изменения. Закрыть без сохранения?")
            ) {
              return;
            }
            onClose();
          }}
        >
          ← К списку статей
        </button>
      </div>

      <SaveBar
        form={form}
        publicHref={article && value.status === "published" ? `/blog/${value.slug}` : undefined}
      >
        {value.status === "published" ? (
          <button
            type="button"
            className={styles.button}
            onClick={() => void saveWithStatus("draft")}
          >
            Снять с публикации
          </button>
        ) : (
          <button
            type="button"
            className={styles.button}
            onClick={() => void saveWithStatus("published")}
          >
            Подготовить к публикации
          </button>
        )}
      </SaveBar>

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Основное</h2>

        <TextField
          label="Название"
          required
          value={value.title}
          error={fieldErrors.title}
          onChange={(next) => update("title", next)}
        />

        <div className={styles.fieldRow}>
          <TextField
            label="Адрес статьи (slug)"
            required
            hint="Строчные латинские буквы, цифры и дефис. Должен быть уникальным."
            value={value.slug}
            error={fieldErrors.slug}
            onChange={(next) => update("slug", next)}
          />
          <TextField
            label="Автор"
            value={value.author}
            error={fieldErrors.author}
            onChange={(next) => update("author", next)}
          />
        </div>

        <TextAreaField
          label="Краткий анонс"
          required
          rows={3}
          hint="Показывается в списке статей и в начале материала."
          value={value.excerpt}
          error={fieldErrors.excerpt}
          onChange={(next) => update("excerpt", next)}
        />
      </section>

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Размещение</h2>
        <p className={styles.panelNote}>
          Раздел сайта определяет, в каком списке появится статья. Значения приходят из общего
          справочника разделов — произвольный текст здесь ввести нельзя.
        </p>

        <div className={styles.fieldRow}>
          <SelectField
            label="Раздел сайта"
            required
            value={value.placement}
            error={fieldErrors.placement}
            onChange={(next) => update("placement", next)}
            options={ARTICLE_PLACEMENTS.map((item) => ({ value: item.value, label: item.label }))}
          />
          <SelectField
            label="Рубрика"
            value={value.category}
            onChange={(next) => update("category", next)}
            options={ARTICLE_CATEGORIES.map((item) => ({ value: item, label: item }))}
          />
        </div>

        <div className={styles.fieldRow}>
          <SelectField
            label="Статус"
            required
            value={value.status}
            onChange={(next) => update("status", next as ArticleStatus)}
            options={[
              { value: "draft", label: "Черновик" },
              { value: "published", label: "Опубликована" },
            ]}
          />
          <TextField
            label="Дата публикации"
            type="date"
            hint="Если оставить пустой, при публикации подставится сегодняшняя дата."
            value={value.publishedAt ?? ""}
            error={fieldErrors.publishedAt}
            onChange={(next) => update("publishedAt", next || null)}
          />
          <TextField
            label="Порядок отображения"
            type="number"
            hint="Меньшее число — выше в списке."
            value={String(value.sortOrder)}
            onChange={(next) => update("sortOrder", Number(next) || 0)}
          />
        </div>

        <CheckboxField
          label="Закреплённая (рекомендуемая) статья"
          checked={value.isFeatured}
          onChange={(checked) => update("isFeatured", checked)}
        />
      </section>

      <section className={styles.panel}>
        <div className={styles.actions} style={{ marginBottom: 12 }}>
          <h2 className={styles.panelTitle} style={{ marginRight: "auto" }}>
            Текст статьи (Markdown)
          </h2>
          <button
            type="button"
            className={styles.button}
            onClick={() => setShowPreview((current) => !current)}
          >
            {showPreview ? "Скрыть предпросмотр" : "Показать предпросмотр"}
          </button>
        </div>

        <p className={styles.panelNote}>
          Заголовок раздела — строка вида <code>**Название раздела:**</code>. Доступны списки (
          <code>-</code> и <code>1.</code>), жирный (<code>**текст**</code>), курсив (
          <code>*текст*</code>), ссылки <code>[текст](адрес)</code>, код в тройных апострофах.
          Произвольный HTML и <code>&lt;script&gt;</code> не выполняются: текст разбирается и
          отрисовывается как разметка, а не вставляется в страницу.
        </p>

        <TextAreaField
          label="Основной текст"
          required
          monospace
          rows={24}
          value={value.bodyMarkdown}
          error={fieldErrors.bodyMarkdown}
          onChange={(next) => update("bodyMarkdown", next)}
        />

        {showPreview ? (
          <div className={styles.previewBox} style={{ display: "block" }}>
            <MarkdownPreview markdown={value.bodyMarkdown} />
          </div>
        ) : null}
      </section>

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Обложка</h2>
        <div className={styles.fieldRow}>
          <TextField
            label="Адрес изображения"
            hint="Файл из папки public, например /blog/workspace-notebook-1672.webp"
            value={value.coverUrl}
            onChange={(next) => update("coverUrl", next)}
          />
          <TextField
            label="Описание изображения"
            hint="Альтернативный текст для скринридеров."
            value={value.coverAlt}
            onChange={(next) => update("coverAlt", next)}
          />
        </div>
        {value.coverUrl ? (
          <div className={styles.previewBox}>
            {/* Обычный <img>: адрес приходит из формы и заранее неизвестен. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={styles.previewImage} src={value.coverUrl} alt="" />
            <span className={styles.hint}>Так выглядит выбранная обложка.</span>
          </div>
        ) : null}
      </section>

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Связи и поисковые системы</h2>

        <TextField
          label="Материалы по теме (адреса статей через запятую)"
          hint="Например: sayt-crm-i-messendzhery, chto-mozhno-avtomatizirovat-na-n8n"
          value={value.relatedSlugs.join(", ")}
          onChange={(next) =>
            update(
              "relatedSlugs",
              next
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean),
            )
          }
        />

        <TextField
          label="Теги (через запятую)"
          value={value.tags.join(", ")}
          onChange={(next) =>
            update(
              "tags",
              next
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean),
            )
          }
        />

        <TextField
          label="SEO title"
          hint="Если пусто — используется название статьи."
          value={value.seoTitle}
          onChange={(next) => update("seoTitle", next)}
        />
        <TextAreaField
          label="SEO description"
          rows={3}
          hint="Если пусто — используется краткий анонс."
          value={value.seoDescription}
          onChange={(next) => update("seoDescription", next)}
        />
      </section>

      <SaveBar
        form={form}
        publicHref={article && value.status === "published" ? `/blog/${value.slug}` : undefined}
      />
    </div>
  );
}
