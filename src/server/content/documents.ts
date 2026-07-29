import { cache } from "react";
import seedPageContent from "../../../data/seed/page-content.json";
import type {
  DocumentCategory,
  DocumentItem,
  DocumentsPageCopy,
} from "@/features/documents/documents";
import {
  getPublishedDocuments as readPublishedDocuments,
  listDocumentCategories,
  type DocumentRecord,
} from "../repositories/documents";
import { getPageContent } from "../repositories/pageContent";
import { safePageCopy } from "./pageContentSchemas";

/**
 * Публичный доступ к каталогу документов.
 *
 * Запись базы превращается в `DocumentItem` — форму, которую отрисовывают компоненты раздела.
 * Наружу отдаются только опубликованные записи и только те поля, которые нужны посетителю:
 * внутренние ключи хранилища (`storageKey`, ключи предпросмотров) остаются на сервере.
 */

export function toDocumentItem(record: DocumentRecord): DocumentItem {
  return {
    id: record.id,
    title: record.title,
    description: record.description || undefined,
    category: record.category,
    fileType: record.fileType,
    fileSize: record.fileSize || undefined,
    updatedAt: record.documentDate ?? record.updatedAt.slice(0, 10),
    fileUrl: record.originalFileUrl,
    previewUrl: record.previewUrl ?? undefined,
    sortOrder: record.sortOrder,
    isPublished: record.isPublished,
  };
}

export const getPublishedDocuments = cache((): DocumentItem[] =>
  readPublishedDocuments().map(toDocumentItem),
);

export const getDocumentCategories = cache((): DocumentCategory[] =>
  listDocumentCategories().map((category) => ({ id: category.id, label: category.label })),
);

export const getDocumentsPageCopy = cache((): DocumentsPageCopy => {
  const fallback = seedPageContent.documents as DocumentsPageCopy;
  const merged = {
    ...fallback,
    ...getPageContent<Partial<DocumentsPageCopy>>("documents", fallback),
  };
  return safePageCopy("documents", merged, fallback);
});
