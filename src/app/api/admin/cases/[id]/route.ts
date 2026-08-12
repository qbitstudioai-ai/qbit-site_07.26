import { NextResponse } from "next/server";
import { CASE_DEFAULTS } from "@/features/cases/caseRecord";
import { handleUnexpected, jsonError, readJsonBody, requireSession } from "@/server/api/guard";
import { revalidateCases } from "@/server/api/revalidate";
import { caseSchema } from "@/server/api/schemas";
import { nowIso } from "@/server/db/client";
import {
  deleteCase,
  getCaseById,
  isCaseFileNumberTaken,
  updateCase,
} from "@/server/repositories/cases";

/** Чтение, сохранение и удаление одного кейса. */

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  const { id } = await context.params;
  const caseStudy = getCaseById(id);
  if (!caseStudy) return jsonError(404, "Кейс не найден");

  return NextResponse.json({ caseStudy });
}

/**
 * Правка опубликованного кейса.
 *
 * АДРЕС НЕ МЕНЯЕТСЯ. `slug` берётся из существующей записи, а присланный клиентом — игнорируется
 * молча и полностью. Это не перестраховка: смена адреса опубликованной страницы обрывает внешние
 * ссылки, обнуляет её историю в поиске и оставляет прежний адрес отвечать 404 без перенаправления.
 * Отдельной операции переезда в проекте нет, поэтому и случайно выполнить её нельзя — ни из формы,
 * ни прямым запросом к API.
 *
 * `publishedAt` остаётся прежним, `modifiedAt` получает время правки.
 */
export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  const { id } = await context.params;
  const existing = getCaseById(id);
  if (!existing) return jsonError(404, "Кейс не найден");

  const body = await readJsonBody(request, caseSchema);
  if (!body.ok) return body.response;

  if (isCaseFileNumberTaken(body.data.fileNumber, id)) {
    return jsonError(409, `Дело № ${body.data.fileNumber} уже существует`, [
      { path: "fileNumber", message: "Такой номер дела уже занят" },
    ]);
  }

  try {
    const caseStudy = updateCase(
      id,
      {
        ...body.data,
        slug: existing.slug,
        ...CASE_DEFAULTS,
        status: "published",
      },
      nowIso(),
    );

    revalidateCases();
    return NextResponse.json({ caseStudy });
  } catch (error) {
    return handleUnexpected(error, `сохранение кейса ${id}`);
  }
}

/**
 * Удаление кейса.
 *
 * Сознательное действие администратора и ничего сверх него: страница исчезает с сайта, из
 * картотеки и из карты сайта, её адрес начинает отвечать 404. Никакого автоматического
 * перенаправления на другой кейс здесь нет и появляться не должно — придуманный редирект скрыл бы
 * от поисковой системы факт удаления материала.
 *
 * Предыдущая версия текста сохраняется в истории изменений базы (см. репозиторий).
 */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  const { id } = await context.params;
  const existing = getCaseById(id);
  if (!existing) return jsonError(404, "Кейс не найден");

  try {
    deleteCase(id);
    revalidateCases();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleUnexpected(error, `удаление кейса ${id}`);
  }
}
