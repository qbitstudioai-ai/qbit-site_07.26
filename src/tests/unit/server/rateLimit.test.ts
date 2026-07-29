import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Ограничение попыток входа (аудит 2026-07-27, SEC-02).
 *
 * Тесты работают на ОТДЕЛЬНОЙ временной базе: `QBIT_DB_PATH` подменяется до импорта модулей, а
 * `vi.resetModules()` заставляет `src/server/db/client.ts` открыть соединение заново. Пользовательская
 * `var/content.db` не открывается и не изменяется ни одним тестом ниже.
 */

let temporaryDirectory: string;

async function loadRateLimit() {
  return import("@/server/auth/rateLimit");
}

beforeEach(() => {
  temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "qbit-ratelimit-"));
  vi.resetModules();
  vi.stubEnv("QBIT_DB_PATH", path.join(temporaryDirectory, "test.db"));
});

afterEach(() => {
  vi.unstubAllEnvs();

  // Соединение кэшируется в globalThis и переживает resetModules. На Windows незакрытый файл
  // остаётся заблокированным, и удалить временную директорию нельзя.
  const database = (globalThis as { __qbitDatabase?: { close(): void } }).__qbitDatabase;
  database?.close();
  (globalThis as { __qbitDatabase?: unknown }).__qbitDatabase = undefined;

  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
});

describe("clientKeyFromHeaders", () => {
  it("без TRUST_PROXY возвращает null и не верит заголовкам", async () => {
    vi.stubEnv("TRUST_PROXY", "");
    const { clientKeyFromHeaders } = await loadRateLimit();

    const headers = new Headers({ "x-forwarded-for": "1.2.3.4", "x-real-ip": "5.6.7.8" });

    expect(clientKeyFromHeaders(headers)).toBeNull();
  });

  it("с TRUST_PROXY берёт ПОСЛЕДНИЙ элемент цепочки, а не присланный клиентом первый", async () => {
    vi.stubEnv("TRUST_PROXY", "1");
    const { clientKeyFromHeaders } = await loadRateLimit();

    // Клиент подставил свой адрес первым; реальный дописал прокси в конец.
    const headers = new Headers({ "x-forwarded-for": "6.6.6.6, 203.0.113.9" });

    expect(clientKeyFromHeaders(headers)).toBe("203.0.113.9");
  });

  it("с TRUST_PROXY и единственным элементом (перезапись на прокси) берёт его", async () => {
    vi.stubEnv("TRUST_PROXY", "1");
    const { clientKeyFromHeaders } = await loadRateLimit();

    expect(clientKeyFromHeaders(new Headers({ "x-forwarded-for": "203.0.113.10" }))).toBe(
      "203.0.113.10",
    );
  });
});

describe("счётчик неудачных попыток входа", () => {
  it("блокирует адрес после 10 неудачных попыток", async () => {
    const { isLoginBlocked, recordFailedLogin } = await loadRateLimit();

    expect(isLoginBlocked("203.0.113.1")).toBe(false);
    for (let attempt = 0; attempt < 10; attempt += 1) recordFailedLogin("203.0.113.1");

    expect(isLoginBlocked("203.0.113.1")).toBe(true);
  });

  it("блокировка одного адреса не задевает другой", async () => {
    const { isLoginBlocked, recordFailedLogin } = await loadRateLimit();

    for (let attempt = 0; attempt < 10; attempt += 1) recordFailedLogin("203.0.113.2");

    expect(isLoginBlocked("203.0.113.2")).toBe(true);
    expect(isLoginBlocked("203.0.113.3")).toBe(false);
  });

  /**
   * Ключевая гарантия доступности: посторонний НЕ должен закрывать вход владельцу.
   *
   * Ранняя версия исправления применяла общий счётчик и к известному адресу — тогда поток неудачных
   * попыток извне блокировал вход всем, включая владельца, и снять это из интерфейса было нечем.
   */
  it("поток чужих неудачных попыток не блокирует вход с другого адреса", async () => {
    const { isLoginBlocked, recordFailedLogin } = await loadRateLimit();

    for (let attempt = 0; attempt < 500; attempt += 1) {
      recordFailedLogin(`198.51.100.${attempt % 250}`);
    }

    expect(isLoginBlocked("203.0.113.4")).toBe(false);
  });

  it("успешный вход снимает ограничение с адреса", async () => {
    const { clearFailedLogins, isLoginBlocked, recordFailedLogin } = await loadRateLimit();

    for (let attempt = 0; attempt < 10; attempt += 1) recordFailedLogin("203.0.113.5");
    expect(isLoginBlocked("203.0.113.5")).toBe(true);

    clearFailedLogins("203.0.113.5");

    expect(isLoginBlocked("203.0.113.5")).toBe(false);
  });

  it("при неизвестном адресе действует общий порог в 100 попыток", async () => {
    const { isLoginBlocked, recordFailedLogin } = await loadRateLimit();

    for (let attempt = 0; attempt < 99; attempt += 1) recordFailedLogin(null);
    expect(isLoginBlocked(null)).toBe(false);

    recordFailedLogin(null);

    expect(isLoginBlocked(null)).toBe(true);
  });

  it("успешный вход снимает и общее ограничение", async () => {
    const { clearFailedLogins, isLoginBlocked, recordFailedLogin } = await loadRateLimit();

    for (let attempt = 0; attempt < 100; attempt += 1) recordFailedLogin(null);
    expect(isLoginBlocked(null)).toBe(true);

    clearFailedLogins(null);

    expect(isLoginBlocked(null)).toBe(false);
  });
});
