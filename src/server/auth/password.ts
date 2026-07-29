import { scrypt, timingSafeEqual } from "node:crypto";

/**
 * Проверка пароля администратора.
 *
 * Хранится только хеш (`ADMIN_PASSWORD_HASH`), полученный `npm run admin:hash-password`. Формат:
 * `scrypt:N:r:p:<salt base64>:<hash base64>` — параметры лежат в самой строке, поэтому их можно
 * усилить в будущем, не ломая уже выданные хеши.
 *
 * Разделитель — двоеточие, а НЕ канонический для scrypt доллар. Причина практическая: Next.js
 * раскрывает `$переменные` внутри `.env`-файлов, в том числе в кавычках, и `scrypt$16384$8$1$…`
 * молча превращался бы в мусор. Отказ выглядел бы как «неверный логин или пароль» без единой
 * подсказки, что дело в файле окружения. Двоеточие в base64 не встречается, поэтому разбор
 * однозначен.
 *
 * Сравнение — `timingSafeEqual`: обычное `===` завершается на первом несовпавшем байте, и по
 * времени ответа можно побайтно подобрать хеш.
 */

const HASH_SEPARATOR = ":";

interface ParsedHash {
  N: number;
  r: number;
  p: number;
  salt: Buffer;
  hash: Buffer;
}

function parseHash(value: string): ParsedHash | null {
  // Хеши, выданные до перехода на двоеточие, продолжают работать: старый разделитель принимается
  // на чтение, но больше не выдаётся.
  const separator = value.includes(HASH_SEPARATOR) ? HASH_SEPARATOR : "$";
  const parts = value.split(separator);
  if (parts.length !== 6 || parts[0] !== "scrypt") return null;

  const [, rawN, rawR, rawP, salt, hash] = parts;
  const N = Number(rawN);
  const r = Number(rawR);
  const p = Number(rawP);
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return null;

  try {
    return {
      N,
      r,
      p,
      salt: Buffer.from(salt, "base64"),
      hash: Buffer.from(hash, "base64"),
    };
  } catch {
    return null;
  }
}

function derive(password: string, parsed: ParsedHash): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      parsed.salt,
      parsed.hash.length,
      { N: parsed.N, r: parsed.r, p: parsed.p, maxmem: 64 * 1024 * 1024 },
      (error, derivedKey) => (error ? reject(error) : resolve(derivedKey)),
    );
  });
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parsed = parseHash(storedHash);
  if (!parsed) return false;

  try {
    const derived = await derive(password, parsed);
    return derived.length === parsed.hash.length && timingSafeEqual(derived, parsed.hash);
  } catch {
    return false;
  }
}

/** Сравнение логина без утечки длины совпавшего префикса по времени ответа. */
export function safeCompare(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, "utf8");
  const bufferB = Buffer.from(b, "utf8");
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}
