"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import { formatFileSize, formatUpdatedAt } from "@/features/documents/documents";
import styles from "./admin.module.css";
import { ConfirmDialog, SelectField, TextAreaField, TextField, CheckboxField } from "./formKit";
import { readApiError } from "./useEditableForm";

/**
 * Раздел «Документы».
 *
 * Загрузка файла — это не «форма с текстом»: файл уходит на сервер как `multipart/form-data`, там
 * проверяется тип, размер и расширение, кладётся в объектное хранилище под сгенерированным именем и
 * только потом появляется запись в базе. Поэтому здесь обычная HTML-форма с `FormData`, а не
 * JSON-запрос.
 *
 * Предпросмотр:
 *   изображения  — сам файл;
 *   TXT/CSV      — лист с первыми строками, создаётся сервером;
 *   PDF и офисные форматы — автоматически НЕ создаётся (серверной растеризации PDF в проекте нет).
 *     Для них администратор загружает изображение вручную, а без него на сайте показывается
 *     аккуратная заглушка формата.
 */

export interface DocumentRecordView {
  id: string;
  title: string;
  description: string;
  category: string;
  fileType: string;
  mimeType: string;
  fileSize: number;
  originalFileName: string;
  originalFileUrl: string;
  previewUrl: string | null;
  autoPreviewKey: string | null;
  manualPreviewKey: string | null;
  sortOrder: number;
  isPublished: boolean;
  documentDate: string | null;
  updatedAt: string;
}

export interface CategoryView {
  id: string;
  label: string;
  sortOrder: number;
}

type StatusFilter = "all" | "published" | "hidden";

