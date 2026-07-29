import { NextResponse } from "next/server";
import { getPublishedArticles } from "@/server/content/articles";
import { getContactChannels, getContactsPageCopy } from "@/server/content/contacts";
import { getDepartments } from "@/server/content/departments";
import { getDocumentCategories, getPublishedDocuments } from "@/server/content/documents";
import { getProducts, getProductsPageCopy } from "@/server/content/products";

/**
 * Публичное API контента: `/api/content/departments`, `/products`, `/articles`, `/contacts`,
 * `/documents`.
 *
 * Нужно там, где данные требуются уже в браузере: каталог документов перезагружается кнопкой
 * «Повторить» после ошибки, не перерисовывая страницу целиком. Отдаются ТОЛЬКО опубликованные
 * записи и только публичные поля — админские данные сюда не попадают.
 *
 * Один роут с сегментом `[section]` вместо пяти одинаковых файлов: список разделов закрытый,
 * неизвестное имя честно отвечает 404.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const sections = {
  departments: () => ({ departments: getDepartments() }),
  products: () => ({ products: getProducts(), copy: getProductsPageCopy() }),
  articles: () => ({ articles: getPublishedArticles() }),
  contacts: () => ({ contacts: getContactChannels(), copy: getContactsPageCopy() }),
  documents: () => ({ documents: getPublishedDocuments(), categories: getDocumentCategories() }),
} as const;

type SectionName = keyof typeof sections;

function isSectionName(value: string): value is SectionName {
  return Object.hasOwn(sections, value);
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ section: string }> },
): Promise<NextResponse> {
  const { section } = await context.params;

  if (!isSectionName(section)) {
    return NextResponse.json({ error: "Неизвестный раздел контента" }, { status: 404 });
  }

  try {
    return NextResponse.json(sections[section]());
  } catch (error) {
    console.error(`[content-api] ${section}:`, error);
    return NextResponse.json({ error: "Не удалось загрузить данные" }, { status: 500 });
  }
}
