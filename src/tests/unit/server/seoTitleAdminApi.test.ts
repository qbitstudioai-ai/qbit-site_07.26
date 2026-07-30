import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { articleSchema, productUpdateSchema } from "@/server/api/schemas";

/**
 * Административный API и SEO-заголовок.
 *
 * Две связки: (1) схема на границе сервера приводит «пусто» к `null` независимо от того, как форма
 * его прислала, и (2) сохранение продукта действительно сбрасывает кэш раздела и ставит адрес в
 * очередь IndexNow — без этого правка заголовка не доехала бы до посетителя и до поисковика.
 */

const VALID_PRODUCT = {
  slug: "rag-ai-assistant",
  menuTitle: "AI-ассистент",
  fullTitle: "AI-ассистент по знаниям компании",
  imageAlt: "Фотография рабочего места",
  content: {
    summary: "Описание продукта.",
    applies: "Где применяется.",
    examples: ["Пример"],
    prices: [{ label: "Разработка", value: "от 100 000 ₽", amount: 100000 }],
    benefit: "Выгода.",
  },
  sortOrder: 1,
  isPublished: true,
};

const VALID_ARTICLE = {
  slug: "kak-avtomatizirovat-obrabotku-zayavok",
  title: "Автоматизация обработки заявок",
  excerpt: "Анонс",
  bodyMarkdown: "# Текст",
  placement: "blog",
  status: "published",
};

describe("схема: SEO-заголовок продукта", () => {
  it("принимает и сохраняет заданное значение, срезая пробелы", () => {
    const parsed = productUpdateSchema.parse({
      ...VALID_PRODUCT,
      seoTitle: "  AI-ассистент по знаниям: стоимость | QBit-Studio-Ai  ",
    });

    expect(parsed.seoTitle).toBe("AI-ассистент по знаниям: стоимость | QBit-Studio-Ai");
  });

  it("превращает явную очистку в null", () => {
    for (const empty of [null, "", "   "]) {
      const parsed = productUpdateSchema.parse({ ...VALID_PRODUCT, seoTitle: empty });
      expect(parsed.seoTitle, `значение ${JSON.stringify(empty)}`).toBeNull();
    }
  });

  it("отсутствие поля НЕ превращается в null — это не очистка", () => {
    /**
     * Ключевая проверка обратной совместимости: старая вкладка админ-панели шлёт тело без
     * `seoTitle`, и схема обязана донести до репозитория «поля не было», а не «очистить».
     * `null` здесь означал бы стирание заголовка при каждом сохранении из устаревшей формы.
     */
    const parsed = productUpdateSchema.parse(VALID_PRODUCT);

    expect(parsed.seoTitle).toBeUndefined();
    expect(parsed.seoTitle).not.toBeNull();
    // Схема не должна и подставлять ключ со значением — иначе `undefined` где-то станет `null`.
    expect(Object.prototype.hasOwnProperty.call(parsed, "seoTitle")).toBe(false);
  });

  it("не блокирует длинный заголовок: рекомендация не запрет", () => {
    const long = `${"а".repeat(120)} | QBit-Studio-Ai`;
    expect(productUpdateSchema.parse({ ...VALID_PRODUCT, seoTitle: long }).seoTitle).toBe(long);
  });

  it("отвергает заголовок, который явно является вставленным абзацем", () => {
    const result = productUpdateSchema.safeParse({
      ...VALID_PRODUCT,
      seoTitle: "а".repeat(301),
    });
    expect(result.success).toBe(false);
  });

  it("заголовок не подменяет остальные поля продукта", () => {
    const parsed = productUpdateSchema.parse({ ...VALID_PRODUCT, seoTitle: "Короткий заголовок" });

    expect(parsed.fullTitle).toBe(VALID_PRODUCT.fullTitle);
    expect(parsed.menuTitle).toBe(VALID_PRODUCT.menuTitle);
    expect(parsed.slug).toBe(VALID_PRODUCT.slug);
  });
});

describe("схема: SEO-заголовок статьи", () => {
  it("превращает явную очистку в null", () => {
    for (const empty of [null, "", "  "]) {
      expect(articleSchema.parse({ ...VALID_ARTICLE, seoTitle: empty }).seoTitle).toBeNull();
    }
  });

  it("отсутствие поля НЕ превращается в null — семантика та же, что у продукта", () => {
    const parsed = articleSchema.parse(VALID_ARTICLE);

    expect(parsed.seoTitle).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(parsed, "seoTitle")).toBe(false);
  });

  it("сохраняет заданное значение и не трогает название статьи", () => {
    const parsed = articleSchema.parse({
      ...VALID_ARTICLE,
      seoTitle: "Как автоматизировать обработку заявок — QBit-Studio-Ai",
    });

    expect(parsed.seoTitle).toBe("Как автоматизировать обработку заявок — QBit-Studio-Ai");
    expect(parsed.title).toBe(VALID_ARTICLE.title);
  });
});

// ── Роут сохранения продукта ──────────────────────────────────────────────────────────────────

