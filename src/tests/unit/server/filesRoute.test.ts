import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Модель доступа к файлам документов (аудит 2026-07-27, SEC-07).
 *
 * До исправления `/api/files/*` отдавал байты, не заглядывая в базу: считалось, что имя файла
 * (UUIDv4) угадать нельзя. Но ссылка на опубликованный документ попадает в поисковый кэш, историю
 * браузера и Referer-логи, поэтому снятие с публикации не отзывало доступ.
 *
 * Тесты работают на ОТДЕЛЬНОЙ временной базе и во временной директории загрузок. Пользовательские
 * `var/content.db` и `var/uploads` не открываются и не изменяются.
 */

let temporaryDirectory: string;
let uploadsDirectory: string;

const sessionMock = vi.hoisted(() => ({ getActiveSessionId: vi.fn() }));

vi.mock("@/server/auth/session", () => sessionMock);

async function loadRoute() {
  return import("@/app/api/files/[...path]/route");
}

async function loadDocuments() {
  return import("@/server/repositories/documents");
}

/** Кладёт файл в хранилище и возвращает его ключ. */
function writeStoredFile(relativeKey: string, contents: string): string {
  const absolute = path.join(uploadsDirectory, relativeKey);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, contents);
  return relativeKey;
}

function documentInput(overrides: Record<string, unknown>) {
  return {
    id: "doc-" + Math.random().toString(36).slice(2),
    title: "Документ",
    description: "",
    category: "legal",
    fileType: "pdf",
    mimeType: "application/pdf",
    fileSize: 10,
    originalFileName: "doc.pdf",
    originalFileUrl: "/api/files/documents/x.pdf",
    storageKey: "documents/x.pdf",
    previewUrl: null,
    autoPreviewKey: null,
    manualPreviewKey: null,
    sortOrder: 10,
    isPublished: true,
    documentDate: null,
    ...overrides,
  };
}

async function get(storageKey: string, search = "") {
  const { GET } = await loadRoute();
  return GET(new Request(`http://localhost/api/files/${storageKey}${search}`), {
    params: Promise.resolve({ path: storageKey.split("/") }),
  });
}

beforeEach(() => {
  temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "qbit-files-"));
  uploadsDirectory = path.join(temporaryDirectory, "uploads");
  fs.mkdirSync(uploadsDirectory, { recursive: true });

  vi.resetModules();
  sessionMock.getActiveSessionId.mockReset();
  sessionMock.getActiveSessionId.mockResolvedValue(null);

  vi.stubEnv("QBIT_DB_PATH", path.join(temporaryDirectory, "test.db"));
  vi.stubEnv("QBIT_UPLOADS_DIR", uploadsDirectory);
});

afterEach(() => {
  vi.unstubAllEnvs();

  const database = (globalThis as { __qbitDatabase?: { close(): void } }).__qbitDatabase;
  database?.close();
  (globalThis as { __qbitDatabase?: unknown }).__qbitDatabase = undefined;

  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
});

describe("GET /api/files/[...path] — публикация управляет доступом", () => {
  it("опубликованный документ отдаётся без сессии", async () => {
    const { createDocument } = await loadDocuments();
    const key = writeStoredFile("documents/published.pdf", "%PDF-1.4 содержимое");
    createDocument(documentInput({ storageKey: key, isPublished: true }));

    const response = await get(key);

    expect(response.status).toBe(200);
    expect(await response.text()).toContain("%PDF-1.4");
  });

  it("НЕопубликованный документ не отдаётся без сессии", async () => {
    const { createDocument } = await loadDocuments();
    const key = writeStoredFile("documents/draft.pdf", "секретное содержимое");
    createDocument(documentInput({ storageKey: key, isPublished: false }));

    const response = await get(key);

    expect(response.status).toBe(404);
    expect(await response.text()).not.toContain("секретное");
  });

  it("НЕопубликованный документ доступен администратору", async () => {
    const { createDocument } = await loadDocuments();
    const key = writeStoredFile("documents/draft2.pdf", "черновик документа");
    createDocument(documentInput({ storageKey: key, isPublished: false }));
    sessionMock.getActiveSessionId.mockResolvedValue("session-id");

    const response = await get(key);

    expect(response.status).toBe(200);
    expect(await response.text()).toContain("черновик");
  });

  it("снятие с публикации отзывает доступ по уже известной ссылке", async () => {
    const { createDocument, updateDocument } = await loadDocuments();
    const key = writeStoredFile("documents/toggle.pdf", "содержимое документа");
    const created = createDocument(documentInput({ storageKey: key, isPublished: true }));

    expect((await get(key)).status).toBe(200);

    updateDocument(created.id, {
      ...documentInput({ storageKey: key, isPublished: false }),
      id: created.id,
    });

    expect((await get(key)).status).toBe(404);
  });
});

