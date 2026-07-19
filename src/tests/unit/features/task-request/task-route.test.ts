import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  TASK_MESSAGE_MAX_LENGTH,
  TASK_MESSAGE_MIN_LENGTH,
  isSubmittableTaskMessage,
  taskRequestSchema,
} from "@/features/task-request/validation";

// Step 12.7. Реальная сеть здесь не дёргается ни разу: fetch подменяется, поэтому тесты не зависят
// от Telegram и не отправляют настоящих сообщений. Токен в тестах — заведомо фиктивный.
const VALID_MESSAGE = "Заявки приходят из чатов и почты, часть теряется по дороге.";

describe("валидация заявки «Ваша задача»", () => {
  it("отвергает слишком короткий текст — «привет» заявкой не является", () => {
    expect(isSubmittableTaskMessage("привет")).toBe(false);
    expect(taskRequestSchema.safeParse({ message: "привет" }).success).toBe(false);
  });

  it("не считает пробелы содержанием", () => {
    expect(isSubmittableTaskMessage(" ".repeat(TASK_MESSAGE_MIN_LENGTH + 10))).toBe(false);
  });

  it("принимает осмысленный текст", () => {
    expect(isSubmittableTaskMessage(VALID_MESSAGE)).toBe(true);
    expect(taskRequestSchema.safeParse({ message: VALID_MESSAGE }).success).toBe(true);
  });

  it("отвергает текст длиннее предела — иначе Telegram обрежет сообщение молча", () => {
    const tooLong = "а".repeat(TASK_MESSAGE_MAX_LENGTH + 1);
    expect(isSubmittableTaskMessage(tooLong)).toBe(false);
    expect(taskRequestSchema.safeParse({ message: tooLong }).success).toBe(false);
  });

  // Схема honeypot НЕ отвергает намеренно: иначе роут ответил бы боту «400 неверный запрос» и тем
  // самым подсказал, какое поле не трогать. Решение о тихом отбрасывании принимает роут — см. тест
  // «заполненный honeypot молча отбрасывается» ниже.
  it("пропускает заполненный honeypot через схему, оставляя решение роуту", () => {
    const parsed = taskRequestSchema.safeParse({ message: VALID_MESSAGE, website: "http://spam" });
    expect(parsed.success).toBe(true);
  });
});

describe("POST /api/task", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  async function postTask(body: unknown, headers: Record<string, string> = {}) {
    const { POST } = await import("@/app/api/task/route");
    return POST(
      new Request("http://localhost/api/task", {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify(body),
      }),
    );
  }

  function configureBot() {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "123:FAKE-TEST-TOKEN");
    vi.stubEnv("TELEGRAM_CHAT_ID", "42");
  }

  it("без настроенного бота отвечает 503 и НЕ делает вид, что сообщение ушло", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "");
    vi.stubEnv("TELEGRAM_CHAT_ID", "");

    const response = await postTask({ message: VALID_MESSAGE }, { "x-forwarded-for": "10.0.0.1" });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ ok: false, reason: "not-configured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("доставляет текст в Telegram и отвечает ok", async () => {
    configureBot();
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));

    const response = await postTask({ message: VALID_MESSAGE }, { "x-forwarded-for": "10.0.0.2" });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/sendMessage");
    const sent = JSON.parse((init as RequestInit).body as string);
    expect(sent.chat_id).toBe("42");
    expect(sent.text).toContain(VALID_MESSAGE);
  });

  it("короткий текст отвергается на сервере, даже если клиентская проверка обойдена", async () => {
    configureBot();

    const response = await postTask({ message: "тест" }, { "x-forwarded-for": "10.0.0.3" });

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("заполненный honeypot молча отбрасывается: ok для бота, но ничего не отправлено", async () => {
    configureBot();

    const response = await postTask(
      { message: VALID_MESSAGE, website: "http://spam" },
      { "x-forwarded-for": "10.0.0.4" },
    );

    // Боту отвечаем как при успехе — сообщать, что он распознан, значит помочь обойти проверку.
    expect(response.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("ошибка Telegram превращается в 502, а не в ложный успех", async () => {
    configureBot();
    fetchMock.mockResolvedValue(new Response("{}", { status: 401 }));

    const response = await postTask({ message: VALID_MESSAGE }, { "x-forwarded-for": "10.0.0.5" });

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ ok: false, reason: "delivery-failed" });
  });

  it("подряд идущие запросы с одного адреса упираются в лимит частоты", async () => {
    configureBot();
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));

    const headers = { "x-forwarded-for": "10.0.0.6" };
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 4; attempt += 1) {
      statuses.push((await postTask({ message: VALID_MESSAGE }, headers)).status);
    }

    expect(statuses.slice(0, 3)).toEqual([200, 200, 200]);
    expect(statuses[3]).toBe(429);
  });

  it("не разглашает токен в теле ответа при ошибке доставки", async () => {
    configureBot();
    fetchMock.mockResolvedValue(new Response("Unauthorized: 123:FAKE-TEST-TOKEN", { status: 401 }));

    const response = await postTask({ message: VALID_MESSAGE }, { "x-forwarded-for": "10.0.0.7" });

    expect(await response.text()).not.toContain("FAKE-TEST-TOKEN");
  });
});