export function DocumentsAdmin({
  documents,
  categories,
}: {
  documents: DocumentRecordView[];
  categories: CategoryView[];
}) {
  const [records, setRecords] = useState(documents);
  const [editing, setEditing] = useState<DocumentRecordView | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<DocumentRecordView | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [formatFilter, setFormatFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const formats = useMemo(
    () => [...new Set(records.map((item) => item.fileType))].sort(),
    [records],
  );

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return records.filter((item) => {
      if (query && !item.title.toLowerCase().includes(query)) return false;
      if (categoryFilter !== "all" && item.category !== categoryFilter) return false;
      if (formatFilter !== "all" && item.fileType !== formatFilter) return false;
      if (statusFilter === "published" && !item.isPublished) return false;
      if (statusFilter === "hidden" && item.isPublished) return false;
      return true;
    });
  }, [records, search, categoryFilter, formatFilter, statusFilter]);

  const categoryLabel = (id: string) =>
    categories.find((category) => category.id === id)?.label ?? id;

  const reorder = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= records.length) return;

    const next = [...records];
    [next[index], next[target]] = [next[target], next[index]];
    setRecords(next);

    const response = await fetch("/api/admin/documents?action=reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: next.map((item) => item.id) }),
    });

    if (!response.ok) {
      setRecords(records);
      setMessage({ kind: "error", text: "Не удалось сохранить порядок документов" });
      return;
    }

    const payload = (await response.json()) as { documents: DocumentRecordView[] };
    setRecords(payload.documents);
  };

  const togglePublished = async (document: DocumentRecordView) => {
    const body = new FormData();
    body.set("title", document.title);
    body.set("description", document.description);
    body.set("category", document.category);
    body.set("documentDate", document.documentDate ?? "");
    body.set("sortOrder", String(document.sortOrder));
    body.set("isPublished", String(!document.isPublished));

    const response = await fetch(`/api/admin/documents/${document.id}`, { method: "PUT", body });
    if (!response.ok) {
      const failure = await readApiError(response);
      setMessage({ kind: "error", text: failure.message });
      return;
    }

    const payload = (await response.json()) as { document: DocumentRecordView };
    setRecords((current) =>
      current.map((item) => (item.id === payload.document.id ? payload.document : item)),
    );
    setMessage({
      kind: "success",
      text: payload.document.isPublished ? "Документ опубликован" : "Документ снят с публикации",
    });
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;

    setIsDeleting(true);
    const response = await fetch(`/api/admin/documents/${pendingDelete.id}`, { method: "DELETE" });
    setIsDeleting(false);

    if (!response.ok) {
      const failure = await readApiError(response);
      setMessage({ kind: "error", text: failure.message });
      setPendingDelete(null);
      return;
    }

    const payload = (await response.json().catch(() => ({}))) as { warning?: string };
    setRecords((current) => current.filter((item) => item.id !== pendingDelete.id));
    setPendingDelete(null);
    // Частичная ошибка удаления не скрывается: запись убрана, но файл остался — об этом нужно знать.
    setMessage(
      payload.warning
        ? { kind: "error", text: payload.warning }
        : { kind: "success", text: "Документ удалён" },
    );
  };

  return (
    <>
      <div className={styles.actions} style={{ marginBottom: 16 }}>
        <button
          type="button"
          className={styles.buttonPrimary}
          onClick={() => {
            setIsAdding((current) => !current);
            setEditing(null);
          }}
        >
          {isAdding ? "Отменить добавление" : "Добавить документ"}
        </button>
      </div>

      {message ? (
        <p
          className={message.kind === "error" ? styles.messageError : styles.messageSuccess}
          role={message.kind === "error" ? "alert" : "status"}
        >
          {message.text}
        </p>
      ) : null}

      {isAdding ? (
        <DocumentForm
          categories={categories}
          onCancel={() => setIsAdding(false)}
          onSaved={(document) => {
            setRecords((current) => [...current, document]);
            setIsAdding(false);
            setMessage({ kind: "success", text: "Документ загружен" });
          }}
        />
      ) : null}

      {editing ? (
        <DocumentForm
          key={editing.id}
          document={editing}
          categories={categories}
          onCancel={() => setEditing(null)}
          onSaved={(document) => {
            setRecords((current) =>
              current.map((item) => (item.id === document.id ? document : item)),
            );
            setEditing(null);
            setMessage({ kind: "success", text: "Изменения сохранены" });
          }}
        />
      ) : null}

      <div className={styles.filters}>
        <TextField label="Поиск по названию" value={search} onChange={setSearch} />
        <SelectField
          label="Категория"
          value={categoryFilter}
          onChange={setCategoryFilter}
          options={[
            { value: "all", label: "Все категории" },
            ...categories.map((category) => ({ value: category.id, label: category.label })),
          ]}
        />
        <SelectField
          label="Формат"
          value={formatFilter}
          onChange={setFormatFilter}
          options={[
            { value: "all", label: "Все форматы" },
            ...formats.map((format) => ({ value: format, label: format.toUpperCase() })),
          ]}
        />
        <SelectField
          label="Статус"
          value={statusFilter}
          onChange={(next) => setStatusFilter(next as StatusFilter)}
          options={[
            { value: "all", label: "Все" },
            { value: "published", label: "Опубликованные" },
            { value: "hidden", label: "Снятые с публикации" },
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
                <th scope="col">Категория</th>
                <th scope="col">Формат</th>
                <th scope="col">Размер</th>
                <th scope="col">Статус</th>
                <th scope="col">Дата</th>
                <th scope="col">Порядок</th>
                <th scope="col">Действия</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((item) => {
                const index = records.findIndex((record) => record.id === item.id);
                return (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.title}</strong>
                      <span className={styles.recordMeta}>{item.originalFileName}</span>
                    </td>
                    <td>{categoryLabel(item.category)}</td>
                    <td className={styles.cellNowrap}>{item.fileType.toUpperCase()}</td>
                    <td className={styles.cellNowrap}>{formatFileSize(item.fileSize)}</td>
                    <td>
                      <span
                        className={`${styles.badge} ${
                          item.isPublished ? styles.badgePublished : styles.badgeDraft
                        }`}
                      >
                        {item.isPublished ? "Опубликован" : "Скрыт"}
                      </span>
                    </td>
                    <td className={styles.cellNowrap}>
                      {item.documentDate
                        ? formatUpdatedAt(item.documentDate)
                        : formatUpdatedAt(item.updatedAt.slice(0, 10))}
                    </td>
                    <td>
                      <div className={styles.tableActions}>
                        <button
                          type="button"
                          className={`${styles.button} ${styles.buttonSmall}`}
                          onClick={() => void reorder(index, -1)}
                          disabled={index <= 0}
                          aria-label={`Переместить «${item.title}» выше`}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className={`${styles.button} ${styles.buttonSmall}`}
                          onClick={() => void reorder(index, 1)}
                          disabled={index === records.length - 1}
                          aria-label={`Переместить «${item.title}» ниже`}
                        >
                          ↓
                        </button>
                      </div>
                    </td>
                    <td>
                      <div className={styles.tableActions}>
                        <button
                          type="button"
                          className={`${styles.button} ${styles.buttonSmall}`}
                          onClick={() => {
                            setEditing(item);
                            setIsAdding(false);
                          }}
                        >
                          Редактировать
                        </button>
                        <a
                          className={`${styles.buttonGhost} ${styles.buttonSmall}`}
                          href={`${item.originalFileUrl}?download=1&name=${encodeURIComponent(item.originalFileName)}`}
                        >
                          Скачать
                        </a>
                        <button
                          type="button"
                          className={`${styles.button} ${styles.buttonSmall}`}
                          onClick={() => void togglePublished(item)}
                        >
                          {item.isPublished ? "Снять с публикации" : "Опубликовать"}
                        </button>
                        <button
                          type="button"
                          className={`${styles.buttonDanger} ${styles.buttonSmall}`}
                          onClick={() => setPendingDelete(item)}
                        >
                          Удалить
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {pendingDelete ? (
        <ConfirmDialog
          title="Удалить документ?"
          text={`Будут удалены запись «${pendingDelete.title}», исходный файл и созданные изображения предпросмотра. Действие необратимо.`}
          isBusy={isDeleting}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setPendingDelete(null)}
        />
      ) : null}
    </>
  );
}

const AUTO_PREVIEW_FORMATS = ["jpg", "jpeg", "png", "webp", "txt", "csv"];

function DocumentForm({
  document,
  categories,
  onCancel,
  onSaved,
}: {
  document?: DocumentRecordView;
  categories: CategoryView[];
  onCancel: () => void;
  onSaved: (document: DocumentRecordView) => void;
}) {
  const isEditing = Boolean(document);
  const formRef = useRef<HTMLFormElement>(null);

  const [title, setTitle] = useState(document?.title ?? "");
  const [description, setDescription] = useState(document?.description ?? "");
  const [category, setCategory] = useState(document?.category ?? categories[0]?.id ?? "other");
  const [documentDate, setDocumentDate] = useState(document?.documentDate ?? "");
  const [sortOrder, setSortOrder] = useState(document?.sortOrder ?? 0);
  const [isPublished, setIsPublished] = useState(document?.isPublished ?? true);
  const [removeManualPreview, setRemoveManualPreview] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSending) return;

    const form = formRef.current;
    if (!form) return;

    const body = new FormData(form);
    body.set("title", title);
    body.set("description", description);
    body.set("category", category);
    body.set("documentDate", documentDate);
    body.set("sortOrder", String(sortOrder));
    body.set("isPublished", String(isPublished));
    body.set("removeManualPreview", String(removeManualPreview));

    setIsSending(true);
    setError(null);

    try {
      const response = await fetch(
        isEditing ? `/api/admin/documents/${document?.id}` : "/api/admin/documents",
        { method: isEditing ? "PUT" : "POST", body },
      );

      if (!response.ok) {
        const failure = await readApiError(response);
        setError(failure.message);
        return;
      }

      const payload = (await response.json()) as { document: DocumentRecordView };
      onSaved(payload.document);
    } catch {
      setError("Не удалось связаться с сервером. Проверьте соединение и попробуйте ещё раз.");
    } finally {
      setIsSending(false);
    }
  };

  const canAutoPreview = document ? AUTO_PREVIEW_FORMATS.includes(document.fileType) : true;

  return (
    <form ref={formRef} className={styles.panel} onSubmit={handleSubmit} noValidate>
      <h2 className={styles.panelTitle}>
        {isEditing ? `Документ «${document?.title}»` : "Новый документ"}
      </h2>

      {error ? (
        <p className={styles.messageError} role="alert">
          {error}
        </p>
      ) : null}

      <TextField label="Название" required value={title} onChange={setTitle} />
      <TextAreaField
        label="Краткое описание"
        rows={2}
        value={description}
        onChange={setDescription}
      />

      <div className={styles.fieldRow}>
        <SelectField
          label="Категория"
          required
          value={category}
          onChange={setCategory}
          options={categories.map((item) => ({ value: item.id, label: item.label }))}
        />
        <TextField
          label="Дата документа"
          type="date"
          value={documentDate}
          onChange={setDocumentDate}
        />
        <TextField
          label="Порядок отображения"
          type="number"
          hint="Меньшее число — выше в списке."
          value={String(sortOrder)}
          onChange={(next) => setSortOrder(Number(next) || 0)}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="document-file">
          {isEditing ? "Заменить файл" : "Файл документа"}
          {isEditing ? null : (
            <span className={styles.requiredMark} aria-hidden="true">
              *
            </span>
          )}
        </label>
        <input
          id="document-file"
          className={styles.input}
          type="file"
          name="file"
          required={!isEditing}
          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.rtf,.zip,.jpg,.jpeg,.png,.webp"
        />
        <span className={styles.hint}>
          Допустимо: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT, CSV, RTF, ZIP, JPG, PNG, WebP.
          Максимальный размер — 25 МБ. Исполняемые файлы и SVG загружать нельзя.
          {isEditing ? " Оставьте поле пустым, чтобы сохранить текущий файл." : ""}
        </span>
      </div>

      {isEditing && document ? (
        <div className={styles.previewBox}>
          {document.previewUrl ? (
            // Обычный <img>: ссылка на предпросмотр приходит из базы, размеры заранее неизвестны.
            // eslint-disable-next-line @next/next/no-img-element
            <img className={styles.previewImage} src={document.previewUrl} alt="" />
          ) : (
            <div className={styles.previewMissing}>
              Предпросмотр не создан. Для {document.fileType.toUpperCase()} загрузите изображение
              вручную — иначе на сайте показывается заглушка формата.
            </div>
          )}
          <div>
            <p className={styles.hint}>
              Файл: {document.originalFileName} · {formatFileSize(document.fileSize)} ·{" "}
              {document.fileType.toUpperCase()}
            </p>
            <p className={styles.hint}>
              {document.manualPreviewKey
                ? "Показывается предпросмотр, загруженный вручную."
                : document.autoPreviewKey || canAutoPreview
                  ? "Показывается предпросмотр, созданный автоматически."
                  : "Автоматический предпросмотр для этого формата не создаётся."}
            </p>
            {document.manualPreviewKey ? (
              <CheckboxField
                label="Удалить ручной предпросмотр (вернётся автоматический, если он есть)"
                checked={removeManualPreview}
                onChange={setRemoveManualPreview}
              />
            ) : null}
          </div>
        </div>
      ) : null}

      <div className={styles.field}>
        <label className={styles.label} htmlFor="document-preview">
          Изображение предпросмотра (необязательно)
        </label>
        <input
          id="document-preview"
          className={styles.input}
          type="file"
          name="previewFile"
          accept=".jpg,.jpeg,.png,.webp"
        />
        <span className={styles.hint}>
          JPG, PNG или WebP. Нужен для PDF и офисных форматов: изображение первой страницы для них
          не создаётся автоматически. Ручной предпросмотр перекрывает автоматический, но не удаляет
          его.
        </span>
      </div>

      <CheckboxField
        label="Опубликовать на сайте"
        checked={isPublished}
        onChange={setIsPublished}
      />

      <div className={styles.actions}>
        <button type="submit" className={styles.buttonPrimary} disabled={isSending}>
          {isSending ? "Сохраняем…" : isEditing ? "Сохранить" : "Загрузить документ"}
        </button>
        <button type="button" className={styles.button} onClick={onCancel} disabled={isSending}>
          Отменить
        </button>
      </div>
    </form>
  );
}
