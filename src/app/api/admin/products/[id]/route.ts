import { after, NextResponse } from "next/server";
import { handleUnexpected, jsonError, readJsonBody, requireSession } from "@/server/api/guard";
import { revalidateSection, revalidateSiteWide } from "@/server/api/revalidate";
import { productUpdateSchema } from "@/server/api/schemas";
import { submitIndexNow } from "@/server/indexnow/client";
import { productUpdateIndexNowUrls } from "@/server/indexnow/urls";
import { getProductById, isProductSlugTaken, updateProduct } from "@/server/repositories/products";

/**
 * Чтение и сохранение одного продукта.
 *
 * Удаления нет намеренно: десять продуктов связаны с фотографиями лаборатории и зонами на них.
 * Чтобы убрать продукт с сайта, используется переключатель «Показывать на сайте».
 */

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  const { id } = await context.params;
  const product = getProductById(id);
  if (!product) return jsonError(404, "Продукт не найден");

  return NextResponse.json({ product });
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  const { id } = await context.params;
  const existing = getProductById(id);
  if (!existing) return jsonError(404, "Продукт не найден");

  const body = await readJsonBody(request, productUpdateSchema);
  if (!body.ok) return body.response;

  // Адрес продукта — часть публичной ссылки: занятый slug должен давать понятную ошибку формы, а
  // не нарушение UNIQUE где-то в глубине.
  if (isProductSlugTaken(body.data.slug, id)) {
    return jsonError(409, `Адрес «${body.data.slug}» уже занят другим продуктом`);
  }

  try {
    const product = updateProduct(id, {
      ...body.data,
      layout: existing.layout,
      hotspot: existing.hotspot,
    });

    revalidateSection("/products");
    revalidateSiteWide();
    after(async () => {
      await submitIndexNow(productUpdateIndexNowUrls(existing, product));
    });
    return NextResponse.json({ product });
  } catch (error) {
    return handleUnexpected(error, `сохранение продукта ${id}`);
  }
}
