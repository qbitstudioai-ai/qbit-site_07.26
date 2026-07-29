import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  ALLOWED_UPLOAD_TYPES,
  FILES_URL_PREFIX,
  isAllowedExtension,
  MAX_UPLOAD_BYTES,
  PREVIEW_EXTENSIONS,
  UPLOADS_DIR,
} from "../config";

/**
 * Объектное хранилище загруженных файлов.
 *
 * Файлы лежат в `var/uploads` — вне `public/` и вне сборки: содержимое меняется во время работы
 * сервера, а `public/` Next.js в production не перечитывает. Раздачей занимается `/api/files/*`,
 * который ставит безопасные заголовки и не отдаёт ничего за пределами этой директории.
 *
 * Имя в хранилище генерируется (UUID + расширение) и НИКОГДА не совпадает с загруженным. Это
 * закрывает сразу три сценария: одинаковые имена, перезаписывающие друг друга; путь вида
 * `../../.env` внутри имени; и попытку подсунуть исполняемое расширение. Исходное имя хранится
 * отдельным полем и используется только при скачивании.
 */

export interface StoredFile {
  storageKey: string;
  url: string;
  size: number;
  mimeType: string;
  extension: string;
  originalFileName: string;
}

export class UploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadError";
  }
}

/** Расширение из имени файла: нижний регистр, без точки, без путей. */
export function extensionOf(fileName: string): string {
  const base = fileName.split(/[\\/]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : "";
}

/** Имя файла без директорий и управляющих символов — то, что показывается и отдаётся при скачивании. */
export function sanitizeFileName(fileName: string): string {
  const base = (fileName.split(/[\\/]/).pop() ?? "file").trim();
  // Управляющие символы и кавычки убираются посимвольно, а не регулярным выражением: литерал с
  // непечатаемым диапазоном легко испортить при правке файла, и ошибка была бы незаметной.
  const safe = [...base]
    .filter((character) => {
      const code = character.codePointAt(0) ?? 0;
      return code >= 0x20 && code !== 0x7f && character !== '"';
    })
    .join("")
    .replace(/\s+/g, " ");

  return safe.slice(0, 200) || "file";
}

/**
 * Ключ хранилища → абсолютный путь. Любая попытка выйти за пределы `UPLOADS_DIR` (`..`, абсолютный
 * путь, символическая ссылка в ключе) отбрасывается: сравнивается уже нормализованный результат.
 */
export function resolveStoragePath(storageKey: string): string | null {
  if (!storageKey || storageKey.includes("\0")) return null;

  const target = path.resolve(UPLOADS_DIR, storageKey);
  const root = path.resolve(UPLOADS_DIR);
  if (target !== root && !target.startsWith(root + path.sep)) return null;

  return target;
}

interface SaveOptions {
  /** Поддиректория хранилища: `documents` — оригиналы, `previews` — изображения предпросмотра. */
  folder: "documents" | "previews";
  /** Ограничение набора расширений. По умолчанию — общий белый список. */
  allowedExtensions?: readonly string[];
}

/**
 * Сохраняет файл из формы. Проверяет размер, расширение и заявленный MIME-тип ДО записи на диск,
 * поэтому запрещённый файл в хранилище не попадает даже временно.
 */
export async function saveUploadedFile(file: File, options: SaveOptions): Promise<StoredFile> {
  if (!(file instanceof File) || file.size === 0) {
    throw new UploadError("Файл не выбран или пуст");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new UploadError(
      `Файл больше допустимых ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))} МБ`,
    );
  }

  const originalFileName = sanitizeFileName(file.name);
  const extension = extensionOf(originalFileName);

  if (!extension || !isAllowedExtension(extension)) {
    throw new UploadError(`Формат «${extension || "без расширения"}» загружать нельзя`);
  }
  if (options.allowedExtensions && !options.allowedExtensions.includes(extension)) {
    throw new UploadError(
      `Для этого поля допустимы форматы: ${options.allowedExtensions.join(", ").toUpperCase()}`,
    );
  }

  // MIME из формы — ЗАЯВЛЕНИЕ браузера, а не факт: подделать его тривиально, а честно определить он
  // умеет далеко не всё (для .docx и .xlsx системы без нужной записи в реестре присылают
  // `application/octet-stream`). Поэтому решающим остаётся расширение из белого списка: оно
  // определяет и путь в хранилище, и Content-Type при выдаче. Заявленный тип служит лишь
  // дополнительной проверкой — «не знаю» пропускается, явное несовпадение отклоняется.
  const allowedMimeTypes = ALLOWED_UPLOAD_TYPES[extension];
  const declaredMime = (file.type || "").toLowerCase().split(";")[0].trim();
  const isUnknownMime = declaredMime === "" || declaredMime === "application/octet-stream";
  if (!isUnknownMime && !allowedMimeTypes.includes(declaredMime)) {
    throw new UploadError(`Тип файла «${declaredMime}» не соответствует расширению .${extension}`);
  }

  const storageKey = `${options.folder}/${randomUUID()}.${extension}`;
  const target = resolveStoragePath(storageKey);
  if (!target) throw new UploadError("Некорректный путь в хранилище");

  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, Buffer.from(await file.arrayBuffer()));

  return {
    storageKey,
    url: `${FILES_URL_PREFIX}/${storageKey}`,
    size: file.size,
    mimeType: allowedMimeTypes[0],
    extension,
    originalFileName,
  };
}

export const PREVIEW_UPLOAD_EXTENSIONS = PREVIEW_EXTENSIONS;

/**
 * Удаляет файл хранилища. Отсутствие файла ошибкой не считается (запись могли удалить раньше), а
 * вот отказ файловой системы пробрасывается наверх: молча потерянный файл — это утечка данных.
 */
export async function deleteStoredFile(storageKey: string | null | undefined): Promise<void> {
  if (!storageKey) return;

  const target = resolveStoragePath(storageKey);
  if (!target) return;

  try {
    await fs.unlink(target);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
}

/** Ключ хранилища из публичной ссылки `/api/files/...`. Внешние ссылки возвращают `null`. */
export function storageKeyFromUrl(url: string | null | undefined): string | null {
  if (!url || !url.startsWith(`${FILES_URL_PREFIX}/`)) return null;
  return url.slice(FILES_URL_PREFIX.length + 1);
}

export async function readStoredFile(
  storageKey: string,
): Promise<{ data: Buffer; size: number } | null> {
  const target = resolveStoragePath(storageKey);
  if (!target) return null;

  try {
    const data = await fs.readFile(target);
    return { data, size: data.byteLength };
  } catch {
    return null;
  }
}
