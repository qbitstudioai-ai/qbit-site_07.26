import { after, NextResponse } from "next/server";
import { handleUnexpected, jsonError, readJsonBody, requireSession } from "@/server/api/guard";
import { revalidateSection, revalidateSiteWide } from "@/server/api/revalidate";
import { productUpdateSchema } from "@/server/api/schemas";
import { submitIndexNow } from "@/server/indexnow/client";
import { productUpdateIndexNowUrls } from "@/server/indexnow/urls";
import { getProductById, updateProduct } from "@/server/repositories/products";

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

/**
 * Правка продукта.
 *
 * АДРЕС НЕ МЕНЯЕТСЯ. `slug` берётся из существующей записи, а присланный клиентом игнорируется
 * молча и полностью — как у кейса. Смена адреса опубликованной страницы обрывает внешние ссылки,
 * обнуляет историю страницы в поиске и оставляет прежний адрес отвечать 404 без перенаправления.
 * Отдельной операции переезда в проекте нет, поэтому и случайно выполнить её нельзя — ни из формы,
 * ни прямым запросом к API.
 *
 * Занятость присланного адреса поэтому и НЕ проверяется: проверять уникальность значения, которое
 * заведомо не будет записано, значит отвечать 409 на сохранение, которое ничего не нарушает.
 */
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

  try {
    const product = updateProduct(id, {
      ...body.data,
      slug: existing.slug,
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
