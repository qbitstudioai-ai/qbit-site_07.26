import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { FILES_URL_PREFIX, isImageExtension, isTextExtension } from "../config";
import { readStoredFile, resolveStoragePath } from "./files";

/**
 * Автоматический предпросмотр документа.
 *
 * Что реально возможно в текущей среде без внешних зависимостей:
 *
 *   JPG/JPEG/PNG/WebP — сам файл и есть изображение предпросмотра, отдельная копия не нужна;
 *   TXT/CSV           — первые строки текста отрисовываются в SVG-лист;
 *   PDF и офисные     — автоматически НЕ создаётся.
 *
 * Для PDF нужна серверная растеризация первой страницы (pdfium/poppler/ghostscript); ни одного
 * такого модуля в проекте нет, а `sharp` PDF не читает. Придумывать «предпросмотр», который на
 * самом деле показывает заглушку, было бы обманом — поэтому здесь честный резервный сценарий:
 * администратор загружает изображение предпросмотра вручную, а без него раздел показывает
 * аккуратную заглушку формата (`DocumentTypeFallback`). Место под серверную генерацию оставлено:
 * появится модуль — добавится ветка, схема (`auto_preview_key`) уже это учитывает.
 */

export interface GeneratedPreview {
  /** Ключ созданного файла предпросмотра или `null`, если предпросмотр — сам оригинал. */
  storageKey: string | null;
  url: string;
}

/** Экранирование текста для вставки в SVG: чужой текст не должен становиться разметкой. */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function textPreviewSvg(title: string, lines: string[]): string {
  const rows = lines
    .map(
      (line, index) =>
        `<text x="56" y="${150 + index * 34}" class="line">${escapeXml(line)}</text>`,
    )
    .join("\n    ");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 794 944" width="794" height="944" role="img" aria-label="${escapeXml(title)}">
  <rect width="794" height="944" fill="#ffffff"/>
  <rect x="0" y="0" width="794" height="8" fill="#1f4b8f"/>
  <style>
    .title { font: 600 30px "Segoe UI", Arial, sans-serif; fill: #16233a; }
    .line  { font: 400 20px "Consolas", "Courier New", monospace; fill: #3c4a60; }
  </style>
  <text x="56" y="96" class="title">${escapeXml(title)}</text>
  ${rows}
</svg>`;
}

/**
 * Создаёт предпросмотр для только что загруженного файла.
 *
 * @param storageKey ключ оригинала в хранилище
 * @param extension  расширение оригинала
 * @param title      название документа — подпись на текстовом предпросмотре
 */
export async function generatePreview(
  storageKey: string,
  extension: string,
  title: string,
): Promise<GeneratedPreview | null> {
  if (isImageExtension(extension)) {
    // Изображение само себе предпросмотр: вторая копия заняла бы место и разошлась бы с оригиналом
    // при замене файла.
    return { storageKey: null, url: `${FILES_URL_PREFIX}/${storageKey}` };
  }

  if (isTextExtension(extension)) {
    const stored = await readStoredFile(storageKey);
    if (!stored) return null;

    const lines = stored.data
      .toString("utf8")
      .replace(/\r\n/g, "\n")
      .split("\n")
      .slice(0, 20)
      .map((line) => (line.length > 64 ? `${line.slice(0, 63)}…` : line));

    const previewKey = `previews/${randomUUID()}.svg`;
    const target = resolveStoragePath(previewKey);
    if (!target) return null;

    await fs.mkdir(path.dirname(target), { recursive: true });
    // SVG собирается нами и весь внешний текст экранирован; наружу он отдаётся как изображение с
    // `nosniff` и Content-Security-Policy `sandbox` (см. роут `/api/files`), поэтому исполняемым
    // содержимым стать не может. Загружать SVG извне по-прежнему запрещено.
    await fs.writeFile(target, textPreviewSvg(title, lines), "utf8");

    return { storageKey: previewKey, url: `${FILES_URL_PREFIX}/${previewKey}` };
  }

  return null;
}
