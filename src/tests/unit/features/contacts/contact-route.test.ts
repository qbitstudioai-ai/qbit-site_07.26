import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CONTACT_MIN_FILL_MS } from "@/features/contacts/contactSchema";

/**
 * POST /api/contact. Реальная сеть не дёргается ни разу: fetch подменяется, поэтому тесты не
 * обращаются к настоящему n8n и не отправляют туда персональных данных.
 */

const WEBHOOK_URL = "https://n8n.example.test/webhook/contacts";
const WEBHOOK_SECRET = "test-secret-not-real";

const VALID_BODY = {
  name: "Павел",
  phone: "+7 937 534-65-75",
  telegram: "",
  process: "Менеджеры вручную переносят заявки из Telegram в CRM и теряют часть из них.",
  elapsedMs: CONTACT_MIN_FILL_MS + 5000,
};

describe("POST /api/contact", () => {
  const fetchMock = vi.fn();
  const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    consoleErrorSpy.mockClear();
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  function configureWebhook() {
    vi.stubEnv("N8N_CONTACT_WEBHOOK_URL", WEBHOOK_URL);
    vi.stubEnv("N8N_CONTACT_WEBHOOK_SECRET", WEBHOOK_SECRET);
  }

  async function post(body: unknown, headers: Record<string, string> = {}) {
    const { POST } = await import("@/app/api/contact/route");
    return POST(
      new Request("http://localhost/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body: typeof body === "string" ? body : JSON.stringify(body),
      }),
    );
  }

  const okResponse = () => ({ ok: true, status: 200 });

  const sentPayload = () => JSON.parse(fetchMock.mock.calls[0][1].body as string);

  it("отвергает запрос не в JSON", async () => {
    configureWebhook();
    const response = await post(VALID_BODY, { "content-type": "text/plain" });
    expect(response.status).toBe(415);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("отвергает тело сверх допустимого размера", async () => {
    configureWebhook();
    const response = await post({ ...VALID_BODY, process: "а".repeat(30_000) });
    expect(response.status).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("отвергает неразбираемый JSON", async () => {
    configureWebhook();
    const response = await post("{не json");
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("повторно валидирует данные на сервере: без контакта заявка не проходит", async () => {
    configureWebhook();
    const response = await post({ ...VALID_BODY, phone: "", telegram: "" });
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("отвергает неверный Telegram и неверный телефон", async () => {
    configureWebhook();
    expect((await post({ ...VALID_BODY, phone: "", telegram: "https://t.me/x" })).status).toBe(400);
    expect((await post({ ...VALID_BODY, phone: "12345", telegram: "" })).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("без настроенного webhook отвечает 503 и НЕ делает вид, что заявка ушла", async () => {
    vi.stubEnv("N8N_CONTACT_WEBHOOK_URL", "");
    vi.stubEnv("N8N_CONTACT_WEBHOOK_SECRET", "");

    const response = await post(VALID_BODY);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ ok: false, reason: "not-configured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("не раскрывает значение конфигурации в ответе 503", async () => {
    vi.stubEnv("N8N_CONTACT_WEBHOOK_URL", "");
    const response = await post(VALID_BODY);
    expect(JSON.stringify(await response.json())).not.toContain("webhook/");
  });

  it("заполненный honeypot молча отбрасывается: n8n ничего не получает", async () => {
    configureWebhook();
    const response = await post({ ...VALID_BODY, company: "http://spam" });

    expect(response.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("слишком быстрая отправка отбрасывается так же тихо", async () => {
    configureWebhook();
    const response = await post({ ...VALID_BODY, elapsedMs: 120 });

    expect(response.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("отправляет в n8n payload по контракту и с секретом в заголовке", async () => {
    configureWebhook();
    fetchMock.mockResolvedValue(okResponse());

    const before = Date.now();
    const response = await post({ ...VALID_BODY, name: "  Павел  ", telegram: "Promt_Pavel" });
    expect(response.status).toBe(200);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(WEBHOOK_URL);
    expect(init.method).toBe("POST");
    expect(init.headers["content-type"]).toBe("application/json");
    expect(init.headers["X-QBit-Webhook-Secret"]).toBe(WEBHOOK_SECRET);
    expect(init.signal).toBeInstanceOf(AbortSignal);

    const payload = sentPayload();
    expect(Object.keys(payload).sort()).toEqual([
      "message",
      "name",
      "page",
      "phone",
      "process",
      "source",
      "submissionId",
      "submittedAt",
      "telegram",
    ]);
    expect(payload.submissionId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(payload.source).toBe("qbit-studio-ai-contacts");
    expect(payload.page).toBe("/contacts");
    expect(payload.name).toBe("Павел");
    expect(payload.phone).toBe("+79375346575");
    expect(payload.telegram).toBe("@Promt_Pavel");
    expect(payload.process).toBe(VALID_BODY.process);
    expect(Date.parse(payload.submittedAt)).toBeGreaterThanOrEqual(before);
    expect(payload.submittedAt).toMatch(/Z$/);
  });

  it("кладёт в payload готовый текст для Telegram и не задаёт получателя", async () => {
    configureWebhook();
    fetchMock.mockResolvedValue(okResponse());

    await post({ ...VALID_BODY, telegram: "Promt_Pavel" });

    const payload = sentPayload();
    // Узел Telegram сценария читает именно `body.message`; без этого поля он шлёт заглушку.
    expect(typeof payload.message).toBe("string");
    expect(payload.message).toContain("Павел");
    expect(payload.message).toContain("+79375346575");
    expect(payload.message).toContain("@Promt_Pavel");
    expect(payload.message).toContain(VALID_BODY.process);
    expect(payload.message).toContain(payload.submissionId);
    // Получатель — настройка n8n, а не сайта.
    expect(payload).not.toHaveProperty("chat_id");
  });

  it("не передаёт в n8n honeypot и служебные поля формы", async () => {
    configureWebhook();
    fetchMock.mockResolvedValue(okResponse());

    await post({ ...VALID_BODY, company: "", elapsedMs: 9000 });

    const payload = sentPayload();
    expect(payload).not.toHaveProperty("company");
    expect(payload).not.toHaveProperty("elapsedMs");
    expect(payload).not.toHaveProperty("website");
  });

  it("пустой телефон и пустой Telegram уходят как null", async () => {
    configureWebhook();
    fetchMock.mockResolvedValue(okResponse());

    await post({ ...VALID_BODY, phone: "", telegram: "@Promt_Pavel" });
    expect(sentPayload().phone).toBeNull();

    fetchMock.mockClear();
    await post({ ...VALID_BODY, phone: "+79375346575", telegram: "" });
    expect(sentPayload().telegram).toBeNull();
  });

  it("отдаёт 502 при отказе n8n, не раскрывая его ответ, и не повторяет отправку", async () => {
    configureWebhook();
    fetchMock.mockResolvedValue({ ok: false, status: 500 });

    const response = await post(VALID_BODY);

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ ok: false, reason: "delivery-failed" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("отдаёт 502 при обрыве или таймауте запроса", async () => {
    configureWebhook();
    fetchMock.mockRejectedValue(new DOMException("The operation was aborted.", "TimeoutError"));

    const response = await post(VALID_BODY);

    expect(response.status).toBe(502);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("не пишет персональные данные и секрет в журнал", async () => {
    configureWebhook();
    fetchMock.mockResolvedValue({ ok: false, status: 500 });

    await post(VALID_BODY);

    const logged = JSON.stringify(consoleErrorSpy.mock.calls);
    for (const secretValue of [
      VALID_BODY.name,
      VALID_BODY.phone,
      VALID_BODY.process,
      WEBHOOK_SECRET,
      WEBHOOK_URL,
    ]) {
      expect(logged).not.toContain(secretValue);
    }
  });
});
