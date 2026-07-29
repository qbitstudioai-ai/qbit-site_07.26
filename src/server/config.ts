import path from "node:path";

/**
 * Серверная конфигурация админ-панели: пути постоянного хранилища и ограничения загрузки.
 *
 * Ни одно значение отсюда не попадает в клиентский бандл: модуль импортируется только серверным
 * кодом (`src/server/**`, route handlers, серверные компоненты). Секреты (`ADMIN_LOGIN`,
 * `ADMIN_PASSWORD_HASH`, `SESSION_SECRET`) сознательно НЕ читаются на уровне модуля — они читаются
 * точечно в `src/server/auth`, чтобы отсутствующая переменная роняла авторизацию, а не весь сайт.
 */

/** Корень проекта. `process.cwd()` в Next.js — директория, из которой запущен сервер. */
const projectRoot = process.cwd();

/**
 * Директория постоянных данных. Держится ВНЕ `src/` и `public/`: содержимое меняется во время
 * работы сервера и не должно попадать ни в сборку, ни в git. На production монтируется как том.
 */
export const DATA_DIR = process.env.QBIT_DATA_DIR
  ? path.resolve(process.env.QBIT_DATA_DIR)
  : path.join(projectRoot, "var");

/** Файл базы данных SQLite. */
export const DB_PATH = process.env.QBIT_DB_PATH
  ? path.resolve(process.env.QBIT_DB_PATH)
  : path.join(DATA_DIR, "content.db");

/**
 * Объектное хранилище загруженных файлов. Файлы НЕ кладутся в `public/`: тогда их пришлось бы
 * коммитить, а Next.js всё равно не перечитывает `public/` без перезапуска в production.
 * Раздачей занимается роут `/api/files/[...path]` — он проверяет путь и ставит безопасные заголовки.
 */
export const UPLOADS_DIR = process.env.QBIT_UPLOADS_DIR
  ? path.resolve(process.env.QBIT_UPLOADS_DIR)
  : path.join(DATA_DIR, "uploads");

/** Публичный префикс ссылок на файлы хранилища. */
export const FILES_URL_PREFIX = "/api/files";

/** Максимальный размер загружаемого файла — 25 МБ. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/** Максимальный размер JSON-тела административного запроса — 1 МБ. */
export const MAX_JSON_BYTES = 1024 * 1024;

/**
 * Белый список загружаемых форматов: расширение → допустимые MIME-типы.
 *
 * Whitelist, а не blacklist: неизвестный формат запрещён по умолчанию. SVG и HTML отсутствуют
 * намеренно — оба исполняются браузером как код, а безопасной санитизации SVG в проекте нет.
 * Исполняемые расширения (.exe, .bat, .sh, .js, .php…) в список не входят и попасть не могут.
 */
export const ALLOWED_UPLOAD_TYPES: Record<string, readonly string[]> = {
  pdf: ["application/pdf"],
  doc: ["application/msword"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  xls: ["application/vnd.ms-excel"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  ppt: ["application/vnd.ms-powerpoint"],
  pptx: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  txt: ["text/plain"],
  csv: ["text/csv", "application/csv", "text/plain"],
  rtf: ["application/rtf", "text/rtf"],
  zip: ["application/zip", "application/x-zip-compressed"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  png: ["image/png"],
  webp: ["image/webp"],
};

/** Форматы, которые сами себе предпросмотр. */
export const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp"] as const;

/** Форматы, для которых предпросмотр можно собрать из текста файла. */
export const TEXT_EXTENSIONS = ["txt", "csv"] as const;

/** Расширения, допустимые для РУЧНОГО изображения предпросмотра. */
export const PREVIEW_EXTENSIONS = ["jpg", "jpeg", "png", "webp"] as const;

export function isAllowedExtension(extension: string): boolean {
  return Object.hasOwn(ALLOWED_UPLOAD_TYPES, extension);
}

export function isImageExtension(extension: string): boolean {
  return (IMAGE_EXTENSIONS as readonly string[]).includes(extension);
}

export function isTextExtension(extension: string): boolean {
  return (TEXT_EXTENSIONS as readonly string[]).includes(extension);
}

// Константы сессии живут в `src/server/auth/constants.ts` — их читает Edge-middleware, куда этот
// модуль импортировать нельзя (здесь есть `node:path`).
export { LOGIN_RATE_LIMIT, SESSION_COOKIE_NAME, SESSION_TTL_MS } from "./auth/constants";