const storedProduct = {
  id: "product-01",
  slug: "rag-ai-assistant",
  isPublished: true,
  seoTitleOverride: null as string | null,
  layout: { panelPosition: "right" },
  hotspot: { x: 0, y: 0, width: 10, height: 10 },
};

const storedArticle = {
  id: "article-01",
  slug: "kak-avtomatizirovat-obrabotku-zayavok",
  placement: "blog",
  status: "published" as const,
  seoTitle: "Как автоматизировать обработку заявок — QBit-Studio-Ai",
};

const updateProduct = vi.fn();
const updateArticle = vi.fn();
const revalidateSection = vi.fn();
const revalidateSiteWide = vi.fn();
const submitIndexNow = vi.fn().mockResolvedValue({ ok: true });
const afterCallbacks: (() => Promise<void>)[] = [];

vi.mock("@/server/api/guard", async () => {
  const actual = await vi.importActual<typeof import("@/server/api/guard")>("@/server/api/guard");
  return { ...actual, requireSession: vi.fn().mockResolvedValue(null) };
});

vi.mock("@/server/repositories/products", () => ({
  getProductById: vi.fn(() => storedProduct),
  isProductSlugTaken: vi.fn(() => false),
  updateProduct: (id: string, input: unknown) => updateProduct(id, input),
}));

vi.mock("@/server/repositories/articles", () => ({
  getArticleById: vi.fn(() => storedArticle),
  isArticleSlugTaken: vi.fn(() => false),
  updateArticle: (id: string, input: unknown) => updateArticle(id, input),
  deleteArticle: vi.fn(() => true),
}));

vi.mock("@/server/api/revalidate", () => ({
  revalidateSection: (section: string) => revalidateSection(section),
  revalidateSiteWide: () => revalidateSiteWide(),
}));

vi.mock("@/server/indexnow/client", () => ({
  submitIndexNow: (urls: string[]) => submitIndexNow(urls),
}));

vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");
  return {
    ...actual,
    after: (callback: () => Promise<void>) => afterCallbacks.push(callback),
  };
});

async function putProduct(body: unknown) {
  const { PUT } = await import("@/app/api/admin/products/[id]/route");
  return PUT(
    new Request("http://localhost/api/admin/products/product-01", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: "product-01" }) },
  );
}

describe("PUT /api/admin/products/[id] — SEO-заголовок", () => {
  beforeEach(() => {
    updateProduct.mockReset();
    revalidateSection.mockReset();
    revalidateSiteWide.mockReset();
    submitIndexNow.mockReset().mockResolvedValue({ ok: true });
    afterCallbacks.length = 0;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("сохраняет заголовок и возвращает его вызывающей стороне", async () => {
    const seoTitle = "AI-ассистент по знаниям: стоимость | QBit-Studio-Ai";
    updateProduct.mockReturnValue({ ...storedProduct, seoTitleOverride: seoTitle });

    const response = await putProduct({ ...VALID_PRODUCT, seoTitle });

    expect(response.status).toBe(200);
    expect(updateProduct).toHaveBeenCalledWith("product-01", expect.objectContaining({ seoTitle }));
    expect(await response.json()).toMatchObject({ product: { seoTitleOverride: seoTitle } });
  });

  it("пустое поле формы доезжает до репозитория как null", async () => {
    updateProduct.mockReturnValue(storedProduct);

    await putProduct({ ...VALID_PRODUCT, seoTitle: "   " });

    expect(updateProduct).toHaveBeenCalledWith(
      "product-01",
      expect.objectContaining({ seoTitle: null }),
    );
  });

  it("СТАРЫЙ клиент без seoTitle: репозиторий не получает ни значения, ни null", async () => {
    updateProduct.mockReturnValue(storedProduct);

    await putProduct(VALID_PRODUCT);

    const [, input] = updateProduct.mock.calls[0] as [string, Record<string, unknown>];
    expect(input.seoTitle).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(input, "seoTitle")).toBe(false);
  });

  it("СТАРЫЙ клиент без seoTitle: остальные поля всё равно сохраняются", async () => {
    updateProduct.mockReturnValue(storedProduct);

    await putProduct({ ...VALID_PRODUCT, menuTitle: "Другое название", sortOrder: 5 });

    expect(updateProduct).toHaveBeenCalledWith(
      "product-01",
      expect.objectContaining({ menuTitle: "Другое название", sortOrder: 5 }),
    );
  });

  it("сохранение сбрасывает кэш раздела продуктов", async () => {
    updateProduct.mockReturnValue(storedProduct);

    await putProduct({ ...VALID_PRODUCT, seoTitle: "Новый заголовок" });

    expect(revalidateSection).toHaveBeenCalledWith("/products");
  });

  it("сохранение ставит адрес продукта в очередь IndexNow", async () => {
    updateProduct.mockReturnValue(storedProduct);

    await putProduct({ ...VALID_PRODUCT, seoTitle: "Новый заголовок" });

    // `after()` откладывает отправку до ответа клиенту — в тесте выполняем её вручную.
    expect(afterCallbacks).toHaveLength(1);
    await afterCallbacks[0]();

    expect(submitIndexNow).toHaveBeenCalledWith(
      expect.arrayContaining([
        "https://allqbit.ru/products/rag-ai-assistant",
        "https://allqbit.ru/products",
      ]),
    );
  });

  it("очистка заголовка тоже сбрасывает кэш и уведомляет IndexNow", async () => {
    updateProduct.mockReturnValue(storedProduct);

    await putProduct({ ...VALID_PRODUCT, seoTitle: null });
    await afterCallbacks[0]();

    expect(revalidateSection).toHaveBeenCalledWith("/products");
    expect(submitIndexNow).toHaveBeenCalledWith(
      expect.arrayContaining(["https://allqbit.ru/products/rag-ai-assistant"]),
    );
  });

  /**
   * Сохранение из старой вкладки — обычное сохранение продукта, а не «изменение SEO title».
   * Проверяется, что оно ведёт себя как раньше: кэш сбрасывается и адрес уходит в IndexNow ровно
   * один раз (лишних отправок отсутствие поля не порождает), а заголовок при этом не трогается.
   */
  it("отсутствие seoTitle не создаёт ложного изменения заголовка и лишних уведомлений", async () => {
    updateProduct.mockReturnValue(storedProduct);

    await putProduct(VALID_PRODUCT);
    expect(afterCallbacks).toHaveLength(1);
    await afterCallbacks[0]();

    expect(revalidateSection).toHaveBeenCalledTimes(1);
    expect(submitIndexNow).toHaveBeenCalledTimes(1);

    const [, input] = updateProduct.mock.calls[0] as [string, Record<string, unknown>];
    expect(Object.prototype.hasOwnProperty.call(input, "seoTitle")).toBe(false);
  });
});

// ── Роут сохранения статьи ────────────────────────────────────────────────────────────────────

async function putArticle(body: unknown) {
  const { PUT } = await import("@/app/api/admin/articles/[id]/route");
  return PUT(
    new Request("http://localhost/api/admin/articles/article-01", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: "article-01" }) },
  );
}

