"use client";

import { useCallback, useMemo, useState } from "react";
import {
  ARTICLE_CATEGORIES,
  ARTICLE_PLACEMENTS,
  articlePlacementLabel,
  type ArticleStatus,
} from "@/content/article-placements";
import { stripLegacyRelatedSection } from "@/features/blog/articleBody";
import { formatRuDate } from "@/features/blog/posts";
import { SEO_TITLE_RECOMMENDED_LENGTH } from "@/lib/seo";
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
import { RelationEditor } from "./RelationEditor";
import {
  toRelationValues,
  type ArticleRelationValue,
  type RelationOption,
  type RelationTargetShape,
} from "./relationTargets";
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
  /**
   * Прежняя перелинковка адресами — как она лежит в базе.
   *
   * В интерфейсе НЕ показывается и в значение формы не попадает: с этого шага колонку выводит
   * сервер из `relations`. Поле остаётся в записи, потому что его отдаёт API статьи, и убирать его
   * из типа значило бы описывать ответ сервера неточно.
   */
  relatedSlugs: string[];
  /**
   * Связи статьи с материалами четырёх типов. Приходят СРАЗУ, вместе со списком статей, из
   * серверного рендера страницы `/admin/blog`.
   *
   * Это не оптимизация, а требование безопасности: отдельная асинхронная загрузка создала бы
   * промежуток, в котором список связей на экране ещё пуст. Сохранение в этот промежуток прислало
   * бы пустой массив как намеренную очистку и стёрло бы всю перелинковку статьи. Здесь такого
   * промежутка не существует.
   */
  relations: ArticleRelationValue[];
  author: string;
  /** Заголовок для выдачи. `null` — не задан, используется название статьи. */
  seoTitle: string | null;
  seoDescription: string;
  status: ArticleStatus;
  isFeatured: boolean;
  sortOrder: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

type StatusFilter = "all" | "draft" | "published";

/**
 * Значение формы новой статьи.
 *
 * Тип — `ArticleFormValue`, а не запись целиком: прежней колонки адресов в значении формы нет ни у
 * существующей статьи, ни у новой. Оставить её здесь значило бы отправлять при создании поле,
 * которое форма нигде не показывает и не заполняет.
 */
const EMPTY_ARTICLE: ArticleFormValue = {
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
  relations: [],
  author: "QBit-Studio-Ai",
  seoTitle: null,
  seoDescription: "",
  status: "draft",
  isFeatured: false,
  sortOrder: 0,
  publishedAt: null,
};

