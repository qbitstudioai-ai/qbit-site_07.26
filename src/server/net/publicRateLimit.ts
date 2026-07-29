import { trustedClientAddress } from "./clientAddress";

/**
 * Ограничение частоты для публичных форм (`/api/task`, `/api/contact`).
 *
 * Счётчик в памяти процесса и сознательно НЕ выдаётся за полноценную защиту: при нескольких
 * экземплярах приложения у каждого будет свой счётчик, а перезапуск его обнуляет. Задача — отсечь
 * примитивный флуд, а не выдержать целенаправленную атаку. Настоящий лимит ставится на обратном
 * прокси (см. PRE_RELEASE_CHECKLIST.md).
 *
 * Два режима, и различие принципиальное:
 *
 *   — адрес известен (за доверенным прокси) — счёт по адресу, порог низкий;
 *   — адрес неизвестен — общее ведро с заметно большим порогом. Низкий порог в общем ведре
 *     означал бы, что любой посторонний закрывает форму для всех посетителей.
 *
 * Раньше здесь безусловно читался `X-Forwarded-For`, и лимит обходился сменой значения на каждый
 * запрос (аудит 2026-07-27).
 */

const SHARED_BUCKET = ":untrusted:";

export interface RateLimitRule {
  windowMs: number;
  /** Порог, когда адрес клиента известен. */
  maxPerAddress: number;
  /** Порог общего ведра, когда адрес неизвестен. */
  maxShared: number;
}

interface Bucket {
  hits: number[];
}

export function createRateLimiter(rule: RateLimitRule) {
  const buckets = new Map<string, Bucket>();

  return function isRateLimited(headers: Headers): boolean {
    const address = trustedClientAddress(headers);
    const key = address ?? SHARED_BUCKET;
    const limit = address === null ? rule.maxShared : rule.maxPerAddress;

    const now = Date.now();
    const bucket = buckets.get(key) ?? { hits: [] };
    bucket.hits = bucket.hits.filter((at) => now - at < rule.windowMs);

    if (bucket.hits.length >= limit) {
      buckets.set(key, bucket);
      return true;
    }

    bucket.hits.push(now);
    buckets.set(key, bucket);

    // Карта не должна расти бесконечно на долгоживущем процессе.
    if (buckets.size > 1000) {
      for (const [existingKey, existing] of buckets) {
        if (existing.hits.every((at) => now - at >= rule.windowMs)) buckets.delete(existingKey);
      }
    }

    return false;
  };
}
