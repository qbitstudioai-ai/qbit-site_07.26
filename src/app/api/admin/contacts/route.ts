import { NextResponse } from "next/server";
import { handleUnexpected, jsonError, readJsonBody, requireSession } from "@/server/api/guard";
import { revalidateSiteWide } from "@/server/api/revalidate";
import { contactsUpdateSchema } from "@/server/api/schemas";
import { listAllContacts, replaceContacts } from "@/server/repositories/contacts";

/**
 * Контакты сайта — чтение и полная перезапись набора.
 *
 * Сохраняется весь список целиком: форма позволяет добавлять, удалять и переставлять каналы, и
 * поштучные запросы оставляли бы промежуточные состояния, в которых сайт успевает показать
 * половину контактов.
 *
 * После сохранения сбрасывается layout всего сайта: телефон из этого набора стоит в шапке КАЖДОЙ
 * страницы, и обновления одной страницы контактов было бы мало.
 */

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  return NextResponse.json({ contacts: listAllContacts() });
}

export async function PUT(request: Request): Promise<NextResponse> {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  const body = await readJsonBody(request, contactsUpdateSchema);
  if (!body.ok) return body.response;

  const ids = body.data.items.map((item) => item.id);
  if (new Set(ids).size !== ids.length) {
    return jsonError(409, "Идентификаторы контактов должны быть уникальными");
  }

  try {
    const contacts = replaceContacts(body.data.items);
    revalidateSiteWide();
    return NextResponse.json({ contacts });
  } catch (error) {
    return handleUnexpected(error, "сохранение контактов");
  }
}
