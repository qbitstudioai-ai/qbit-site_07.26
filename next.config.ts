import type { NextConfig } from "next";

/**
 * Переадресация старых адресов `/products/product-01` на текущий slug живёт НЕ здесь, а в самой
 * странице `/products/[[...slug]]`. Причина: список в `redirects()` фиксируется на сборке, а slug
 * продукта редактируется в админ-панели — после первой же правки статический список вёл бы на
 * несуществующую страницу.
 */

/**
 * Заголовки безопасности (добавлены по аудиту 2026-07-27 — до него их не было ни одного).
 *
 * О `Content-Security-Policy` честно и без самообмана. `script-src` содержит `'unsafe-inline'`, и
 * это НЕ защита от внедрения скрипта. Причина техническая: App Router отдаёт полезную нагрузку RSC
 * инлайновыми `<script>self.__next_f.push(...)</script>`, а страницы сайта пререндерятся
 * статически. Строгая политика требует nonce, nonce формируется на запрос, а это переводит все
 * страницы в динамический рендер и убирает мгновенный первый экран — то, ради чего статика и
 * выбрана (CLAUDE.md, «Performance rules»).
 *
 * Поэтому защита от XSS обеспечивается ИСТОЧНИКОМ — экранированием данных (`src/lib/jsonLd.ts`), а
 * не этой политикой. Остальные директивы при этом работают в полную силу и стоят своего места:
 * `object-src 'none'` убирает плагины, `base-uri 'self'` не даёт увести относительные ссылки
 * подменой `<base>`, `form-action 'self'` — отправить форму на чужой хост, `frame-ancestors 'none'`
 * закрывает clickjacking. Переход на nonce вынесен в PRE_RELEASE_CHECKLIST.md как отдельная работа
 * с осознанной ценой.
 *
 * `'unsafe-eval'` не добавлен и не нужен.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const BASE_SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY },
  // Год в секундах. Действует только по HTTPS — на http-запрос браузер заголовок игнорирует.
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Дубль `frame-ancestors` для браузеров, которые её не поддерживают.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

/** Ничего из административной части не должно оседать в кэше браузера или промежуточного прокси. */
const NO_STORE = { key: "Cache-Control", value: "no-store, no-cache, must-revalidate" };

/**
 * Политика для раздачи загруженных файлов — строже базовой и совпадает с той, что ставит сам роут
 * (`src/app/api/files/[...path]/route.ts`). `sandbox` лишает ответ прав на исполнение, поэтому
 * файл, чьё содержимое не совпадает с расширением, не превращается в исполняемую страницу.
 */
const FILES_CSP = { key: "Content-Security-Policy", value: "sandbox; default-src 'none'" };

const nextConfig: NextConfig = {
  // Версия фреймворка в заголовке помогает подбирать эксплойты и не даёт ничего взамен.
  poweredByHeader: false,

  async headers() {
    return [
      { source: "/(.*)", headers: BASE_SECURITY_HEADERS },
      // ВАЖНО, идёт после базовой: заголовки из `headers()` перекрывают одноимённые, выставленные
      // самим роутом. Без этой строки базовая политика вытесняла бы `sandbox` у раздачи файлов —
      // а именно `sandbox` лишает загруженный файл прав на исполнение и делает безопасным
      // отсутствие проверки сигнатуры при загрузке. Проверено запросом к реальному файлу.
      { source: "/api/files/:path*", headers: [FILES_CSP] },
      { source: "/admin/:path*", headers: [NO_STORE] },
      { source: "/api/admin/:path*", headers: [NO_STORE] },
      { source: "/login", headers: [NO_STORE] },
    ];
  },
};

export default nextConfig;
