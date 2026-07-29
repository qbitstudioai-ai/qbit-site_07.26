import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { articlePlacementHref } from "@/content/article-placements";
import { handleUnexpected, jsonError, readJsonBody, requireSession } from "@/server/api/guard";
import { revalidateSection } from "@/server/api/revalidate";
import { articleSchema, reorderSchema } from "@/server/api/schemas";
import {
  createArticle,
  isArticleSlugTaken,
  listAllArticles,
  reorderArticles,
} from "@/server/repositories/articles";

/** Список статей, создание статьи и изменение порядка. */

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  return NextResponse.json({ articles: listAllArticles() });
}

export async function POST(request: Request): Promise<NextResponse> {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  // Один роут обслуживает и создание, и переупорядочивание: их различает поле `order` в теле.
  const url = new URL(request.url);
  if (url.searchParams.get("action") === "reorder") {
    const body = await readJsonBody(request, reorderSchema);
    if (!body.ok) return body.response;

    try {
      reorderArticles(body.data.order);
      revalidateSection("/blog");
      return NextResponse.json({ articles: listAllArticles() });
    } catch (error) {
      return handleUnexpected(error, "изменение порядка статей");
    }
  }

  const body = await readJsonBody(request, articleSchema);
  if (!body.ok) return body.response;

  if (isArticleSlugTaken(body.data.slug)) {
    return jsonError(409, `Адрес «${body.data.slug}» уже занят другой статьёй`);
  }

  try {
    const article = createArticle(randomUUID(), {
      ...body.data,
      // Опубликованная статья обязана иметь дату: по ней строится сортировка и микроразметка.
      publishedAt:
        body.data.status === "published"
          ? (body.data.publishedAt ?? new Date().toISOString().slice(0, 10))
          : body.data.publishedAt,
    });

    revalidateSection(articlePlacementHref(article.placement));
    return NextResponse.json({ article }, { status: 201 });
  } catch (error) {
    return handleUnexpected(error, "создание статьи");
  }
}
