import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CASE_DEFAULTS } from "@/features/cases/caseRecord";

/**
 * Административное API раздела «Кейсы»: публикация, правка, удаление.
 *
 * Роуты проверяются НАСТОЯЩИЕ и против настоящей (временной) базы: подменены только два внешних
 * обстоятельства — вход в панель и сброс кэша Next.js, которого вне запроса не существует. Всё
 * остальное — схема, репозиторий, SQL и ограничения таблицы — работает так же, как в production.
 *
 * Что здесь закрепляется помимо «работает»:
 *
 * — без сессии не отвечает ни один метод, включая чтение списка;
 * — адрес опубликованного кейса не меняется НИКОГДА, даже если его прислали в теле запроса;
 * — дата первой публикации не переписывается правкой;
 * — после каждой мутации сбрасывается кэш раздела и карты сайта, иначе правка не доедет до сайта.
 */

/** Текущая сессия. `null` — посетитель не вошёл в панель. */
const session = { id: null as string | null };
const revalidateCases = vi.fn();

vi.mock("@/server/auth/session", () => ({
  getActiveSessionId: async () => session.id,
}));

vi.mock("@/server/api/revalidate", () => ({
  revalidateCases: () => revalidateCases(),
}));

let temporaryDirectory: string;

const VALID_CASE = {
  slug: "avtomatizatsiya-otcheta",
  title: "Автоматизация отчёта: заголовок документа",
  shortTitle: "Автоматизация отчёта",
  fileNumber: "02",
  summary: "Краткий итог.",
  task: "Задача.",
  implementation: "Что реализовали.",
  workflowSteps: ["первый шаг", "второй шаг"],
  result: "Результат.\n\nОговорка рядом с цифрами.",
  metricLabel: "Время на подготовку отчёта",
  metricBefore: "3 часа в неделю",
  metricAfter: "20 минут в неделю",
  metricSource: "По данным заказчика",
  humanControl: "Решение принимает человек.",
  limitations: "Результат относится к конкретному внедрению.",
  seoTitle: "Автоматизация отчёта: с 3 часов до 20 минут",
  seoDescription: "Описание страницы кейса.",
  ogDescription: "Описание карточки.",
  stampEnabled: true,
  sortOrder: 2,
};

beforeEach(() => {
  temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "qbit-cases-api-"));
  vi.resetModules();
  vi.stubEnv("QBIT_DB_PATH", path.join(temporaryDirectory, "test.db"));
  session.id = "admin-session";
  revalidateCases.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
  const database = (globalThis as { __qbitDatabase?: { close(): void } }).__qbitDatabase;
  database?.close();
  (globalThis as { __qbitDatabase?: unknown }).__qbitDatabase = undefined;
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
});

