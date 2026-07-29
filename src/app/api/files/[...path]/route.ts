import fs from "node:fs/promises";
import { NextResponse } from "next/server";
import { getActiveSessionId } from "@/server/auth/session";
import { ALLOWED_UPLOAD_TYPES } from "@/server/config";
import { findDocumentByStorageKey } from "@/server/repositories/documents";
import { extensionOf, resolveStoragePath } from "@/server/storage/files";

/**
 * Раздача файлов объектного хранилища.
 *
 * Хранилище лежит вне `public/`, поэтому статикой Next.js эти файлы не отдаются — и хорошо: здесь
 * можно проверить право на файл и поставить заголовки, которые защищают посетителя.
 *
 * Что делает роут:
 *   — не выпускает запрос за пределы `var/uploads` (`resolveStoragePath` отбрасывает `..`);
 *   — СВЕРЯЕТ файл с каталогом документов и отдаёт неопубликованное только администратору;
 *   — отдаёт Content-Type строго из белого списка, а не из имени файла;
 *   — ставит `X-Content-Type-Options: nosniff`, чтобы браузер не «додумал» тип;
 *   — ставит `Content-Security-Policy: sandbox`, лишая ответ прав на исполнение;
 *   — по `?download=1` отдаёт вложением, а не открывает в браузере.
 *
 * Про проверку публикации (аудит 2026-07-27, SEC-07). Раньше роут отдавал байты, не заглядывая в
 * базу: считалось, что имя файла (UUIDv4) угадать нельзя. Но ссылка на опубликованный документ
 * попадает в поисковый кэш, историю браузера и Referer-логи, поэтому после снятия с публикации
 * файл продолжал выдаваться всем, у кого ссылка уже есть. Непредсказуемость имени — не разрешение
 * на доступ; разрешение даёт запись в каталоге.
 *
 * Форма публичной ссылки НЕ изменена (`/api/files/<ключ хранилища>`): все уже сохранённые в базе
 * `original_file_url` и `preview_url` продолжают работать. Изменилось значение пути — теперь это
 * ключ для поиска записи, а не самостоятельный пропуск.
 */

export const runtime = "nodejs";

// Ответ на «нет файла», «нет такой записи» и «нет прав» ОДИН И ТОТ ЖЕ. Разные ответы позволяли бы
// по коду отличить существующий неопубликованный документ от несуществующего и перебирать каталог.
const NOT_FOUND = () =>
  new NextResponse("Файл не найден", {
    status: 404,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });

export async function GET(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
  const { path: segments } = await context.params;
  const storageKey = segments.join("/");

  const target = resolveStoragePath(storageKey);
  if (!target) return NOT_FOUND();

  const extension = extensionOf(storageKey);
  // SVG нет в белом списке загрузки, но он есть среди СГЕНЕРИРОВАННЫХ нами предпросмотров текста —
  // тип разрешён отдельно и вместе с sandbox-политикой ниже исполняемым содержимым не становится.
  const mimeType = extension === "svg" ? "image/svg+xml" : ALLOWED_UPLOAD_TYPES[extension]?.[0];
  if (!mimeType) return NOT_FOUND();

  // Файл обязан принадлежать записи каталога. Файл-сирота (запись удалена, файл почему-то остался)
  // наружу не отдаётся: он уже не является частью сайта.
  const document = findDocumentByStorageKey(storageKey);
  if (!document) return NOT_FOUND();

  // Сессия спрашивается только для неопубликованного — на публичных файлах лишней работы нет.
  const isPublic = document.isPublished || (await getActiveSessionId()) !== null;
  if (!isPublic) return NOT_FOUND();

  let data: Buffer;
  try {
    data = await fs.readFile(target);
  } catch {
    return NOT_FOUND();
  }

  const url = new URL(request.url);
  const isDownload = url.searchParams.get("download") === "1";
  const requestedName = url.searchParams.get("name");
  const fileName = requestedName
    ? requestedName.replace(/["\\\r\n]/g, "")
    : storageKey.split("/").pop();

  const headers = new Headers({
    "Content-Type": mimeType,
    "Content-Length": String(data.byteLength),
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "sandbox; default-src 'none'",
    // Неопубликованное не должно оседать ни в браузере, ни в промежуточном прокси: иначе повторная
    // публикация/снятие переставали бы что-либо значить для уже раздавшего кэша.
    "Cache-Control": document.isPublished
      ? "public, max-age=0, must-revalidate"
      : "private, no-store",
    "Content-Disposition": `${isDownload ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(fileName ?? "file")}`,
  });

  return new NextResponse(new Uint8Array(data), { headers });
}
