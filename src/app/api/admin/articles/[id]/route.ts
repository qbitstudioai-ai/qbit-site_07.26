import { NextResponse } from "next/server";
import { articlePlacementHref } from "@/content/article-placements";
import { handleUnexpected, jsonError, readJsonBody, requireSession } from "@/server/api/guard";
import { revalidateSection } from "@/server/api/revalidate";
import { articleSchema } from "@/server/api/schemas";
import {
  deleteArticle,
  getArticleById,
  isArticleSlugTaken,
  updateArticle,
} from "@/server/repositories/articles";

/** Чтение, сохранение и удаление одной статьи. */

export const runtime = "nodejs";

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

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  const { id } = await context.params;
  const existing = getArticleById(id);
  if (!existing) return jsonError(404, "Статья не найдена");

  const body = await readJsonBody(request, articleSchema);
  if (!body.ok) return body.response;

  if (isArticleSlugTaken(body.data.slug, id)) {
    return jsonError(409, `Адрес «${body.data.slug}» уже занят другой статьёй`);
  }

  try {
    const article = updateArticle(id, {
      ...body.data,
      publishedAt:
        body.data.status === "published"
          ? (body.data.publishedAt ?? new Date().toISOString().slice(0, 10))
          : body.data.publishedAt,
    });

    // Сбрасываются оба раздела: если статью перенесли, старый список тоже обязан обновиться.
    revalidateSection(articlePlacementHref(existing.placement));
    revalidateSection(articlePlacementHref(article.placement));
    return NextResponse.json({ article });
  } catch (error) {
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
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleUnexpected(error, `удаление статьи ${id}`);
  }
}
