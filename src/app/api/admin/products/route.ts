import { NextResponse } from "next/server";
import { handleUnexpected, readJsonBody, requireSession } from "@/server/api/guard";
import { revalidateSection } from "@/server/api/revalidate";
import { reorderSchema } from "@/server/api/schemas";
import { listAllProducts, reorderProducts } from "@/server/repositories/products";

/** Список продуктов для админ-панели и изменение порядка отображения. */

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  return NextResponse.json({ products: listAllProducts() });
}

export async function POST(request: Request): Promise<NextResponse> {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  const body = await readJsonBody(request, reorderSchema);
  if (!body.ok) return body.response;

  try {
    reorderProducts(body.data.order);
    revalidateSection("/products");
    return NextResponse.json({ products: listAllProducts() });
  } catch (error) {
    return handleUnexpected(error, "изменение порядка продуктов");
  }
}
