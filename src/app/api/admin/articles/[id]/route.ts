import { after, NextResponse } from "next/server";
import { articlePlacementHref } from "@/content/article-placements";
import { handleUnexpected, jsonError, readJsonBody, requireSession } from "@/server/api/guard";
import { revalidateSection } from "@/server/api/revalidate";
import { articleUpdateSchema } from "@/server/api/schemas";
import { submitIndexNow } from "@/server/indexnow/client";
import { articleDeleteIndexNowUrls, articleUpdateIndexNowUrls } from "@/server/indexnow/urls";
import { deleteArticle, getArticleById, isArticleSlugTaken } from "@/server/repositories/articles";
import { updateArticleWithRelations } from "@/server/repositories/articleWithRelations";
import { ContentRelationError } from "@/server/repositories/contentRelations";

/** Чтение, сохранение и удаление одной статьи. */

export const runtime = "nodejs";

/**
 * Отказ по связям — это ошибка ЗАПОЛНЕНИЯ, а не сбой.
 *
 * Без этого разбора `handleUnexpected()` вернул бы 500 и текст «попробуйте ещё раз» на исправимую
 * ошибку: цель удалили в соседней вкладке, материал сослался сам на себя, один и тот же материал
 * попал в список дважды. Код отдаётся отдельным полем `code`, чтобы форма показала сообщение у
 * нужного поля, не разбирая текст.
 *
 * Повтор — 409, остальное — 400: повтор конфликтует с уже присланной строкой того же списка, и
 * отдельный статус делает три случая различимыми даже для клиента, который `code` не читает.
 */
function relationErrorResponse(error: ContentRelationError): NextResponse {
  const status = error.code === "duplicate_relation" ? 409 : 400;
  return NextResponse.json({ error: error.message, code: error.code }, { status });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  const { id } = await context.params;
  const article = getArticleById(id);
  if (!article) return jsonError(404, "Статья не найдена");

  return NextResponse.json({ article });
}

/**
 * Правка статьи.
 *
 * АДРЕС МЕНЯЕТСЯ ТОЛЬКО ДО ПЕРВОЙ ПУБЛИКАЦИИ. Пока черновик ни разу не был опубликован, его адрес
 * никому не известен: на него нет внешних ссылок, его нет в выдаче и в карте сайта — свободная
 * правка там безопасна и нужна (адрес обычно и подбирается при подготовке материала).
 *
 * После публикации адрес фиксируется: смена адреса опубликованной страницы обрывает внешние
 * ссылки, обнуляет её историю в поиске и оставляет прежний адрес отвечать 404 без перенаправления.
 * Операции переезда с редиректом в проекте нет.
 *
 * Признак «публиковалась» — status ИЛИ сохранившаяся дата публикации: снятая с публикации статья
 * (`draft` при непустом `publishedAt`) когда-то была видна снаружи, и её адрес такой же чужой, как
 * у опубликованной.
 *
 * Поэтому же ДАТА ПУБЛИКАЦИИ НЕ СТИРАЕТСЯ. Она — ключ этого замка, и если бы обычное сохранение
 * могло записать в неё `null`, замок открывался бы прямо из формы: снять с публикации, очистить
 * поле даты, сохранить — и адрес снова свободен. Раз появившись, дата остаётся; её можно
 * ИСПРАВИТЬ, прислав другую, но не убрать. См. `nextPublishedAt` ниже.
 *
 * Когда адрес зафиксирован, занятость присланного значения не проверяется: оно заведомо не будет
 * записано, и 409 означал бы отказ в сохранении, которое ничего не нарушает.
 */
export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  const { id } = await context.params;
  const existing = getArticleById(id);
  if (!existing) return jsonError(404, "Статья не найдена");

  const body = await readJsonBody(request, articleUpdateSchema);
  if (!body.ok) return body.response;

  const slugLocked = existing.status === "published" || existing.publishedAt !== null;

  if (!slugLocked && isArticleSlugTaken(body.data.slug, id)) {
    return jsonError(409, `Адрес «${body.data.slug}» уже занят другой статьёй`);
  }

  /**
   * Дата публикации после сохранения, три случая по порядку:
   *
   * 1. дата уже есть, а прислан `null` — это НЕ очистка, а старая форма или снятие с публикации:
   *    прежнее значение остаётся, иначе вместе с ним пропал бы замок адреса. Этот же случай и
   *    защищает дату ПЕРВОГО выхода от переписывания сегодняшней при повторной публикации;
   * 2. публикация без даты — сегодняшняя. Сюда доходит только материал, у которого даты никогда не
   *    было: всё остальное перехватил случай 1, поэтому средняя ступень `existing.publishedAt`
   *    сегодня недостижима и стоит запасом — на случай, если поле формы станет необязательным;
   * 3. во всех остальных случаях — то, что прислали: непустую дату можно исправить, а черновик,
   *    у которого даты никогда не было, так её и не получает и остаётся свободным по адресу.
   */
  const nextPublishedAt =
    existing.publishedAt !== null && body.data.publishedAt === null
      ? existing.publishedAt
      : body.data.status === "published"
        ? (body.data.publishedAt ?? existing.publishedAt ?? new Date().toISOString().slice(0, 10))
        : body.data.publishedAt;

  /**
   * Связи и текст статьи сохраняются ОДНОЙ транзакцией.
   *
   * `relations` разбирается схемой без `default`, поэтому сюда доходят три различимых состояния:
   * поля не было (`undefined`) — связи не трогаются; `[]` — связи очищаются; список — замена.
   * Первое состояние — сегодняшняя норма: форма перелинковки появится отдельным шагом, и до тех
   * пор админ-панель шлёт `PUT` вообще без этого поля.
   */
  const { relations, ...articleInput } = body.data;

  try {
    const { article } = updateArticleWithRelations(
      id,
      {
        ...articleInput,
        slug: slugLocked ? existing.slug : body.data.slug,
        publishedAt: nextPublishedAt,
      },
      relations,
    );

    // Всё, что ниже, транзакцией не откатывается, поэтому стоит строго ПОСЛЕ успешной записи.
    // Сбрасываются оба раздела: если статью перенесли, старый список тоже обязан обновиться.
    revalidateSection(articlePlacementHref(existing.placement));
    revalidateSection(articlePlacementHref(article.placement));
    after(async () => {
      await submitIndexNow(articleUpdateIndexNowUrls(existing, article));
    });
    return NextResponse.json({ article });
  } catch (error) {
    if (error instanceof ContentRelationError) return relationErrorResponse(error);
    return handleUnexpected(error, `сохранение статьи ${id}`);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  const { id } = await context.params;
  const existing = getArticleById(id);
  if (!existing) return jsonError(404, "Статья не найдена");

  try {
    deleteArticle(id);
    revalidateSection(articlePlacementHref(existing.placement));
    after(async () => {
      await submitIndexNow(articleDeleteIndexNowUrls(existing));
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleUnexpected(error, `удаление статьи ${id}`);
  }
}
