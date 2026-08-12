"use client";

import { useCallback, useMemo, useState } from "react";
import { formatRuDate } from "@/features/blog/posts";
import { SEO_TITLE_RECOMMENDED_LENGTH } from "@/lib/seo";
import styles from "./admin.module.css";
import { CheckboxField, ConfirmDialog, ListEditor, TextAreaField, TextField } from "./formKit";
import { slugFromTitle } from "./slugFromTitle";
import { readApiError, useEditableForm } from "./useEditableForm";

/**
 * Раздел «Кейсы».
 *
 * Управляет делами архива — теми самыми документами, которые посетитель видит на `/cases`.
 * Устройство раздела намеренно проще, чем у блога:
 *
 * — ЧЕРНОВИКОВ НЕТ. У формы создания одна конечная кнопка «Опубликовать»: кейс либо существует на
 *   сайте, либо не существует вовсе. Промежуточное состояние «сохранён, но не виден» пришлось бы
 *   объяснять владельцу сайта, а пользы от него нет — кейс пишется по утверждённому тексту и
 *   публикуется целиком;
 * — АДРЕС ФИКСИРОВАН. До публикации `slug` редактируется свободно, после — показывается только для
 *   чтения. Смена адреса опубликованной страницы обрывает внешние ссылки и обнуляет её историю в
 *   поиске, поэтому случайно выполнить её нельзя (сервер игнорирует присланный адрес);
 * — РАЗМЕТКИ НЕТ. Владелец сайта заполняет поля, а не пишет HTML или Markdown: структура досье
 *   (краткий итог → задача → реализация → процесс → результат → метрика → человек → ограничение)
 *   собирается кодом и потому одинакова у всех дел архива.
 */

export interface CaseRecordView {
  id: string;
  slug: string;
  title: string;
  shortTitle: string;
  fileNumber: string;
  summary: string;
  task: string;
  implementation: string;
  workflowSteps: string[];
  result: string;
  metricLabel: string;
  metricBefore: string;
  metricAfter: string;
  metricSource: string;
  humanControl: string;
  limitations: string;
  seoTitle: string;
  seoDescription: string;
  ogDescription: string;
  stampEnabled: boolean;
  sortOrder: number;
  publishedAt: string | null;
  modifiedAt: string | null;
}

/** Поля, которые редактирует человек. Всё остальное — служебное и приходит от сервера. */
type CaseFormValue = Omit<CaseRecordView, "id" | "publishedAt" | "modifiedAt">;

const META_DESCRIPTION_RECOMMENDED_LENGTH = 160;

function emptyCase(sortOrder: number): CaseFormValue {
  return {
    slug: "",
    title: "",
    shortTitle: "",
    fileNumber: String(sortOrder).padStart(2, "0"),
    summary: "",
    task: "",
    implementation: "",
    workflowSteps: [],
    result: "",
    metricLabel: "",
    metricBefore: "",
    metricAfter: "",
    metricSource: "",
    humanControl: "",
    limitations: "",
    seoTitle: "",
    seoDescription: "",
    ogDescription: "",
    // Печать включена по умолчанию: это документ архива, и она часть его вида.
    stampEnabled: true,
    sortOrder,
  };
}

/**
 * Запись → значение формы. Поля перечислены поимённо, а не копируются целиком: сервер отдаёт и
 * служебные поля (идентификатор, даты, подписи модели, статус), и попади они в значение формы,
 * «есть несохранённые изменения» становилось бы истинным сразу после сохранения, а в теле запроса
 * уезжало бы то, чего форма не редактирует.
 */
function toFormValue(record: CaseRecordView): CaseFormValue {
  return {
    slug: record.slug,
    title: record.title,
    shortTitle: record.shortTitle,
    fileNumber: record.fileNumber,
    summary: record.summary,
    task: record.task,
    implementation: record.implementation,
    workflowSteps: [...record.workflowSteps],
    result: record.result,
    metricLabel: record.metricLabel,
    metricBefore: record.metricBefore,
    metricAfter: record.metricAfter,
    metricSource: record.metricSource,
    humanControl: record.humanControl,
    limitations: record.limitations,
    seoTitle: record.seoTitle,
    seoDescription: record.seoDescription,
    ogDescription: record.ogDescription,
    stampEnabled: record.stampEnabled,
    sortOrder: record.sortOrder,
  };
}

/** Дата для списка. `null` — подтверждённой даты нет, и придумывать её нельзя. */
function formatMoment(iso: string | null): string {
  return iso ? formatRuDate(iso.slice(0, 10)) : "—";
}

