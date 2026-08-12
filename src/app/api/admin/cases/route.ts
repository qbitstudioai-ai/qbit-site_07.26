import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { CASE_DEFAULTS } from "@/features/cases/caseRecord";
import { handleUnexpected, jsonError, readJsonBody, requireSession } from "@/server/api/guard";
import { revalidateCases } from "@/server/api/revalidate";
import { caseSchema } from "@/server/api/schemas";
import { nowIso } from "@/server/db/client";
import {
  createCase,
  isCaseFileNumberTaken,
  isCaseSlugTaken,
  listAllCases,
  nextCaseSortOrder,
} from "@/server/repositories/cases";

/** Список кейсов и публикация нового кейса. */

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  return NextResponse.json({ cases: listAllCases(), nextSortOrder: nextCaseSortOrder() });
}

/**
 * Публикация кейса — ровно одно действие формы.
 *
 * Черновиков у раздела нет: нажатие «Опубликовать» создаёт запись, которая в тот же момент
 * становится страницей сайта. Поэтому здесь нет ни выбора статуса, ни отложенной даты — сервер
 * ставит `publishedAt` фактическим временем публикации и то же значение в `modifiedAt`, чтобы у
 * нового кейса «опубликован» и «изменён» совпадали.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  const body = await readJsonBody(request, caseSchema);
  if (!body.ok) return body.response;

  // Ошибки уникальности возвращаются с путём поля: форма покажет их рядом с полем, а не общей
  // строкой наверху, и владелец сайта не будет искать, что именно занято.
  if (isCaseSlugTaken(body.data.slug)) {
    return jsonError(409, `Адрес «${body.data.slug}» уже занят другим кейсом`, [
      { path: "slug", message: "Этот адрес уже занят другим кейсом" },
    ]);
  }
  if (isCaseFileNumberTaken(body.data.fileNumber)) {
    return jsonError(409, `Дело № ${body.data.fileNumber} уже существует`, [
      { path: "fileNumber", message: "Такой номер дела уже занят" },
    ]);
  }

  try {
    const publishedAt = nowIso();
    const caseStudy = createCase(
      randomUUID(),
      { ...body.data, ...CASE_DEFAULTS, status: "published" },
      publishedAt,
    );

    // Кэш сбрасывается ДО ответа: к моменту, когда админ-панель покажет ссылку «Открыть на сайте»,
    // страница уже обязана существовать.
    revalidateCases();
    return NextResponse.json({ caseStudy }, { status: 201 });
  } catch (error) {
    return handleUnexpected(error, "публикация кейса");
  }
}
