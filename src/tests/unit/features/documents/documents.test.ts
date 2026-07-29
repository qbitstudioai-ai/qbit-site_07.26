import { describe, expect, it } from "vitest";
import {
  ALL_CATEGORIES,
  categoryLabel,
  type DocumentItem,
  documentFacts,
  filterByCategory,
  formatFileSize,
  formatUpdatedAt,
  selectCategoryOptions,
  selectPublishedDocuments,
} from "@/features/documents/documents";
import { seedDocumentCategories, seedDocumentItems } from "@/tests/fixtures/seedContent";

const item = (overrides: Partial<DocumentItem> & Pick<DocumentItem, "id">): DocumentItem => ({
  title: `Документ ${overrides.id}`,
  category: "legal",
  fileType: "pdf",
  fileUrl: `/dox/files/${overrides.id}.pdf`,
  ...overrides,
});

describe("каталог документов", () => {
  it("исключает снятые с публикации и сортирует по sortOrder", () => {
    const result = selectPublishedDocuments([
      item({ id: "c", sortOrder: 30 }),
      item({ id: "hidden", sortOrder: 1, isPublished: false }),
      item({ id: "a", sortOrder: 10 }),
      item({ id: "b", sortOrder: 20 }),
    ]);

    expect(result.map((document) => document.id)).toEqual(["a", "b", "c"]);
  });

  it("ставит записи без sortOrder в конец, сохраняя алфавитный порядок", () => {
    const result = selectPublishedDocuments([
      item({ id: "no-order-b", title: "Бета" }),
      item({ id: "ordered", sortOrder: 5 }),
      item({ id: "no-order-a", title: "Альфа" }),
    ]);

    expect(result.map((document) => document.id)).toEqual(["ordered", "no-order-a", "no-order-b"]);
  });

  it("исходный набор документов проходит отбор и не содержит неопубликованных записей", () => {
    const published = selectPublishedDocuments(seedDocumentItems);

    expect(published.length).toBeGreaterThanOrEqual(5);
    expect(published.every((document) => document.isPublished !== false)).toBe(true);
    expect(published.some((document) => document.id === "internal-draft")).toBe(false);
    // Файлы раздаёт объектное хранилище, а не папка public: там их можно удалить вместе с записью.
    expect(published.every((document) => document.fileUrl.startsWith("/api/files/"))).toBe(true);
  });
});

describe("категории", () => {
  it("показывает «Все» и только непустые категории", () => {
    const options = selectCategoryOptions(
      [
        item({ id: "a", category: "legal" }),
        item({ id: "b", category: "legal" }),
        item({ id: "c", category: "projects" }),
      ],
      seedDocumentCategories,
    );

    expect(options.map((option) => option.id)).toEqual([ALL_CATEGORIES, "legal", "projects"]);
    expect(options.map((option) => option.count)).toEqual([3, 2, 1]);
    expect(options.some((option) => option.id === "presentations")).toBe(false);
  });

  it("не показывает фильтр, когда категория всего одна", () => {
    expect(
      selectCategoryOptions([item({ id: "a" }), item({ id: "b" })], seedDocumentCategories),
    ).toEqual([]);
  });

  it("пропускает незнакомую категорию из будущей админ-панели как есть", () => {
    const options = selectCategoryOptions(
      [item({ id: "a", category: "legal" }), item({ id: "b", category: "sertifikaty" })],
      seedDocumentCategories,
    );

    expect(options.map((option) => option.label)).toEqual([
      "Все",
      "Юридические документы",
      "sertifikaty",
    ]);
    expect(categoryLabel("sertifikaty", seedDocumentCategories)).toBe("sertifikaty");
    expect(categoryLabel("legal", seedDocumentCategories)).toBe("Юридические документы");
  });

  it("фильтрует список по выбранной категории", () => {
    const items = [item({ id: "a", category: "legal" }), item({ id: "b", category: "projects" })];

    expect(filterByCategory(items, ALL_CATEGORIES)).toHaveLength(2);
    expect(filterByCategory(items, "projects").map((document) => document.id)).toEqual(["b"]);
  });
});

describe("метаданные документа", () => {
  it("форматирует дату по-русски и не падает на мусоре", () => {
    expect(formatUpdatedAt("2026-07-18")).toBe("18 июля 2026");
    expect(formatUpdatedAt("2026-01-01")).toBe("1 января 2026");
    expect(formatUpdatedAt("18.07.2026")).toBe("18.07.2026");
    expect(formatUpdatedAt("2026-13-01")).toBe("2026-13-01");
  });

  it("форматирует размер файла из байтов", () => {
    // Размер хранится числом и приводится к строке при показе: строку «1,8 МБ» нельзя ни
    // отсортировать, ни сравнить, ни пересчитать.
    expect(formatFileSize(512)).toBe("512 Б");
    expect(formatFileSize(327_680)).toBe("320 КБ");
    expect(formatFileSize(1_887_437)).toBe("1,8 МБ");
    expect(formatFileSize(0)).toBe("0 Б");
  });

  it("собирает строку фактов, пропуская отсутствующие поля", () => {
    expect(
      documentFacts(item({ id: "a", fileSize: 1_887_437, updatedAt: "2026-07-18" }), "обновлено "),
    ).toBe("PDF · 1,8 МБ · обновлено 18 июля 2026");
    expect(documentFacts(item({ id: "b", fileSize: 327_680 }))).toBe("PDF · 320 КБ");
    expect(documentFacts(item({ id: "c", fileType: "txt" }))).toBe("TXT");
  });
});