describe("GET /api/files/[...path] — предпросмотры подчиняются тем же правилам", () => {
  it("предпросмотр опубликованного документа отдаётся", async () => {
    const { createDocument } = await loadDocuments();
    const original = writeStoredFile("documents/with-preview.pdf", "оригинал");
    const preview = writeStoredFile("previews/cover.png", "изображение обложки");
    createDocument(
      documentInput({ storageKey: original, autoPreviewKey: preview, isPublished: true }),
    );

    expect((await get(preview)).status).toBe(200);
  });

  it("предпросмотр НЕопубликованного документа не отдаётся без сессии", async () => {
    const { createDocument } = await loadDocuments();
    const original = writeStoredFile("documents/hidden.pdf", "оригинал");
    const preview = writeStoredFile("previews/hidden-cover.png", "изображение обложки");
    createDocument(
      documentInput({ storageKey: original, manualPreviewKey: preview, isPublished: false }),
    );

    expect((await get(preview)).status).toBe(404);
  });
});

describe("GET /api/files/[...path] — файлы вне каталога", () => {
  it("файл, не связанный ни с одним документом, не отдаётся", async () => {
    const key = writeStoredFile("documents/orphan.pdf", "файл без записи в базе");

    const response = await get(key);

    expect(response.status).toBe(404);
  });

  it("после удаления записи файл не отдаётся, даже если остался на диске", async () => {
    const { createDocument, deleteDocumentRow } = await loadDocuments();
    const key = writeStoredFile("documents/removed.pdf", "содержимое");
    const created = createDocument(documentInput({ storageKey: key, isPublished: true }));

    expect((await get(key)).status).toBe(200);

    deleteDocumentRow(created.id);

    expect((await get(key)).status).toBe(404);
    // Файл намеренно оставлен на диске: проверяется именно то, что запись каталога решает всё.
    expect(fs.existsSync(path.join(uploadsDirectory, key))).toBe(true);
  });

  it("несуществующий UUID даёт 404 и не раскрывает путь файловой системы", async () => {
    const response = await get("documents/00000000-0000-4000-8000-000000000000.pdf");
    const body = await response.text();

    expect(response.status).toBe(404);
    expect(body).not.toMatch(/[A-Za-z]:\\|\/var\/|uploads/);
  });

  it("ответ 404 одинаков для несуществующего и для неопубликованного", async () => {
    const { createDocument } = await loadDocuments();
    const key = writeStoredFile("documents/secret.pdf", "содержимое");
    createDocument(documentInput({ storageKey: key, isPublished: false }));

    const hidden = await get(key);
    const missing = await get("documents/00000000-0000-4000-8000-000000000001.pdf");

    expect(hidden.status).toBe(missing.status);
    expect(await hidden.text()).toBe(await missing.text());
  });
});

describe("GET /api/files/[...path] — обход каталога и заголовки", () => {
  it.each([
    "../../.env.local",
    "../content.db",
    "documents/../../content.db",
    "documents/../../../package.json",
  ])("не выпускает за пределы хранилища: %s", async (key) => {
    // Файл-приманка рядом с хранилищем: если обход сработает, тест это заметит.
    fs.writeFileSync(path.join(temporaryDirectory, "content.db"), "СЕКРЕТ БАЗЫ");

    const response = await get(key);

    expect(response.status).toBe(404);
    expect(await response.text()).not.toContain("СЕКРЕТ");
  });

  it("опубликованный файл отдаётся с безопасными заголовками", async () => {
    const { createDocument } = await loadDocuments();
    const key = writeStoredFile("documents/headers.pdf", "содержимое");
    createDocument(documentInput({ storageKey: key, isPublished: true }));

    const response = await get(key);

    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Content-Security-Policy")).toBe("sandbox; default-src 'none'");
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toContain("inline");
  });

  it("неопубликованный файл администратору не кэшируется публично", async () => {
    const { createDocument } = await loadDocuments();
    const key = writeStoredFile("documents/private.pdf", "содержимое");
    createDocument(documentInput({ storageKey: key, isPublished: false }));
    sessionMock.getActiveSessionId.mockResolvedValue("session-id");

    const response = await get(key);

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("?download=1 отдаёт вложением и не допускает подмены заголовка через ?name", async () => {
    const { createDocument } = await loadDocuments();
    const key = writeStoredFile("documents/download.pdf", "содержимое");
    createDocument(documentInput({ storageKey: key, isPublished: true }));

    const response = await get(key, '?download=1&name=a"b%0d%0aX-Injected:%201');
    const disposition = response.headers.get("Content-Disposition") ?? "";

    expect(disposition).toContain("attachment");
    expect(disposition).not.toContain("\r");
    expect(disposition).not.toContain("\n");
    expect(response.headers.get("X-Injected")).toBeNull();
  });
});