function jsonRequest(method: string, body: unknown): Request {
  return new Request("http://localhost/api/admin/cases", {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function publish(body: unknown = VALID_CASE) {
  const { POST } = await import("@/app/api/admin/cases/route");
  return POST(jsonRequest("POST", body));
}

async function edit(id: string, body: unknown) {
  const { PUT } = await import("@/app/api/admin/cases/[id]/route");
  return PUT(jsonRequest("PUT", body), { params: Promise.resolve({ id }) });
}

async function remove(id: string) {
  const { DELETE } = await import("@/app/api/admin/cases/[id]/route");
  return DELETE(new Request("http://localhost/api/admin/cases", { method: "DELETE" }), {
    params: Promise.resolve({ id }),
  });
}

interface CaseResponse {
  caseStudy: {
    id: string;
    slug: string;
    shortTitle: string;
    fileNumber: string;
    publishedAt: string | null;
    modifiedAt: string | null;
    ctaLabel: string;
    ctaHref: string;
    label: string;
    status: string;
    task: string;
  };
}

describe("доступ к API кейсов", () => {
  it("без входа в панель не отвечает ни один метод", async () => {
    session.id = null;

    const { GET } = await import("@/app/api/admin/cases/route");
    expect((await GET()).status).toBe(401);
    expect((await publish()).status).toBe(401);
    expect((await edit("case-sales-call-analysis", VALID_CASE)).status).toBe(401);
    expect((await remove("case-sales-call-analysis")).status).toBe(401);

    // Ни одной записи и ни одного сброса кэша неавторизованный запрос не произвёл.
    const { listAllCases } = await import("@/server/repositories/cases");
    expect(listAllCases()).toHaveLength(1);
    expect(revalidateCases).not.toHaveBeenCalled();
  });

  it("вошедшему отдаёт список и подсказывает следующий порядок", async () => {
    const { GET } = await import("@/app/api/admin/cases/route");
    const payload = (await (await GET()).json()) as {
      cases: { slug: string }[];
      nextSortOrder: number;
    };

    expect(payload.cases.map((study) => study.slug)).toEqual(["analiz-zvonkov-otdela-prodazh"]);
    expect(payload.nextSortOrder).toBe(2);
  });
});

describe("публикация кейса", () => {
  it("создаёт страницу сайта одним действием и ставит дату публикации", async () => {
    const before = new Date().toISOString();
    const response = await publish();
    const { caseStudy } = (await response.json()) as CaseResponse;

    expect(response.status).toBe(201);
    expect(caseStudy.slug).toBe(VALID_CASE.slug);
    expect(caseStudy.status).toBe("published");
    // Дата публикации — фактическое серверное время, а не выбранная в форме и не дата сборки.
    expect(caseStudy.publishedAt).not.toBeNull();
    expect(caseStudy.publishedAt! >= before).toBe(true);
    // У нового кейса «опубликован» и «изменён» совпадают: правок ещё не было.
    expect(caseStudy.modifiedAt).toBe(caseStudy.publishedAt);

    // Ссылка в конце досье и служебная метка — значения модели, а не поля формы.
    expect(caseStudy.ctaLabel).toBe(CASE_DEFAULTS.ctaLabel);
    expect(caseStudy.ctaHref).toBe(CASE_DEFAULTS.ctaHref);
    expect(caseStudy.label).toBe(CASE_DEFAULTS.label);

    // Кейс сразу виден публичному слою — без пересборки и без правки кода.
    const { getCaseBySlug } = await import("@/server/content/cases");
    expect(getCaseBySlug(VALID_CASE.slug)?.title).toBe(VALID_CASE.title);

    // И кэш раздела с картой сайта сброшены — иначе страницы пришлось бы ждать пять минут.
    expect(revalidateCases).toHaveBeenCalledTimes(1);
  });

  it("не даёт занять чужой адрес и чужой номер дела", async () => {
    const takenSlug = await publish({
      ...VALID_CASE,
      slug: "analiz-zvonkov-otdela-prodazh",
      fileNumber: "03",
    });
    expect(takenSlug.status).toBe(409);
    expect((await takenSlug.json()).details).toEqual([
      { path: "slug", message: "Этот адрес уже занят другим кейсом" },
    ]);

    const takenNumber = await publish({ ...VALID_CASE, fileNumber: "01" });
    expect(takenNumber.status).toBe(409);
    expect((await takenNumber.json()).details).toEqual([
      { path: "fileNumber", message: "Такой номер дела уже занят" },
    ]);

    // Ни одна из отвергнутых попыток ничего не записала и не сбросила кэш.
    const { listAllCases } = await import("@/server/repositories/cases");
    expect(listAllCases()).toHaveLength(1);
    expect(revalidateCases).not.toHaveBeenCalled();
  });

  it("не публикует кейс без обязательных разделов и называет каждое поле", async () => {
    const response = await publish({ ...VALID_CASE, task: "", limitations: "", seoTitle: "" });
    const payload = (await response.json()) as { details: { path: string }[] };

    expect(response.status).toBe(422);
    expect(payload.details.map((issue) => issue.path)).toEqual(
      expect.arrayContaining(["task", "limitations", "seoTitle"]),
    );
    expect(revalidateCases).not.toHaveBeenCalled();
  });

  it("не публикует половину измеримого результата", async () => {
    const response = await publish({ ...VALID_CASE, metricSource: "" });
    const payload = (await response.json()) as { details: { path: string }[] };

    expect(response.status).toBe(422);
    expect(payload.details.map((issue) => issue.path)).toContain("metricSource");
  });

  it("сохраняет опасную строку как текст и не выполняет её", async () => {
    const payload = '<script>alert("xss")</script>';
    const response = await publish({ ...VALID_CASE, task: payload });
    const { caseStudy } = (await response.json()) as CaseResponse;

    expect(response.status).toBe(201);
    // Строка доходит до базы неизменной и остаётся ТЕКСТОМ: разметкой она не становится ни здесь,
    // ни в документе — там её отрисовывает React текстовым узлом.
    expect(caseStudy.task).toBe(payload);

    const { getCaseBySlug } = await import("@/server/content/cases");
    const task = getCaseBySlug(VALID_CASE.slug)?.sections.find(
      (section) => section.heading === "Задача",
    );
    expect(task?.blocks).toEqual([{ kind: "text", text: payload }]);
  });
});

describe("правка опубликованного кейса", () => {
  /** Кейс с заведомо старой датой публикации: так видно, что правка её не трогает. */
  async function publishedEarlier() {
    const { createCase } = await import("@/server/repositories/cases");
    const { CASE_DEFAULTS: defaults } = await import("@/features/cases/caseRecord");
    return createCase(
      "case-under-edit",
      {
        ...VALID_CASE,
        ...defaults,
        status: "published",
        ogDescription: VALID_CASE.ogDescription,
      },
      "2026-08-01T08:00:00.000Z",
    );
  }

  it("сохраняет текст, дату публикации и сбрасывает кэш", async () => {
    await publishedEarlier();

    const response = await edit("case-under-edit", {
      ...VALID_CASE,
      shortTitle: "Новое короткое название",
      seoDescription: "Новое описание страницы.",
    });
    const { caseStudy } = (await response.json()) as CaseResponse;

    expect(response.status).toBe(200);
    expect(caseStudy.shortTitle).toBe("Новое короткое название");
    expect(caseStudy.publishedAt).toBe("2026-08-01T08:00:00.000Z");
    expect(caseStudy.modifiedAt).not.toBe(caseStudy.publishedAt);
    expect(caseStudy.modifiedAt! > caseStudy.publishedAt!).toBe(true);
    expect(revalidateCases).toHaveBeenCalledTimes(1);

    const { getCaseBySlug } = await import("@/server/content/cases");
    expect(getCaseBySlug(VALID_CASE.slug)?.shortTitle).toBe("Новое короткое название");
  });

  it("ИГНОРИРУЕТ присланный адрес: у опубликованной страницы он неизменен", async () => {
    await publishedEarlier();

    const response = await edit("case-under-edit", { ...VALID_CASE, slug: "drugoy-adres" });
    const { caseStudy } = (await response.json()) as CaseResponse;

    expect(response.status).toBe(200);
    expect(caseStudy.slug).toBe(VALID_CASE.slug);

    const { getCaseBySlug } = await import("@/server/content/cases");
    expect(getCaseBySlug("drugoy-adres")).toBeUndefined();
    expect(getCaseBySlug(VALID_CASE.slug)).toBeDefined();
  });

  it("отвечает 404 на несуществующий кейс и ничего не создаёт", async () => {
    const response = await edit("случайный-id", VALID_CASE);

    expect(response.status).toBe(404);
    const { listAllCases } = await import("@/server/repositories/cases");
    expect(listAllCases()).toHaveLength(1);
  });
});

describe("удаление кейса", () => {
  it("убирает страницу с сайта и не трогает остальные дела архива", async () => {
    const published = (await (await publish()).json()) as CaseResponse;

    const response = await remove(published.caseStudy.id);
    expect(response.status).toBe(200);

    const { getCaseBySlug, getPublishedCases } = await import("@/server/content/cases");
    expect(getCaseBySlug(VALID_CASE.slug)).toBeUndefined();
    expect(getPublishedCases().map((study) => study.slug)).toEqual([
      "analiz-zvonkov-otdela-prodazh",
    ]);

    // Сброс кэша: один раз при публикации, второй — при удалении.
    expect(revalidateCases).toHaveBeenCalledTimes(2);
    // Повторное удаление — 404, а не молчаливое «ок».
    expect((await remove(published.caseStudy.id)).status).toBe(404);
  });

  it("сохраняет предыдущую версию текста в истории изменений", async () => {
    const published = (await (await publish()).json()) as CaseResponse;
    await remove(published.caseStudy.id);

    const { getDatabase } = await import("@/server/db/client");
    const revision = getDatabase()
      .prepare("SELECT entity_type, entity_id FROM content_revisions WHERE entity_type = 'case'")
      .all();

    expect(revision).toHaveLength(1);
  });
});
