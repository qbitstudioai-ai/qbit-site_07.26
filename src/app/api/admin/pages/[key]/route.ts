import { NextResponse } from "next/server";
import { handleUnexpected, jsonError, readJsonBody, requireSession } from "@/server/api/guard";
import { revalidateSiteWide } from "@/server/api/revalidate";
import { pageContentSchema } from "@/server/api/schemas";
import { pageContentSchemaFor } from "@/server/content/pageContentSchemas";
import {
  getPageContentRecord,
  isPageKey,
  updatePageContent,
} from "@/server/repositories/pageContent";

/**
 * Общие тексты страниц: заголовки, подписи разделов, примечания.
 *
 * Ключ страницы — из закрытого списка (`PAGE_KEYS`). Произвольный ключ создавал бы записи, которые
 * ни одна страница не читает, и выглядели бы они как «сохранилось, но не появилось».
 */

export const runtime = "nodejs";

const PAGE_TITLES: Record<string, string> = {
  homepage: "Главная страница",
  products: "Продукт и стоимость",
  documents: "Документы",
  blog: "Блог",
  contacts: "Контакты",
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ key: string }> },
): Promise<NextResponse> {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  const { key } = await context.params;
  if (!isPageKey(key)) return jsonError(404, "Неизвестная страница");

  return NextResponse.json({ page: getPageContentRecord(key) ?? null });
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ key: string }> },
): Promise<NextResponse> {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  const { key } = await context.params;
  if (!isPageKey(key)) return jsonError(404, "Неизвестная страница");

  // Сначала оболочка `{ content: … }`, затем СТРОГАЯ схема этой конкретной страницы. Раньше здесь
  // была одна общая `z.record(z.string(), z.unknown())`, принимавшая любой объект: сохранённое
  // `{"headline": {"a": 1}}` роняло публичную страницу (аудит 2026-07-27, SEC-09).
  const body = await readJsonBody(request, pageContentSchema);
  if (!body.ok) return body.response;

  const content = pageContentSchemaFor(key).safeParse(body.data.content);
  if (!content.success) {
    return jsonError(
      422,
      "Проверьте заполнение полей",
      content.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    );
  }

  try {
    updatePageContent(key, content.data, `Тексты «${PAGE_TITLES[key] ?? key}» обновлены`);
    revalidateSiteWide();
    return NextResponse.json({ page: getPageContentRecord(key) ?? null });
  } catch (error) {
    return handleUnexpected(error, `сохранение текстов страницы ${key}`);
  }
}
