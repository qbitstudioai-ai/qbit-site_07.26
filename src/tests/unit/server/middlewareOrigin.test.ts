import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { middleware } from "@/middleware";

/**
 * Проверка происхождения запроса к административному API (аудит 2026-07-27, SEC-06).
 *
 * До правки CSRF-защита держалась исключительно на `SameSite=Lax`, а `SameSite` действует по
 * registrable domain: любой поддомен под чужим контролем считался бы same-site и мог выполнять
 * административные операции от лица вошедшего владельца.
 */

function adminRequest(method: string, headers: Record<string, string>) {
  return new NextRequest(new URL("http://allqbit.ru/api/admin/articles"), {
    method,
    headers: new Headers({ host: "allqbit.ru", ...headers }),
  });
}

beforeEach(() => {
  vi.stubEnv("SESSION_SECRET", "test-secret-not-a-real-value");
});

describe("middleware: происхождение запроса к /api/admin/*", () => {
  it.each(["POST", "PUT", "PATCH", "DELETE"])("%s без Origin отклоняется", async (method) => {
    const response = await middleware(adminRequest(method, {}));

    expect(response.status).toBe(403);
  });

  it.each(["POST", "PUT", "PATCH", "DELETE"])("%s с чужим Origin отклоняется", async (method) => {
    const response = await middleware(adminRequest(method, { origin: "https://evil.example" }));

    expect(response.status).toBe(403);
  });

  it("POST со своим Origin пропускается дальше — решение принимает роут", async () => {
    const response = await middleware(adminRequest("POST", { origin: "https://allqbit.ru" }));

    expect(response.status).toBe(200);
  });

  it("схема Origin не влияет: за прокси приложение видит http, снаружи https", async () => {
    const response = await middleware(adminRequest("POST", { origin: "http://allqbit.ru" }));

    expect(response.status).toBe(200);
  });

  it("Origin с тем же хостом, но другим портом отклоняется", async () => {
    const response = await middleware(adminRequest("POST", { origin: "https://allqbit.ru:8443" }));

    expect(response.status).toBe(403);
  });

  it("нечитаемый Origin отклоняется, а не роняет middleware", async () => {
    const response = await middleware(adminRequest("POST", { origin: "http://[not-a-url" }));

    expect(response.status).toBe(403);
  });

  it("GET не требует Origin: чтение состояние не меняет", async () => {
    const response = await middleware(adminRequest("GET", {}));

    expect(response.status).toBe(200);
  });
});