export function BlogEditor({
  articles,
  relationOptions,
}: {
  articles: ArticleRecordView[];
  /** Каталог материалов четырёх типов для выбора связей. Собран на сервере. */
  relationOptions: RelationOption[];
}) {
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

  /**
   * Копия статьи: тот же текст с пометкой в названии, новый адрес и статус «черновик».
   *
   * КОПИЯ СОЗДАЁТСЯ БЕЗ СВЯЗЕЙ, и это не упущение. Создание (`POST`) структурные связи не
   * принимает: у новой статьи нет идентификатора до вставки. Если бы копия при этом унаследовала
   * прежнюю колонку адресов, она вышла бы с перелинковкой в старой модели и без единой строки в
   * новой — то есть кнопка «Копия» производила бы ровно то расхождение, которое устраняет весь этот
   * шаг. Поэтому `relatedSlugs` обнуляется явно, а связи добавляются в копии после её создания.
   *
   * По той же причине из текста копии вырезается скрытая legacy-секция «Материалы по теме»
   * (REL-02F.2): новая статья секцию нести не может, и сервер отказал бы в создании копии.
   */
  const duplicate = async (article: ArticleRecordView) => {
    const payload = {
      ...article,
      bodyMarkdown: stripLegacyRelatedSection(article.bodyMarkdown),
      slug: `${article.slug}-kopiya`,
      title: `${article.title} (копия)`,
      status: "draft" as ArticleStatus,
      publishedAt: null,
      isFeatured: false,
      relatedSlugs: [],
      relations: [],
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

    // Ответ создания связей не содержит и содержать не может — у копии их нет. Пустой список
    // проставляется здесь, чтобы запись в списке имела ту же форму, что и пришедшие с сервера.
    const result = (await response.json()) as { article: ArticleRecordView };
    setRecords((current) => [...current, { ...result.article, relations: [] }]);
    setListError(null);
  };

  if (isCreating || editing) {
    return (
      <ArticleForm
        key={editing?.id ?? "new"}
        article={editing}
        relationOptions={relationOptions}
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

type ArticleFormValue = Omit<ArticleRecordView, "id" | "createdAt" | "updatedAt" | "relatedSlugs">;

/**
 * Служебные поля записи в форму не попадают: идентификатор и даты создания/изменения ставит
 * сервер, и их присутствие в значении формы делало бы «есть несохранённые изменения» истинным
 * сразу после сохранения.
 *
 * `relatedSlugs` убран по другой причине. Значение формы уходит в тело запроса целиком, а прежнюю
 * колонку адресов теперь выводит сервер из структурных связей. Оставить поле в значении формы
 * значило бы отправлять серверу второе, конкурирующее описание той же перелинковки — которое он
 * обязан игнорировать. Проще не отправлять его вовсе: тогда «клиент прислал одно, а связи говорят
 * другое» — не ситуация, которую надо разбирать, а состояние, которого нет.
 */
function toFormValue(article: ArticleRecordView): ArticleFormValue {
  const value = { ...article } as Partial<ArticleRecordView>;
  delete value.id;
  delete value.createdAt;
  delete value.updatedAt;
  delete value.relatedSlugs;
  return value as ArticleFormValue;
}

/** Значение формы без связей — тело запроса на СОЗДАНИЕ статьи. */
function withoutRelations(value: ArticleFormValue): Omit<ArticleFormValue, "relations"> {
  const copy = { ...value } as Partial<ArticleFormValue>;
  delete copy.relations;
  return copy as Omit<ArticleFormValue, "relations">;
}

function ArticleForm({
  article,
  relationOptions,
  onClose,
  onSaved,
}: {
  article: ArticleRecordView | null;
  relationOptions: RelationOption[];
  onClose: () => void;
  onSaved: (article: ArticleRecordView) => void;
}) {
  const initial: ArticleFormValue = useMemo(
    () => (article ? toFormValue(article) : { ...EMPTY_ARTICLE }),
    [article],
  );

  /**
   * Адрес и дата первой публикации зафиксированы.
   *
   * Условие ровно то же, по которому решает сервер (`slugLocked` в
   * `src/app/api/admin/articles/[id]/route.ts`): статья опубликована ИЛИ дата публикации у неё уже
   * есть — значит страница была видна снаружи, и её адрес больше не наш.
   *
   * У двух полей при этом РАЗНЫЕ основания, и обходятся они по-разному:
   *
   * — АДРЕС роут не запишет в любом случае, что бы ни прислала форма, поэтому поля ввода для него
   *   нет вовсе: вместо него текст, как у кейса. Редактируемое поле обещало бы правку, которой не
   *   будет;
   * — ДАТУ роут принимает: он защищает её только от обнуления, а присланную непустую записывает.
   *   Поэтому поле остаётся редактируемым — ошибочную дату первой публикации нужно уметь
   *   исправить, — но очистить его нельзя: пустое значение сервер всё равно не примет, а дата
   *   служит ключом к замку адреса.
   *
   * У черновика, который ни разу не публиковался, оба поля работают как прежде: его адрес ещё
   * никому не известен и подбирается как раз при подготовке материала.
   */
  const urlLocked =
    article !== null && (article.status === "published" || article.publishedAt !== null);

  const [showPreview, setShowPreview] = useState(false);

  const save = useCallback(
    async (value: ArticleFormValue) => {
      /**
       * При СОЗДАНИИ поле связей из тела убирается совсем.
       *
       * Создание их не принимает: связь хранится по идентификатору источника, а его выдаёт сервер
       * при вставке. Отправить поле, которое схема молча отбросит, — значит послать серверу
       * описание, за которое никто не отвечает. Пустой список тут ничем не лучше непустого:
       * различие только в том, что второй потерялся бы заметнее.
       */
      const requestBody = article ? value : withoutRelations(value);

      const response = await fetch(
        article ? `/api/admin/articles/${article.id}` : "/api/admin/articles",
        {
          method: article ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        },
      );

      if (!response.ok) throw await readApiError(response);

      /**
       * Связи берутся ИЗ ОТВЕТА, а не из локального состояния формы.
       *
       * `useEditableForm` делает возвращённое отсюда значение и текущим значением, и новым
       * baseline. Если бы связи в него не попали, список на экране опустел бы сразу после
       * сохранения, а следующее сохранение отправило бы этот пустой список как намеренную очистку.
       *
       * `PUT` возвращает связи всегда. `POST` их не возвращает и не может: у новой статьи связей
       * нет, они добавляются после создания — отсюда `?? []`.
       */
      const payload = (await response.json()) as {
        article: ArticleRecordView;
        relations?: readonly RelationTargetShape[];
      };
      const saved: ArticleRecordView = {
        ...payload.article,
        relations: toRelationValues(payload.relations ?? []),
      };

      onSaved(saved);
      return toFormValue(saved);
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
          {urlLocked ? (
            <div className={styles.field}>
              <span className={styles.label}>Адрес статьи (slug)</span>
              <p className={styles.readonlyValue}>/blog/{value.slug}</p>
              <span className={styles.hint}>Адрес зафиксирован после первой публикации.</span>
            </div>
          ) : (
            <TextField
              label="Адрес статьи (slug)"
              required
              hint="Строчные латинские буквы, цифры и дефис. Должен быть уникальным."
              value={value.slug}
              error={fieldErrors.slug}
              onChange={(next) => update("slug", next)}
            />
          )}
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
            hint={
              urlLocked
                ? "Дату можно исправить, но после первой публикации её нельзя очистить."
                : "Если оставить пустой, при публикации подставится сегодняшняя дата."
            }
            value={value.publishedAt ?? ""}
            error={fieldErrors.publishedAt}
            // Очистка уже существующей даты не проходит: сервер её всё равно не примет, и поле,
            // молча вернувшее прежнее значение после сохранения, читалось бы как сбой формы.
            onChange={(next) =>
              update("publishedAt", next || (urlLocked ? value.publishedAt : null))
            }
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

        {/*
          У НЕСОЗДАННОЙ СТАТЬИ СВЯЗЕЙ НЕ БЫВАЕТ, и редактор здесь не показывается.

          Причина не в аккуратности: связь хранится по идентификатору цели И источника, а
          идентификатор статье выдаёт сервер при вставке — до неё связывать нечего и не с чем.
          Создание (`POST`) поле связей не принимает вовсе. Показать редактор в этом состоянии
          значило бы предложить выбор, который исчезнет при сохранении без единого сообщения:
          форма отрапортовала бы «Сохранено», а список материалов опустел бы.

          Поэтому здесь стоит объяснение, а не отключённый список: выключенный элемент выглядит
          как временная неисправность, а не как порядок работы.
        */}
        {article ? (
          <>
            <RelationEditor
              value={value.relations}
              onChange={(next) => update("relations", next)}
              options={relationOptions}
              currentArticleId={article.id}
              placement={value.placement}
              error={fieldErrors.relations}
            />
            <p className={styles.panelNote}>
              Блок «материалы по теме» на самой странице статьи собирается по этому списку. В нём
              показываются опубликованные статьи того же раздела сайта; продукты, кейсы и отделы
              сохраняются для будущих блоков и на странице статьи пока не выводятся.
            </p>
          </>
        ) : (
          <div className={styles.field}>
            <span className={styles.label}>Материалы по теме</span>
            <p className={styles.panelNote}>
              Связи добавляются после создания статьи: сохраните её, и список материалов появится
              здесь при следующем открытии.
            </p>
          </div>
        )}

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
          hint="Заголовок для поисковой выдачи. Рекомендуемая длина — до 55–60 символов с брендом."
          recommendedLength={SEO_TITLE_RECOMMENDED_LENGTH}
          error={fieldErrors.seoTitle}
          value={value.seoTitle ?? ""}
          // Введённая строка кладётся в состояние КАК ЕСТЬ. Схлопывание «пробелов» в `null` прямо
          // в обработчике мешало бы набору: ведущий пробел исчезал бы под курсором. Пустое
          // значение превращает в `null` схема на сервере — там же, где и у продуктов.
          onChange={(next) => update("seoTitle", next)}
        />
        <p className={styles.panelNote}>
          Заголовок в выдаче, а не на странице: название статьи и её заголовок в тексте от этого
          поля не зависят. Если поле пустое, в выдачу идёт название статьи с брендом.
        </p>
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
