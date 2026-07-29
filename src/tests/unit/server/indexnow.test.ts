import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { submitIndexNowCore } from "@/server/indexnow/core";
import {
  BLOG_URL,
  PRODUCTS_URL,
  articleCreateIndexNowUrls,
  articleUpdateIndexNowUrls,
  productReorderIndexNowUrls,
  productUpdateIndexNowUrls,
} from "@/server/indexnow/urls";

const TEST_KEY = "a".repeat(32);
const silentLogger = { info: vi.fn(), error: vi.fn() };
const noDelay = async () => {};

describe("IndexNow client", () => {
  beforeEach(() => {
    vi.stubEnv("INDEXNOW_KEY", TEST_KEY);
    vi.stubEnv("INDEXNOW_HOST", "allqbit.ru");
    vi.stubEnv("INDEXNOW_ENDPOINT", "https://api.indexnow.org/indexnow");
    silentLogger.info.mockReset();
    silentLogger.error.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("sends the documented JSON payload and removes duplicates", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));

    const result = await submitIndexNowCore(
      ["https://allqbit.ru/blog", "https://allqbit.ru/blog"],
      { fetchImpl, logger: silentLogger, sleep: noDelay },
    );

    expect(result.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [endpoint, init] = fetchImpl.mock.calls[0];
    expect(endpoint).toBe("https://api.indexnow.org/indexnow");
    expect(JSON.parse(init.body)).toEqual({
      host: "allqbit.ru",
      key: TEST_KEY,
      keyLocation: `https://allqbit.ru/${TEST_KEY}.txt`,
      urlList: ["https://allqbit.ru/blog"],
    });
  });

  it("rejects a URL from another host without a request", async () => {
    const fetchImpl = vi.fn();
    const result = await submitIndexNowCore(["https://example.com/blog"], {
      fetchImpl,
      logger: silentLogger,
    });

    expect(result).toMatchObject({ ok: false, reason: "invalid-url" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([200, 202])("treats HTTP %s as success", async (status) => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status }));
    const result = await submitIndexNowCore([BLOG_URL], {
      fetchImpl,
      logger: silentLogger,
      sleep: noDelay,
    });
    expect(result).toMatchObject({ ok: true, status, attempts: 1 });
  });

  it.each([429, 503])("retries temporary HTTP %s", async (status) => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    const result = await submitIndexNowCore([BLOG_URL], {
      fetchImpl,
      logger: silentLogger,
      sleep: noDelay,
    });
    expect(result).toMatchObject({ ok: true, attempts: 2 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it.each([400, 403, 422])("does not retry permanent HTTP %s", async (status) => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status }));
    const result = await submitIndexNowCore([BLOG_URL], {
      fetchImpl,
      logger: silentLogger,
      sleep: noDelay,
    });
    expect(result).toMatchObject({ ok: false, status, attempts: 1 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("never writes the key to logs", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 403 }));
    await submitIndexNowCore([BLOG_URL], { fetchImpl, logger: silentLogger, sleep: noDelay });

    const logs = [...silentLogger.info.mock.calls, ...silentLogger.error.mock.calls]
      .flat()
      .join(" ");
    expect(logs).not.toContain(TEST_KEY);
  });
});

describe("IndexNow URL selection", () => {
  it("sends old and new product URLs when the slug changes", () => {
    expect(
      productUpdateIndexNowUrls(
        { slug: "old", isPublished: true },
        { slug: "new", isPublished: true },
      ),
    ).toEqual(["https://allqbit.ru/products/old", "https://allqbit.ru/products/new", PRODUCTS_URL]);
  });

  it("sends the old product URL when publication is disabled", () => {
    expect(
      productUpdateIndexNowUrls(
        { slug: "visible", isPublished: true },
        { slug: "visible", isPublished: false },
      ),
    ).toEqual(["https://allqbit.ru/products/visible", PRODUCTS_URL]);
  });

  it("sends only the products index when products are reordered", () => {
    expect(productReorderIndexNowUrls()).toEqual([PRODUCTS_URL]);
  });

  it("does not send a draft as a new public article URL", () => {
    expect(articleCreateIndexNowUrls({ slug: "draft", status: "draft" })).toEqual([]);
    expect(
      articleUpdateIndexNowUrls(
        { slug: "draft", status: "draft" },
        { slug: "renamed-draft", status: "draft" },
      ),
    ).toEqual([BLOG_URL]);
  });

  it("sends old and new article URLs when a published slug changes", () => {
    expect(
      articleUpdateIndexNowUrls(
        { slug: "old", status: "published" },
        { slug: "new", status: "published" },
      ),
    ).toEqual(["https://allqbit.ru/blog/old", "https://allqbit.ru/blog/new", BLOG_URL]);
  });

  it("sends the old article URL when publication is disabled", () => {
    expect(
      articleUpdateIndexNowUrls(
        { slug: "visible", status: "published" },
        { slug: "visible", status: "draft" },
      ),
    ).toEqual(["https://allqbit.ru/blog/visible", BLOG_URL]);
  });
});
