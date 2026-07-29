import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/server/auth/constants";

/**
 * Первый рубеж защиты `/admin/*`.
 *
 * Middleware исполняется на Edge, где нет ни файловой системы, ни базы, поэтому здесь проверяется
 * только ПОДПИСЬ cookie: запрос без cookie или с подделанным значением разворачивается на `/login`
 * ещё до рендера. Действительность сессии (не истекла ли, не была ли завершена кнопкой «Выйти»)
 * проверяет серверный layout `/admin` — там доступна база. Два рубежа, а не один: middleware
 * дешёвый и отсекает основную массу, layout даёт настоящую гарантию.
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

export async function middleware(request: NextRequest) {
  // Административное API: middleware отвечает только за происхождение запроса. Действительность
  // сессии проверяет `requireSession()` внутри самого роута — там доступна база.
  if (request.nextUrl.pathname.startsWith("/api/admin/")) {
    if (MUTATING_METHODS.has(request.method) && !hasOwnOrigin(request)) {
      return NextResponse.json({ error: "Запрос отклонён: посторонний источник" }, { status: 403 });
    }
    return NextResponse.next();
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

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
