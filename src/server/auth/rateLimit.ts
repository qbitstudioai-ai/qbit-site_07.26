import { getDatabase, nowIso } from "../db/client";
import { trustedClientAddress } from "../net/clientAddress";
import { LOGIN_GLOBAL_RATE_LIMIT, LOGIN_RATE_LIMIT } from "./constants";

/**
 * Ограничение частоты неудачных попыток входа.
 *
 * Счётчик живёт в базе, а не в памяти процесса: перезапуск сервера не должен обнулять защиту, а в
 * нескольких экземплярах приложения счётчик в памяти защищал бы каждый экземпляр по отдельности.
 *
 * Учитываются ТОЛЬКО неудачные попытки — успешный вход обнуляет счётчик, поэтому владелец сайта не
 * блокирует сам себя опечатками.
 *
 * Счётчика два, и применяются они ВЗАИМОИСКЛЮЧАЮЩЕ (см. `isLoginBlocked`):
 *
 *   1. Адресный — когда адресу можно верить (`TRUST_PROXY=1`, см. `clientKeyFromHeaders`).
 *   2. Общий — когда адрес неизвестен и различить клиентов нечем.
 *
 * Почему не один адресный: `X-Forwarded-For` ставит клиент, и при безусловном чтении лимит
 * обходится сменой значения на каждый запрос. Почему не оба сразу: общий счётчик, применённый к
 * известному адресу, позволяет постороннему держать вход владельца закрытым бесконечно.
 *
 * ВАЖНО про режим без доверенного прокси: там действует только общий счётчик, и владельца в
 * принципе нельзя отличить от подбирающего, поэтому блокировка задевает и его. Это одна из причин,
 * по которой reverse proxy и `TRUST_PROXY=1` вынесены в обязательные пункты чеклиста.
 */

/** Ключ общего счётчика. С адресом не пересекается: у адресов нет двоеточий по краям. */
const GLOBAL_KEY = ":all:";

function windowStart(windowMs: number): string {
  return new Date(Date.now() - windowMs).toISOString();
}

function countSince(clientKey: string, windowMs: number): number {
  const row = getDatabase()
    .prepare("SELECT COUNT(*) AS total FROM login_attempts WHERE client_key = ? AND created_at > ?")
    .get(clientKey, windowStart(windowMs)) as { total?: number } | undefined;

  return Number(row?.total ?? 0);
}

/**
 * Действует РОВНО ОДИН рубеж — тот, который применим:
 *
 *   — адрес известен (за доверенным прокси) → только адресный счётчик;
 *   — адрес неизвестен → только общий.
 *
 * Почему общий счётчик НЕ применяется к известному адресу, хотя это защитило бы от подбора с
 * множества адресов: тогда посторонний закрывал бы вход владельцу, просто поддерживая поток
 * неудачных попыток (порог общего счётчика достигается примерно семью запросами в минуту, а
 * заблокированные запросы новых записей не создают, поэтому держать блокировку дёшево и можно
 * бесконечно). Владелец при этом остаётся без единого способа войти и без кнопки разблокировки.
 *
 * Размен сознательный: от распределённого подбора защищает не приложение, а ограничение частоты на
 * обратном прокси (`limit_req` в PRE_RELEASE_CHECKLIST.md §A3). Приложение отвечает за то, чтобы
 * подбор с ОДНОГО адреса был невозможен, и за то, чтобы владелец не терял доступ.
 */
export function isLoginBlocked(clientKey: string | null): boolean {
  if (clientKey === null) {
    return (
      countSince(GLOBAL_KEY, LOGIN_GLOBAL_RATE_LIMIT.windowMs) >=
      LOGIN_GLOBAL_RATE_LIMIT.maxAttempts
    );
  }

  return countSince(clientKey, LOGIN_RATE_LIMIT.windowMs) >= LOGIN_RATE_LIMIT.maxAttempts;
}

export function recordFailedLogin(clientKey: string | null): void {
  const db = getDatabase();
  const at = nowIso();

  // Пишется тот счётчик, который проверяется: лишняя строка ничего не защищает, но растит таблицу.
  db.prepare("INSERT INTO login_attempts (client_key, created_at) VALUES (?, ?)").run(
    clientKey ?? GLOBAL_KEY,
    at,
  );

  // Чистим по самому длинному из окон, иначе более долгий счётчик терял бы свои записи.
  const longestWindow = Math.max(LOGIN_RATE_LIMIT.windowMs, LOGIN_GLOBAL_RATE_LIMIT.windowMs);
  db.prepare("DELETE FROM login_attempts WHERE created_at < ?").run(windowStart(longestWindow));
}

/**
 * Сброс после успешного входа — по тому же ключу, который и считался. Владелец, ошибившийся
 * несколько раз подряд, не должен оставаться под ограничением после верного пароля.
 */
export function clearFailedLogins(clientKey: string | null): void {
  getDatabase()
    .prepare("DELETE FROM login_attempts WHERE client_key = ?")
    .run(clientKey ?? GLOBAL_KEY);
}

/** Адрес клиента для адресного счётчика или `null`, если доверять нечему. */
export function clientKeyFromHeaders(headers: Headers): string | null {
  return trustedClientAddress(headers);
}
