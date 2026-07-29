import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { handleUnexpected, jsonError, readJsonBody, requireSession } from "@/server/api/guard";
import { revalidatePublicPaths } from "@/server/api/revalidate";
import { documentUpdateSchema, reorderSchema } from "@/server/api/schemas";
import {
  createDocument,
  listAllDocuments,
  listDocumentCategories,
  reorderDocuments,
} from "@/server/repositories/documents";
import {
  deleteStoredFile,
  PREVIEW_UPLOAD_EXTENSIONS,
  saveUploadedFile,
  UploadError,
} from "@/server/storage/files";
import { generatePreview } from "@/server/storage/previews";

/** Список документов, загрузка нового документа и изменение порядка. */

export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  return NextResponse.json({
    documents: listAllDocuments(),
    categories: listDocumentCategories(),
  });
}

export async function POST(request: Request): Promise<NextResponse> {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  const url = new URL(request.url);
  if (url.searchParams.get("action") === "reorder") {
    const body = await readJsonBody(request, reorderSchema);
    if (!body.ok) return body.response;

    try {
      reorderDocuments(body.data.order);
      revalidatePublicPaths(["/documents"]);
      return NextResponse.json({ documents: listAllDocuments() });
    } catch (error) {
      return handleUnexpected(error, "изменение порядка документов");
    }
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError(400, "Ожидается форма с файлом");
  }

  const meta = documentUpdateSchema.safeParse({
    title: form.get("title") ?? "",
    description: form.get("description") ?? "",
    category: form.get("category") ?? "",
    documentDate: form.get("documentDate") || null,
    sortOrder: Number(form.get("sortOrder") ?? 0),
    isPublished: form.get("isPublished") === "true",
  });
  if (!meta.success) {
    return jsonError(
      422,
      "Проверьте заполнение полей",
      meta.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
    );
  }

  const categories = listDocumentCategories();
  if (!categories.some((category) => category.id === meta.data.category)) {
    return jsonError(422, "Выбрана несуществующая категория");
  }

  const file = form.get("file");
  const manualPreview = form.get("previewFile");

  // Порядок действий важен: сначала оригинал, затем предпросмотр, и только потом запись в базу.
  // Обратный порядок оставил бы в каталоге запись, ссылающуюся на несуществующий файл.
  let stored: Awaited<ReturnType<typeof saveUploadedFile>> | null = null;
  let manualPreviewKey: string | null = null;
  // Ключ АВТОМАТИЧЕСКОГО предпросмотра тоже нужно помнить: `generatePreview` уже записал файл на
  // диск, и без этой переменной он оставался бы в хранилище без ссылки, если запись в базу упадёт.
  // В PUT-роуте это учтено, в POST — не было (найдено code review 2026-07-27).
  let autoPreviewKey: string | null = null;

  try {
    stored = await saveUploadedFile(file as File, { folder: "documents" });

    if (manualPreview instanceof File && manualPreview.size > 0) {
      const previewFile = await saveUploadedFile(manualPreview, {
        folder: "previews",
        allowedExtensions: PREVIEW_UPLOAD_EXTENSIONS,
      });
      manualPreviewKey = previewFile.storageKey;
    }

    const auto = await generatePreview(stored.storageKey, stored.extension, meta.data.title);
    autoPreviewKey = auto?.storageKey ?? null;
    const previewUrl = manualPreviewKey ? `/api/files/${manualPreviewKey}` : (auto?.url ?? null);

    const document = createDocument({
      id: randomUUID(),
      ...meta.data,
      fileType: stored.extension,
      mimeType: stored.mimeType,
      fileSize: stored.size,
      originalFileName: stored.originalFileName,
      originalFileUrl: stored.url,
      storageKey: stored.storageKey,
      previewUrl,
      autoPreviewKey: auto?.storageKey ?? null,
      manualPreviewKey,
    });

    revalidatePublicPaths(["/documents"]);
    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    // Файлы уже могли лечь на диск — убираем их, иначе в хранилище останется мусор без записи.
    if (stored) await deleteStoredFile(stored.storageKey).catch(() => undefined);
    if (manualPreviewKey) await deleteStoredFile(manualPreviewKey).catch(() => undefined);
    if (autoPreviewKey) await deleteStoredFile(autoPreviewKey).catch(() => undefined);

    if (error instanceof UploadError) return jsonError(422, error.message);
    return handleUnexpected(error, "загрузка документа");
  }
}
