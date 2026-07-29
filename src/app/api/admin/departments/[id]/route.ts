import { NextResponse } from "next/server";
import { handleUnexpected, jsonError, readJsonBody, requireSession } from "@/server/api/guard";
import { revalidateSiteWide } from "@/server/api/revalidate";
import { departmentUpdateSchema } from "@/server/api/schemas";
import { getDepartmentById, updateDepartment } from "@/server/repositories/departments";

/**
 * Чтение и сохранение одного отдела.
 *
 * Системный идентификатор в адресе не меняется никогда: к нему привязаны фотография сцены, зона
 * офиса и маршрут решения. Меняется только текст.
 */

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  const { id } = await context.params;
  const department = getDepartmentById(id);
  if (!department) return jsonError(404, "Отдел не найден");

  return NextResponse.json({ department });
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  const { id } = await context.params;
  if (!getDepartmentById(id)) return jsonError(404, "Отдел не найден");

  const body = await readJsonBody(request, departmentUpdateSchema);
  if (!body.ok) return body.response;

  const { isPublished, ...content } = body.data;

  try {
    const department = updateDepartment(id, content, { isPublished });
    // Отдел виден и на главной, и в разделе решений: сбрасываем весь layout, а не одну страницу.
    revalidateSiteWide();
    return NextResponse.json({ department });
  } catch (error) {
    return handleUnexpected(error, `сохранение отдела ${id}`);
  }
}
