import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Save-guard скрытой legacy-секции на границе HTTP (Amendment 61 / REL-02F.2).
 *
 * Роуты НАСТОЯЩИЕ и против настоящей (временной) базы — как в `articleRelationsAdminApi.test.ts`.
 * Подменены только вход в панель, сброс кэша Next.js, отложенное `after()` и IndexNow.
 *
 * Главное: отказ — исправимая ошибка текста с кодом и `details` у поля `bodyMarkdown`, а не 500; и
 * отказ PUT не оставляет половины записи — ни текста статьи, ни связей.
 */

const session = { id: null as string | null };
const revalidateSection = vi.fn();
const submitIndexNow = vi.fn().mockResolvedValue({ ok: true });
const afterCallbacks: (() => Promise<void>)[] = [];

vi.mock("@/server/auth/session", () => ({
  getActiveSessionId: async () => session.id,
}));

vi.mock("@/server/api/revalidate", () => ({
  revalidateSection: (section: string) => revalidateSection(section),
  revalidateSiteWide: vi.fn(),
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

let temporaryDirectory: string;

const ARTICLE_ID = "article-legacy";
const ORIGINAL_TITLE = "Как автоматизировать заявки";
const NOW = "2026-09-01T10:00:00.000Z";

const TEXT = "**Краткий ответ:** текст.\n\n**Источники:**\n- [Источник](https://example.com/a)";
const SECTION =
  "**Материалы по теме:**\n- «[Сбор заявок](/products/ai-menedzher-dlya-sayta)» — пояснение.";
const WITH_SECTION = `${TEXT}\n\n${SECTION}`;
const INVALID = `${TEXT}\n\n## Материалы по теме\n- [Сбор](/products/ai-menedzher-dlya-sayta)`;

const ARTICLE_BODY = {
  slug: "kak-avtomatizirovat-zayavki",
  title: ORIGINAL_TITLE,
  excerpt: "Краткое описание.",
  bodyMarkdown: WITH_SECTION,
  placement: "blog",
  status: "draft",
  publishedAt: null as string | null,
};

beforeEach(() => {
  temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "qbit-legacy-guard-api-"));
  vi.resetModules();
  vi.stubEnv("QBIT_DB_PATH", path.join(temporaryDirectory, "test.db"));
  session.id = "admin-session";
  revalidateSection.mockReset();
  submitIndexNow.mockReset().mockResolvedValue({ ok: true });
  afterCallbacks.length = 0;
});

afterEach(() => {
  vi.unstubAllEnvs();
  const database = (globalThis as { __qbitDatabase?: { close(): void } }).__qbitDatabase;
  database?.close();
  (globalThis as { __qbitDatabase?: unknown }).__qbitDatabase = undefined;
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
});

/** Статья с заданным телом, продукт и отдел, одна связь на продукт — прямым SQL. */
async function seed(bodyMarkdown: string): Promise<void> {
  const { getDatabase } = await import("@/server/db/client");
  const db = getDatabase();

  db.prepare(
    `INSERT INTO articles (id, slug, title, excerpt, body_markdown, placement, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'blog', ?, ?)`,
  ).run(
    ARTICLE_ID,
    ARTICLE_BODY.slug,
    ORIGINAL_TITLE,
    ARTICLE_BODY.excerpt,
    bodyMarkdown,
    NOW,
    NOW,
  );

  db.prepare(
    `INSERT INTO products (id, slug, menu_title, full_title, content, layout, hotspot, image_alt,
                           created_at, updated_at)
     VALUES ('product-a', 'ai-menedzher-dlya-sayta', 'AI-менеджер', 'AI-менеджер для сайта', '{}',
             'wide', 'sales', 'Иллюстрация', ?, ?)`,
  ).run(NOW, NOW);
  db.prepare(
    `INSERT INTO departments (id, display_name, content, created_at, updated_at)
     VALUES ('sales', 'Отдел продаж', '{}', ?, ?)`,
  ).run(NOW, NOW);

  const { replaceRelationsFrom } = await import("@/server/repositories/contentRelations");
  replaceRelationsFrom("article", ARTICLE_ID, [{ targetType: "product", targetId: "product-a" }]);
}

async function putArticle(body: unknown): Promise<Response> {
  const { PUT } = await import("@/app/api/admin/articles/[id]/route");
  return PUT(
    new Request(`http://localhost/api/admin/articles/${ARTICLE_ID}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: ARTICLE_ID }) },
  );
}

async function postArticle(body: unknown): Promise<Response> {
  const { POST } = await import("@/app/api/admin/articles/route");
  return POST(
    new Request("http://localhost/api/admin/articles", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

async function stored(): Promise<{ title: string; body: string; relations: string[] }> {
  const { getArticleById } = await import("@/server/repositories/articles");
  const { listRelationsFrom } = await import("@/server/repositories/contentRelations");
  const article = getArticleById(ARTICLE_ID)!;
  return {
    title: article.title,
    body: article.bodyMarkdown,
    relations: listRelationsFrom("article", ARTICLE_ID).map(
      (relation) => `${relation.targetType}:${relation.targetId}`,
    ),
  };
}

interface GuardFailure {
  error: string;
  code: string;
  details: { path: string; message: string }[];
}

async function expectGuardFailure(response: Response, status: number, code: string): Promise<void> {
  expect(response.status).toBe(status);
  expect(response.status).not.toBe(500);
  const body = (await response.json()) as GuardFailure;
  expect(body.code).toBe(code);
  expect(body.error).toMatch(/Материалы по теме/u);
  expect(body.details).toEqual([{ path: "bodyMarkdown", message: body.error }]);
}

describe("POST статьи: скрытую секцию создать нельзя", () => {
  it("тело с секцией → 409 legacy_section_forbidden, статья не создана", async () => {
    await seed(TEXT);

    const response = await postArticle({ ...ARTICLE_BODY, slug: "novaya-statya" });

    await expectGuardFailure(response, 409, "legacy_section_forbidden");
    const { isArticleSlugTaken } = await import("@/server/repositories/articles");
    expect(isArticleSlugTaken("novaya-statya")).toBe(false);
    expect(revalidateSection).not.toHaveBeenCalled();
  });

  it("неоднозначная секция → 400 legacy_section_invalid", async () => {
    await seed(TEXT);

    const response = await postArticle({
      ...ARTICLE_BODY,
      slug: "novaya-statya",
      bodyMarkdown: INVALID,
    });

    await expectGuardFailure(response, 400, "legacy_section_invalid");
  });

  it("тело без секции → 201", async () => {
    await seed(TEXT);

    const response = await postArticle({
      ...ARTICLE_BODY,
      slug: "novaya-statya",
      bodyMarkdown: TEXT,
    });

    expect(response.status).toBe(201);
  });
});

describe("PUT статьи с сохранённой секцией", () => {
  it("секция не изменилась, правится название и другой текст → 200", async () => {
    await seed(WITH_SECTION);
    const incoming = `Новый вводный абзац.\n\n${WITH_SECTION}`;

    const response = await putArticle({
      ...ARTICLE_BODY,
      title: "Новое название",
      bodyMarkdown: incoming,
    });

    expect(response.status).toBe(200);
    expect(await stored()).toEqual({
      title: "Новое название",
      body: incoming,
      relations: ["product:product-a"],
    });
  });

  it("секция изменена → 409 legacy_section_changed; откат и статьи, и связей", async () => {
    await seed(WITH_SECTION);

    const response = await putArticle({
      ...ARTICLE_BODY,
      title: "Новое название",
      bodyMarkdown: WITH_SECTION.replace("пояснение.", "другое пояснение."),
      relations: [{ targetType: "department", targetId: "sales" }],
    });

    await expectGuardFailure(response, 409, "legacy_section_changed");
    expect(await stored()).toEqual({
      title: ORIGINAL_TITLE,
      body: WITH_SECTION,
      relations: ["product:product-a"],
    });
    expect(revalidateSection).not.toHaveBeenCalled();
    expect(afterCallbacks).toHaveLength(0);
  });

  it("секция удалена → 409 legacy_section_removal_forbidden; откат и статьи, и связей", async () => {
    await seed(WITH_SECTION);

    const response = await putArticle({
      ...ARTICLE_BODY,
      title: "Новое название",
      bodyMarkdown: TEXT,
      relations: [],
    });

    await expectGuardFailure(response, 409, "legacy_section_removal_forbidden");
    expect(await stored()).toEqual({
      title: ORIGINAL_TITLE,
      body: WITH_SECTION,
      relations: ["product:product-a"],
    });
  });

  it("секция стала неоднозначной → 400 legacy_section_invalid", async () => {
    await seed(WITH_SECTION);

    const response = await putArticle({ ...ARTICLE_BODY, bodyMarkdown: INVALID });

    await expectGuardFailure(response, 400, "legacy_section_invalid");
    expect((await stored()).body).toBe(WITH_SECTION);
  });

  it("trim: в базе секция в конце с пробелами и переводом строки, форма шлёт то же → 200", async () => {
    const storedBody = `${WITH_SECTION}  \n`;
    await seed(storedBody);

    const response = await putArticle({
      ...ARTICLE_BODY,
      title: "Новое название",
      bodyMarkdown: storedBody,
    });

    expect(response.status).toBe(200);
    expect((await stored()).title).toBe("Новое название");
  });

  it("CRLF в базе, LF из формы → 200", async () => {
    await seed(WITH_SECTION.replace(/\n/gu, "\r\n"));

    const response = await putArticle({
      ...ARTICLE_BODY,
      title: "Новое название",
      bodyMarkdown: WITH_SECTION,
    });

    expect(response.status).toBe(200);
    expect((await stored()).title).toBe("Новое название");
  });
});

describe("PUT статьи без сохранённой секции", () => {
  it("добавлена секция → 409 legacy_section_forbidden; откат и статьи, и связей", async () => {
    await seed(TEXT);

    const response = await putArticle({
      ...ARTICLE_BODY,
      title: "Новое название",
      bodyMarkdown: WITH_SECTION,
      relations: [{ targetType: "department", targetId: "sales" }],
    });

    await expectGuardFailure(response, 409, "legacy_section_forbidden");
    expect(await stored()).toEqual({
      title: ORIGINAL_TITLE,
      body: TEXT,
      relations: ["product:product-a"],
    });
  });

  it("обычная правка → 200", async () => {
    await seed(TEXT);

    const response = await putArticle({
      ...ARTICLE_BODY,
      title: "Новое название",
      bodyMarkdown: `${TEXT}\n\nЕщё абзац.`,
    });

    expect(response.status).toBe(200);
  });
});

describe("PUT статьи с неоднозначной секцией в базе (fail-closed)", () => {
  it("текст не менялся — правка других полей разрешена", async () => {
    await seed(INVALID);

    const response = await putArticle({
      ...ARTICLE_BODY,
      title: "Новое название",
      bodyMarkdown: INVALID,
    });

    expect(response.status).toBe(200);
    expect((await stored()).title).toBe("Новое название");
  });

  it("текст изменён → 400 legacy_section_invalid", async () => {
    await seed(INVALID);

    const response = await putArticle({ ...ARTICLE_BODY, bodyMarkdown: `${INVALID}\n- ещё пункт` });

    await expectGuardFailure(response, 400, "legacy_section_invalid");
    expect((await stored()).body).toBe(INVALID);
  });
});