export function CasesEditor({
  cases,
  nextSortOrder,
}: {
  cases: CaseRecordView[];
  nextSortOrder: number;
}) {
  const [records, setRecords] = useState(cases);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<CaseRecordView | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  /** Кейс, опубликованный только что: список показывает подтверждение и ссылку на страницу. */
  const [published, setPublished] = useState<CaseRecordView | null>(null);

  const editing = records.find((study) => study.id === editingId) ?? null;
  const freeSortOrder = useMemo(
    () => Math.max(nextSortOrder, ...records.map((study) => study.sortOrder + 1), 1),
    [nextSortOrder, records],
  );

  const confirmDelete = async () => {
    if (!pendingDelete) return;

    setIsDeleting(true);
    const response = await fetch(`/api/admin/cases/${pendingDelete.id}`, { method: "DELETE" });
    setIsDeleting(false);

    if (!response.ok) {
      const failure = await readApiError(response);
      setListError(failure.message);
      setPendingDelete(null);
      return;
    }

    setRecords((current) => current.filter((study) => study.id !== pendingDelete.id));
    if (editingId === pendingDelete.id) setEditingId(null);
    if (published?.id === pendingDelete.id) setPublished(null);
    setPendingDelete(null);
    setListError(null);
  };

  if (isCreating || editing) {
    return (
      <CaseForm
        key={editing?.id ?? "new"}
        record={editing}
        nextSortOrder={freeSortOrder}
        onClose={() => {
          setIsCreating(false);
          setEditingId(null);
        }}
        onSaved={(saved) =>
          setRecords((current) =>
            current.some((study) => study.id === saved.id)
              ? current.map((study) => (study.id === saved.id ? saved : study))
              : [...current, saved],
          )
        }
        onPublished={(saved) => {
          setPublished(saved);
          setIsCreating(false);
        }}
      />
    );
  }

  return (
    <>
      <div className={styles.actions} style={{ marginBottom: 16 }}>
        <button
          type="button"
          className={styles.buttonPrimary}
          onClick={() => {
            setPublished(null);
            setIsCreating(true);
          }}
        >
          Добавить кейс
        </button>
      </div>

      {published ? (
        <div className={styles.panel}>
          <p className={styles.messageSuccess} role="status">
            Кейс опубликован
          </p>
          <p className={styles.panelNote}>
            «{published.shortTitle}» уже открывается по адресу /cases/{published.slug} и попал в
            карту сайта.
          </p>
          <div className={styles.actions}>
            <a
              className={styles.buttonGhost}
              href={`/cases/${published.slug}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Открыть на сайте ↗
            </a>
            <button
              type="button"
              className={styles.button}
              onClick={() => setEditingId(published.id)}
            >
              Редактировать
            </button>
          </div>
        </div>
      ) : null}

      {listError ? (
        <p className={styles.messageError} role="alert">
          {listError}
        </p>
      ) : null}

      {records.length === 0 ? (
        <p className={styles.messageEmpty}>Данные ещё не добавлены</p>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">№ дела</th>
                <th scope="col">Название</th>
                <th scope="col">Адрес</th>
                <th scope="col">Опубликован</th>
                <th scope="col">Изменён</th>
                <th scope="col">Порядок</th>
                <th scope="col">Действия</th>
              </tr>
            </thead>
            <tbody>
              {records.map((study) => (
                <tr key={study.id}>
                  <td className={styles.cellNowrap}>{study.fileNumber}</td>
                  <td>
                    <strong>{study.shortTitle}</strong>
                    <span className={styles.recordMeta}>{study.title}</span>
                  </td>
                  <td className={styles.cellNowrap}>
                    {/* Адрес — сразу и ссылка на страницу сайта: отдельная кнопка «Открыть» в
                        строке съедала ширину и выталкивала «Удалить» за край таблицы. */}
                    <a href={`/cases/${study.slug}`} target="_blank" rel="noopener noreferrer">
                      /cases/{study.slug} ↗
                    </a>
                  </td>
                  <td className={styles.cellNowrap}>{formatMoment(study.publishedAt)}</td>
                  <td className={styles.cellNowrap}>{formatMoment(study.modifiedAt)}</td>
                  <td>{study.sortOrder}</td>
                  <td>
                    <div className={styles.tableActions}>
                      <button
                        type="button"
                        className={`${styles.button} ${styles.buttonSmall}`}
                        onClick={() => setEditingId(study.id)}
                      >
                        Редактировать
                      </button>
                      <button
                        type="button"
                        className={`${styles.buttonDanger} ${styles.buttonSmall}`}
                        onClick={() => setPendingDelete(study)}
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

      {/* Удаление в один клик невозможно: сначала подтверждение с последствиями. */}
      {pendingDelete ? (
        <ConfirmDialog
          title={`Удалить кейс «${pendingDelete.shortTitle}»?`}
          text="Кейс будет удалён с сайта и из карты сайта. Его адрес начнёт отвечать «страница не найдена». Предыдущая версия текста сохранится в истории изменений базы."
          isBusy={isDeleting}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setPendingDelete(null)}
        />
      ) : null}
    </>
  );
}

function CaseForm({
  record,
  nextSortOrder,
  onClose,
  onSaved,
  onPublished,
}: {
  record: CaseRecordView | null;
  nextSortOrder: number;
  onClose: () => void;
  onSaved: (record: CaseRecordView) => void;
  onPublished: (record: CaseRecordView) => void;
}) {
  const isNew = record === null;
  const initial = useMemo(
    () => (record ? toFormValue(record) : emptyCase(nextSortOrder)),
    [record, nextSortOrder],
  );

  /**
   * Правил ли человек адрес сам.
   *
   * Пока не правил, адрес следует за названием — это и есть «предложить slug из названия». Как
   * только поле тронули, подстановка прекращается: иначе набранный вручную адрес стирался бы при
   * каждой правке заголовка.
   */
  const [isSlugTouched, setIsSlugTouched] = useState(!isNew);

  const save = useCallback(
    async (value: CaseFormValue) => {
      const response = await fetch(record ? `/api/admin/cases/${record.id}` : "/api/admin/cases", {
        method: record ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(value),
      });

      if (!response.ok) throw await readApiError(response);

      const payload = (await response.json()) as { caseStudy: CaseRecordView };
      onSaved(payload.caseStudy);
      if (!record) onPublished(payload.caseStudy);
      return toFormValue(payload.caseStudy);
    },
    [record, onSaved, onPublished],
  );

  const form = useEditableForm(initial, save);
  const { value, setValue, fieldErrors, saveState, isDirty } = form;

  const update = <K extends keyof CaseFormValue>(key: K, next: CaseFormValue[K]) =>
    setValue((current) => ({ ...current, [key]: next }));

  const handleTitleChange = (next: string) => {
    setValue((current) => ({
      ...current,
      title: next,
      slug: isSlugTouched ? current.slug : slugFromTitle(next),
    }));
  };

  const isSaving = saveState.status === "saving";

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
          ← К списку кейсов
        </button>
      </div>

      <ActionBar
        isNew={isNew}
        isSaving={isSaving}
        isDirty={isDirty}
        message={saveState.status === "error" ? saveState.message : null}
        isSaved={saveState.status === "saved"}
        publicHref={record ? `/cases/${value.slug}` : undefined}
        onSubmit={() => void form.save()}
      />

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Основное</h2>

        <TextField
          label="Название кейса"
          required
          hint="Заголовок документа — то, что посетитель видит первым на странице кейса."
          value={value.title}
          error={fieldErrors.title}
          onChange={handleTitleChange}
        />

        <div className={styles.fieldRow}>
          <TextField
            label="Короткое название"
            required
            hint="Имя папки в картотеке слева. Короче заголовка документа."
            value={value.shortTitle}
            error={fieldErrors.shortTitle}
            onChange={(next) => update("shortTitle", next)}
          />
          {isNew ? (
            <TextField
              label="Адрес кейса (URL)"
              required
              hint="Строчные латинские буквы, цифры и дефис. Предлагается по названию, но его можно изменить — до публикации."
              value={value.slug}
              error={fieldErrors.slug}
              onChange={(next) => {
                setIsSlugTouched(true);
                update("slug", next);
              }}
            />
          ) : (
            /**
             * После публикации адрес показывается, но не редактируется.
             *
             * Не «на всякий случай»: смена адреса опубликованной страницы обрывает внешние ссылки,
             * обнуляет её историю в поиске и оставляет прежний адрес отвечать 404. Отдельной
             * операции переезда с перенаправлением в проекте нет, поэтому и поля для неё нет.
             */
            <div className={styles.field}>
              <span className={styles.label}>Адрес кейса (URL)</span>
              <p className={styles.readonlyValue}>/cases/{value.slug}</p>
              <span className={styles.hint}>
                Адрес опубликованного кейса не меняется: по нему на страницу уже ведут внешние
                ссылки и карта сайта.
              </span>
            </div>
          )}
        </div>

        <div className={styles.fieldRow}>
          <TextField
            label="Номер дела"
            required
            hint={
              isNew
                ? "Например: 02. Показывается в шапке документа и на папке. Ведущий ноль — часть номера."
                : "Показывается в шапке документа и на папке. После публикации менять его не стоит: номер входит в адреса разделов документа (#case-NN-…), и внешние ссылки внутрь кейса перестанут работать."
            }
            value={value.fileNumber}
            error={fieldErrors.fileNumber}
            onChange={(next) => update("fileNumber", next)}
          />
          <TextField
            label="Порядок в картотеке"
            type="number"
            hint="Меньшее число — выше в списке дел."
            value={String(value.sortOrder)}
            error={fieldErrors.sortOrder}
            onChange={(next) => update("sortOrder", Number(next) || 0)}
          />
        </div>
      </section>

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Краткий итог</h2>
        <p className={styles.panelNote}>
          Первый раздел документа. Абзацы разделяются пустой строкой — так же, как набраны здесь.
        </p>
        <TextAreaField
          label="Краткий итог"
          required
          rows={6}
          hint="Коротко опишите проблему, что было автоматизировано и фактический результат."
          value={value.summary}
          error={fieldErrors.summary}
          onChange={(next) => update("summary", next)}
        />
      </section>

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Задача</h2>
        <TextAreaField
          label="Задача"
          required
          rows={6}
          hint="Что требовалось изменить и в каких обстоятельствах работала компания до внедрения."
          value={value.task}
          error={fieldErrors.task}
          onChange={(next) => update("task", next)}
        />
      </section>

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Что реализовали</h2>
        <TextAreaField
          label="Что реализовали"
          required
          rows={6}
          hint="Что именно автоматизировано. Цепочка процесса ниже встанет сразу после первого абзаца."
          value={value.implementation}
          error={fieldErrors.implementation}
          onChange={(next) => update("implementation", next)}
        />
      </section>

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Цепочка процесса</h2>
        <p className={styles.panelNote}>
          Шаги показываются нумерованным списком внутри раздела «Что реализовали». Оставьте список
          пустым, если цепочка этому кейсу не нужна.
        </p>
        <ListEditor
          label="Шаги процесса"
          items={value.workflowSteps}
          onChange={(next) => update("workflowSteps", next)}
          createItem={() => ""}
          addLabel="Добавить шаг"
          hint="Например: звонки менеджеров → автоматическая обработка → AI-анализ → отчёт → руководитель."
          renderItem={(step, replace, index) => (
            <TextField
              label={`Шаг ${index + 1}`}
              value={step}
              error={fieldErrors[`workflowSteps.${index}`]}
              onChange={replace}
            />
          )}
        />
      </section>

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Результат</h2>
        <TextAreaField
          label="Результат"
          required
          rows={6}
          hint="Первый абзац — сам результат. Следующие абзацы встанут после таблицы «до/после»: там место короткой оговорке о применимости."
          value={value.result}
          error={fieldErrors.result}
          onChange={(next) => update("result", next)}
        />
      </section>

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Измеримый результат</h2>
        <p className={styles.panelNote}>
          Таблица «До / После» собирается из этих полей автоматически. Заполните все четыре или
          оставьте блок пустым: цифра без второй половины пары и без источника — это уже обещание, а
          не измерение.
        </p>

        <TextField
          label="Название показателя"
          hint="Например: время руководителя на контроль звонков."
          value={value.metricLabel}
          error={fieldErrors.metricLabel}
          onChange={(next) => update("metricLabel", next)}
        />
        <div className={styles.fieldRow}>
          <TextField
            label="До"
            hint="Например: 4–5 часов в неделю."
            value={value.metricBefore}
            error={fieldErrors.metricBefore}
            onChange={(next) => update("metricBefore", next)}
          />
          <TextField
            label="После"
            hint="Например: 10–15 минут в неделю."
            value={value.metricAfter}
            error={fieldErrors.metricAfter}
            onChange={(next) => update("metricAfter", next)}
          />
          <TextField
            label="Источник"
            hint="Например: по данным заказчика."
            value={value.metricSource}
            error={fieldErrors.metricSource}
            onChange={(next) => update("metricSource", next)}
          />
        </div>
      </section>

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Контроль человека</h2>
        <TextAreaField
          label="Что остаётся под контролем человека"
          required
          rows={5}
          hint="Опишите, какие решения после автоматизации по-прежнему принимает человек."
          value={value.humanControl}
          error={fieldErrors.humanControl}
          onChange={(next) => update("humanControl", next)}
        />
      </section>

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Ограничение результата</h2>
        <p className={styles.panelNote}>
          Последний раздел документа. Он обязателен: цифры кейса относятся к одному внедрению, и без
          этой оговорки они читаются как общее обещание — в том числе поисковыми и генеративными
          системами, которые цитируют абзац отдельно от страницы.
        </p>
        <TextAreaField
          label="Ограничение результата"
          required
          rows={5}
          hint="Укажите, что результат относится к конкретному внедрению и не гарантирует аналогичный эффект в другой компании."
          value={value.limitations}
          error={fieldErrors.limitations}
          onChange={(next) => update("limitations", next)}
        />
      </section>

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>SEO</h2>
        <p className={styles.panelNote}>
          Адрес страницы в поиске (canonical), robots, микроразметка, Open Graph и карта сайта
          собираются автоматически — заполнять их не нужно.
        </p>

        <TextField
          label="SEO title"
          required
          hint="Заголовок в поисковой выдаче. Может отличаться от заголовка документа и обычно короче."
          recommendedLength={SEO_TITLE_RECOMMENDED_LENGTH}
          value={value.seoTitle}
          error={fieldErrors.seoTitle}
          onChange={(next) => update("seoTitle", next)}
        />
        <TextAreaField
          label="Meta description"
          required
          rows={3}
          hint="Описание страницы в выдаче."
          recommendedLength={META_DESCRIPTION_RECOMMENDED_LENGTH}
          value={value.seoDescription}
          error={fieldErrors.seoDescription}
          onChange={(next) => update("seoDescription", next)}
        />
        <TextAreaField
          label="OG description"
          rows={3}
          hint="Описание карточки в мессенджерах и соцсетях. Если пусто — используется meta description."
          value={value.ogDescription}
          error={fieldErrors.ogDescription}
          onChange={(next) => update("ogDescription", next)}
        />
      </section>

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Настройки</h2>
        <CheckboxField
          label="Показывать печать на документе"
          checked={value.stampEnabled}
          onChange={(checked) => update("stampEnabled", checked)}
        />
      </section>

      <ActionBar
        isNew={isNew}
        isSaving={isSaving}
        isDirty={isDirty}
        message={saveState.status === "error" ? saveState.message : null}
        isSaved={saveState.status === "saved"}
        publicHref={record ? `/cases/${value.slug}` : undefined}
        onSubmit={() => void form.save()}
      />
    </div>
  );
}

/**
 * Панель действия формы. Одна кнопка и один смысл.
 *
 * У создания это «Опубликовать» — конец пути, а не промежуточный шаг: ни «сохранить черновик», ни
 * «предпросмотр», ни «запланировать» здесь не появляются, потому что ни одному из них нечего делать
 * в разделе без черновиков. У правки — «Сохранить изменения»: кейс уже опубликован, и слово
 * «опубликовать» на кнопке означало бы, что до нажатия страницы не было.
 */
function ActionBar({
  isNew,
  isSaving,
  isDirty,
  isSaved,
  message,
  publicHref,
  onSubmit,
}: {
  isNew: boolean;
  isSaving: boolean;
  isDirty: boolean;
  isSaved: boolean;
  message: string | null;
  publicHref?: string;
  onSubmit: () => void;
}) {
  return (
    <div className={styles.panel}>
      {message ? (
        <p className={styles.messageError} role="alert">
          {message}
        </p>
      ) : null}
      {isSaved && !isNew ? (
        <p className={styles.messageSuccess} role="status">
          Изменения сохранены и уже видны на сайте.
        </p>
      ) : null}

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.buttonPrimary}
          onClick={onSubmit}
          // При создании кнопка активна всегда: незаполненные поля покажет проверка на сервере, и
          // это понятнее, чем кнопка, которая не нажимается по неназванной причине. При правке
          // сохранять нечего, пока ничего не изменено.
          disabled={isSaving || (!isNew && !isDirty)}
        >
          {isSaving
            ? isNew
              ? "Публикуем…"
              : "Сохраняем…"
            : isNew
              ? "Опубликовать"
              : "Сохранить изменения"}
        </button>

        {publicHref ? (
          <a
            className={styles.buttonGhost}
            href={publicHref}
            target="_blank"
            rel="noopener noreferrer"
          >
            Открыть на сайте ↗
          </a>
        ) : null}

        {/* Состояние правок показывается только у опубликованного кейса. У формы создания слова
            «всё сохранено» означали бы, что страница уже существует, — а она появится только после
            нажатия «Опубликовать». */}
        {!isNew ? (
          <span className={styles.statusBar}>
            {isDirty ? (
              <span className={styles.statusDirty}>Есть несохранённые изменения</span>
            ) : (
              <span className={styles.statusSaved}>Всё сохранено</span>
            )}
          </span>
        ) : null}
      </div>
    </div>
  );
}
