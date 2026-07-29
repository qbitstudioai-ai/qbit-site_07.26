import { NextResponse } from "next/server";
import { handleUnexpected, jsonError, requireSession } from "@/server/api/guard";
import { revalidatePublicPaths } from "@/server/api/revalidate";
import { documentUpdateSchema } from "@/server/api/schemas";
import {
  deleteDocumentRow,
  getDocumentById,
  listDocumentCategories,
  updateDocument,
} from "@/server/repositories/documents";
import {
  deleteStoredFile,
  PREVIEW_UPLOAD_EXTENSIONS,
  saveUploadedFile,
  UploadError,
} from "@/server/storage/files";
import { generatePreview } from "@/server/storage/previews";

/**
 * Изменение и удаление документа.
 *
 * Запрос — форма, а не JSON: вместе с текстовыми полями может приходить новый файл или новое
 * изображение предпросмотра.
 *
 * Управление предпросмотром:
 *   `previewFile`         — загрузить ручной предпросмотр (заменяет автоматический в показе);
 *   `removeManualPreview` — удалить ручной; если есть автоматический, он возвращается сам.
 */

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  const { id } = await context.params;
  const document = getDocumentById(id);
  if (!document) return jsonError(404, "Документ не найден");

  return NextResponse.json({ document });
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  const { id } = await context.params;
  const existing = getDocumentById(id);
  if (!existing) return jsonError(404, "Документ не найден");

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonError(400, "Ожидается форма");
  }

  const meta = documentUpdateSchema.safeParse({
    title: form.get("title") ?? "",
    description: form.get("description") ?? "",
    category: form.get("category") ?? "",
    documentDate: form.get("documentDate") || null,
    sortOrder: Number(form.get("sortOrder") ?? existing.sortOrder),
    isPublished: form.get("isPublished") === "true",
  });
  if (!meta.success) {
    return jsonError(
      422,
      "Проверьте заполнение полей",
      meta.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
    );
  }

  if (!listDocumentCategories().some((category) => category.id === meta.data.category)) {
    return jsonError(422, "Выбрана несуществующая категория");
  }

  const replacementFile = form.get("file");
  const newManualPreview = form.get("previewFile");
  const removeManualPreview = form.get("removeManualPreview") === "true";

  // Ключи файлов, которые нужно убрать ПОСЛЕ успешной записи в базу: удалять их раньше означало бы
  // потерять файл, если сохранение не пройдёт.
  const staleKeys: Array<string | null> = [];
  let storageKey = existing.storageKey;
  let fileType = existing.fileType;
  let mimeType = existing.mimeType;
  let fileSize = existing.fileSize;
  let originalFileName = existing.originalFileName;
  let originalFileUrl = existing.originalFileUrl;
  let autoPreviewKey = existing.autoPreviewKey;
  let manualPreviewKey = existing.manualPreviewKey;
  const freshKeys: string[] = [];

  try {
    if (replacementFile instanceof File && replacementFile.size > 0) {
      const stored = await saveUploadedFile(replacementFile, { folder: "documents" });
      freshKeys.push(stored.storageKey);
      staleKeys.push(existing.storageKey, existing.autoPreviewKey);

      storageKey = stored.storageKey;
      fileType = stored.extension;
      mimeType = stored.mimeType;
      fileSize = stored.size;
      originalFileName = stored.originalFileName;
      originalFileUrl = stored.url;

      const auto = await generatePreview(stored.storageKey, stored.extension, meta.data.title);
      autoPreviewKey = auto?.storageKey ?? null;
      if (auto?.storageKey) freshKeys.push(auto.storageKey);
    }

    if (removeManualPreview && manualPreviewKey) {
      staleKeys.push(manualPreviewKey);
      manualPreviewKey = null;
    }

    if (newManualPreview instanceof File && newManualPreview.size > 0) {
      const preview = await saveUploadedFile(newManualPreview, {
        folder: "previews",
        allowedExtensions: PREVIEW_UPLOAD_EXTENSIONS,
      });
      freshKeys.push(preview.storageKey);
      if (manualPreviewKey) staleKeys.push(manualPreviewKey);
      manualPreviewKey = preview.storageKey;
    }

    // Автоматический предпросмотр изображения — сам файл: отдельного ключа у него нет.
    const autoPreviewUrl = autoPreviewKey
      ? `/api/files/${autoPreviewKey}`
      : ["jpg", "jpeg", "png", "webp"].includes(fileType)
        ? originalFileUrl
        : null;

    const previewUrl = manualPreviewKey ? `/api/files/${manualPreviewKey}` : autoPreviewUrl;

    const document = updateDocument(id, {
      id,
      ...meta.data,
      fileType,
      mimeType,
      fileSize,
      originalFileName,
      originalFileUrl,
      storageKey,
      previewUrl,
      autoPreviewKey,
      manualPreviewKey,
    });

    for (const key of staleKeys) {
      await deleteStoredFile(key).catch((error) =>
        console.error("[admin-api] не удалось удалить старый файл", key, error),
      );
    }

    revalidatePublicPaths(["/documents"]);
    return NextResponse.json({ document });
  } catch (error) {
    for (const key of freshKeys) await deleteStoredFile(key).catch(() => undefined);
    if (error instanceof UploadError) return jsonError(422, error.message);
    return handleUnexpected(error, `сохранение документа ${id}`);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const unauthorized = await requireSession();
  if (unauthorized) return unauthorized;

  const { id } = await context.params;
  const existing = getDocumentById(id);
  if (!existing) return jsonError(404, "Документ не найден");

  try {
    deleteDocumentRow(id);
  } catch (error) {
    return handleUnexpected(error, `удаление документа ${id}`);
  }

  // Файлы удаляются после записи. Ошибку хранилища НЕ скрываем: запись уже убрана, и молчаливо
  // оставленный файл — это потерянные данные, о которых владелец сайта должен узнать.
  const failed: string[] = [];
  for (const key of [existing.storageKey, existing.autoPreviewKey, existing.manualPreviewKey]) {
    if (!key) continue;
    try {
      await deleteStoredFile(key);
    } catch (error) {
      console.error("[admin-api] удаление файла", key, error);
      failed.push(key);
    }
  }

  revalidatePublicPaths(["/documents"]);

  if (failed.length > 0) {
    return NextResponse.json(
      {
        ok: true,
        warning: `Запись удалена, но ${failed.length} файл(ов) не удалось удалить из хранилища. Проверьте директорию загрузок.`,
      },
      { status: 207 },
    );
  }

  return NextResponse.json({ ok: true });
}