describe("PUT /api/admin/articles/[id] — SEO-заголовок", () => {
  beforeEach(() => {
    updateArticle.mockReset().mockReturnValue(storedArticle);
    revalidateSection.mockReset();
    submitIndexNow.mockReset().mockResolvedValue({ ok: true });
    afterCallbacks.length = 0;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("СТАРЫЙ клиент без seoTitle: репозиторий не получает ни значения, ни null", async () => {
    await putArticle(VALID_ARTICLE);

    const [, input] = updateArticle.mock.calls[0] as [string, Record<string, unknown>];
    expect(input.seoTitle).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(input, "seoTitle")).toBe(false);
  });

  it("СТАРЫЙ клиент без seoTitle: остальные поля всё равно сохраняются", async () => {
    await putArticle({ ...VALID_ARTICLE, title: "Другое название", sortOrder: 42 });

    expect(updateArticle).toHaveBeenCalledWith(
      "article-01",
      expect.objectContaining({ title: "Другое название", sortOrder: 42 }),
    );
  });

  it.each([
    ["пустая строка", ""],
    ["строка из пробелов", "   "],
    ["null", null],
  ])("новый клиент: seoTitle = %s очищает заголовок", async (_label, value) => {
    await putArticle({ ...VALID_ARTICLE, seoTitle: value });

    expect(updateArticle).toHaveBeenCalledWith(
      "article-01",
      expect.objectContaining({ seoTitle: null }),
    );
  });

  it("новый клиент: непустое значение сохраняется и возвращается API", async () => {
    const seoTitle = "Как автоматизировать обработку заявок — QBit-Studio-Ai";
    updateArticle.mockReturnValue({ ...storedArticle, seoTitle });

    const response = await putArticle({ ...VALID_ARTICLE, seoTitle: `  ${seoTitle}  ` });

    expect(response.status).toBe(200);
    expect(updateArticle).toHaveBeenCalledWith("article-01", expect.objectContaining({ seoTitle }));
    expect(await response.json()).toMatchObject({ article: { seoTitle } });
  });

  it("изменение заголовка сбрасывает кэш блога и уведомляет IndexNow", async () => {
    await putArticle({ ...VALID_ARTICLE, seoTitle: "Новый заголовок" });
    await afterCallbacks[0]();

    expect(revalidateSection).toHaveBeenCalledWith("/blog");
    expect(submitIndexNow).toHaveBeenCalledWith(
      expect.arrayContaining([
        "https://allqbit.ru/blog/kak-avtomatizirovat-obrabotku-zayavok",
        "https://allqbit.ru/blog",
      ]),
    );
  });

  it("отсутствие seoTitle не создаёт ложного изменения заголовка и лишних уведомлений", async () => {
    await putArticle(VALID_ARTICLE);
    expect(afterCallbacks).toHaveLength(1);
    await afterCallbacks[0]();

    expect(submitIndexNow).toHaveBeenCalledTimes(1);
    const [, input] = updateArticle.mock.calls[0] as [string, Record<string, unknown>];
    expect(Object.prototype.hasOwnProperty.call(input, "seoTitle")).toBe(false);
  });
});
