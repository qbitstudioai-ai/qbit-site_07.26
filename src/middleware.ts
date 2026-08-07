import { NextResponse, type NextRequest } from "next/server";
import {
  ATTRIBUTION_COOKIE_MAX_AGE_SECONDS,
  ATTRIBUTION_COOKIE_NAME,
  buildAttribution,
  serializeAttributionCookie,
} from "@/features/attribution/attribution";
import { SESSION_COOKIE_NAME } from "@/server/auth/constants";

/**
 * Два независимых дела на входе в приложение.
 *
 * 1. Первый рубеж защиты `/admin/*`.
 *
 * Middleware исполняется на Edge, где нет ни файловой системы, ни базы, поэтому здесь проверяется
 * только ПОДПИСЬ cookie: запрос без cookie или с подделанным значением разворачивается на `/login`
 * ещё до рендера. Действительность сессии (не истекла ли, не была ли завершена кнопкой «Выйти»)
 * проверяет серверный layout `/admin` — там доступна база. Два рубежа, а не один: middleware
 * дешёвый и отсекает основную массу, layout даёт настоящую гарантию.
 *
 * 2. Запись рекламного источника на публичных страницах (`qbit_attr`).
 *
 * Почему именно здесь, а не в клиентском коде: страницы сайта пререндерятся, и метка должна
 * фиксироваться первым же HTTP-ответом, до исполнения бандла. Заход по объявлению с медленного
 * телефона, закрытый через секунду, иначе теряется. Плюс cookie уезжает на сервер сама, и
 * `/api/contact` берёт источник из запроса, а не из тела формы, — форма остаётся недоверенной.
 *
 * Set-Cookie на закэшированной ISR-странице безопасен, потому что перед приложением стоит
 * проксирующий, а НЕ кэширующий Caddy. Появится кэширующий CDN — это место придётся пересмотреть
 * первым: общий кэш раздал бы один Set-Cookie всем посетителям.
 */

const encoder = new TextEncoder();

function base64UrlEncode(bytes: ArrayBuffer): string {
  let binary = "";
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hasValidSignature(cookieValue: string, secret: string): Promise<boolean> {
  const separator = cookieValue.lastIndexOf(".");
  if (separator <= 0) return false;

  const sessionId = cookieValue.slice(0, separator);
  const signature = cookieValue.slice(separator + 1);

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(sessionId));

  const expected = base64UrlEncode(digest);
  if (expected.length !== signature.length) return false;

  // Сравнение за постоянное время: по разнице во времени ответа подпись подбирается посимвольно.
  let mismatch = 0;
  for (let index = 0; index < expected.length; index += 1) {
    mismatch |= expected.charCodeAt(index) ^ signature.charCodeAt(index);
  }
  return mismatch === 0;
}

/** Методы, меняющие состояние. Для них одной cookie мало — нужен ещё и свой Origin. */
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Проверка происхождения запроса — второй рубеж против CSRF помимо `SameSite=Lax`.
 *
 * Зачем, если cookie и так `Lax`: `Lax` защищает по registrable domain, а не по origin. Любой
 * поддомен, попавший под чужой контроль (staging, брошенная запись DNS), считается same-site и
 * получил бы право выполнять административные операции от лица вошедшего владельца. Плюс часть
 * мутирующих точек входа принимает `multipart/form-data`, который не вызывает CORS-preflight.
 *
 * Сравниваются ХОСТЫ, а не полные origin: за обратным прокси приложение видит `Host: allqbit.ru`,
 * тогда как схема во внутреннем запросе может быть http. Сверка со схемой ломала бы production при
 * штатной конфигурации, а хост подделать из браузера нельзя.
 *
 * Запрос без `Origin` отклоняется: браузер проставляет его на всех мутирующих кросс-origin
 * запросах, поэтому его отсутствие означает не-браузерного клиента, которому в админ-API не место.
 */
function hasOwnOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  const host = request.headers.get("host");
  if (!host) return false;

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/**
 * Публичная страница: обновляем рекламный источник и пропускаем запрос дальше.
 *
 * Семантика — ПОСЛЕДНЕЕ рекламное касание, а не первое: заход с метками перезаписывает cookie,
 * заход без меток не трогает её вообще. Обычная навигация по сайту (`/`, `/blog`, `/contacts`)
 * поэтому не стирает источник, по которому человек пришёл неделю назад, а новое объявление
 * получает свою заявку — иначе первый случайный переход навсегда присваивал бы себе все
 * последующие обращения.
 */
function withAttribution(request: NextRequest): NextResponse {
  const response = NextResponse.next();

  const attribution = buildAttribution(request.nextUrl.searchParams, request.nextUrl.pathname);
  if (!attribution) return response;

  response.cookies.set({
    name: ATTRIBUTION_COOKIE_NAME,
    value: serializeAttributionCookie(attribution),
    httpOnly: true,
    // В разработке сайт открывается по http://localhost, где `Secure` не даёт cookie сохраниться.
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ATTRIBUTION_COOKIE_MAX_AGE_SECONDS,
  });

  /**
   * Ответ с персональной cookie не должен попасть в разделяемый кэш.
   *
   * Страницы отдаются с `s-maxage=300, stale-while-revalidate=…`, то есть приложение само
   * приглашает промежуточный кэш сохранить ответ. Сложить туда ответ вместе с `Set-Cookie` —
   * значит раздать метку одного рекламного перехода всем следующим посетителям и приписать их
   * заявки чужой кампании. Сегодня перед сайтом стоит Caddy без кэша, и до этого не доходит; но
   * заголовок обязан быть верным сам по себе, а не за счёт текущей конфигурации сервера.
   *
   * `no-store` добавлен к `private` намеренно: этот ответ — редкий переход по объявлению, кэшировать
   * его нечего, а любая копия страницы с меткой лишняя. На внутренний кэш Next это не влияет
   * вовсе — он живёт на сервере и заголовками ответа не управляется.
   */
  response.headers.set("Cache-Control", "private, no-store");

  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Административное API: middleware отвечает только за происхождение запроса. Действительность
  // сессии проверяет `requireSession()` внутри самого роута — там доступна база.
  if (pathname.startsWith("/api/admin/")) {
    if (MUTATING_METHODS.has(request.method) && !hasOwnOrigin(request)) {
      return NextResponse.json({ error: "Запрос отклонён: посторонний источник" }, { status: 403 });
    }
    return NextResponse.next();
  }

  // Всё, что не админка, — публичная страница. Рекламные метки собираются только здесь: в закрытой
  // части сайта их взяться неоткуда, а лишняя cookie в административной сессии не нужна.
  if (!pathname.startsWith("/admin")) {
    return withAttribution(request);
  }

  const secret = process.env.SESSION_SECRET;
  const cookieValue = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  const isAuthorized = Boolean(
    secret && cookieValue && (await hasValidSignature(cookieValue, secret)),
  );
  if (isAuthorized) return NextResponse.next();

  const loginUrl = new URL("/login", request.url);
  // Куда вернуть после входа. Только собственный путь: открытый redirect обязан быть невозможен.
  const target = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  if (target.startsWith("/admin")) loginUrl.searchParams.set("next", target);

  return NextResponse.redirect(loginUrl);
}

/**
 * Где middleware исполняется.
 *
 * Первые два правила — закрытая часть, как и раньше. Третье добавлено ради рекламных меток и
 * охватывает ТОЛЬКО публичные HTML-страницы:
 *   • `api/` — вся серверная часть, включая `/api/contact`; там cookie читается, а не пишется;
 *   • `_next/` — бандлы, чанки и оптимизированные изображения;
 *   • `.*\.` — любой путь с точкой: `favicon.ico`, `robots.txt`, `sitemap.xml`, картинки, шрифты.
 *
 * Без этих исключений middleware выполнялся бы на каждом запросе каждой картинки — заметная цена
 * ни за что. Сам путь `/` под правило подпадает: остаток после слэша пуст и ни одному исключению
 * не соответствует.
 */
export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/((?!api/|_next/|.*\\.).*)"],
};
