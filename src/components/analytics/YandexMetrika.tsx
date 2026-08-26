"use client";

import { usePathname, useSearchParams } from "next/navigation";
import Script from "next/script";
import { Suspense, useEffect } from "react";

/**
 * Номер счётчика Яндекс Метрики.
 *
 * Оставлен константой намеренно. Это публичный идентификатор — он в любом случае уезжает в HTML и
 * виден каждому посетителю, поэтому прятать его в `NEXT_PUBLIC_*` нечего. Плюс переменная вида
 * `NEXT_PUBLIC_*` встраивается на СБОРКЕ, а не в рантайме: её пришлось бы прокидывать в стадию
 * `builder` Dockerfile, иначе в пререндеренном HTML оказался бы `undefined`. Цена — правка
 * Docker/env pipeline ради значения, которое не является секретом и не меняется.
 */
export const YANDEX_METRIKA_ID = 109167375;

const TAG_SRC = `https://mc.yandex.ru/metrika/tag.js?id=${YANDEX_METRIKA_ID}`;
const NOSCRIPT_PIXEL_SRC = `https://mc.yandex.ru/watch/${YANDEX_METRIKA_ID}`;

/**
 * Официальный загрузчик Метрики: создаёт очередь `window.ym` и сам подставляет `tag.js`. Вызова
 * `init` здесь НЕТ — он живёт в эффекте (см. `MetrikaTracker`), чтобы `init` гарантированно шёл
 * перед первым `hit`.
 *
 * Почему очередь создаётся именно этим сниппетом, а не тегом `<Script src>`: в конце `tag.js` стоит
 * `(function(a){var b=I(a,"ym");if(b){ … }})(window)`. Если на момент исполнения библиотеки
 * `window.ym` не существует, счётчик молча не запускается — ни ошибки в консоли, ни визита.
 * Очередь обязана существовать РАНЬШЕ библиотеки, а порядок исполнения двух отдельных тегов
 * `next/script` — деталь реализации фреймворка, на которую опираться нельзя. Сниппет решает это
 * тем, что делает оба дела сам, одним синхронным блоком, в правильном порядке.
 *
 * Цикл по `document.scripts` — из оригинального сниппета: он не даёт вставить `tag.js` второй раз.
 */
const METRIKA_LOADER = `(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};m[i].l=1*new Date();for(var j=0;j<e.scripts.length;j++){if(e.scripts[j].src===r){return;}}k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})(window,document,"script","${TAG_SRC}","ym");`;

/**
 * Параметры счётчика из интерфейса Метрики. `defer` добавлен к ним нами.
 *
 * `defer: true` отключает АВТОМАТИЧЕСКИЙ первый просмотр. Без него Метрика засчитала бы просмотр
 * сама при загрузке `tag.js`, а `MetrikaTracker` отправил бы свой — на один открытый адрес пришлось
 * бы два PageView. При клиентской навигации App Router автоматический просмотр всё равно
 * отправляется только один раз за загрузку документа, поэтому переходы между страницами пришлось бы
 * слать вручную в любом случае; `defer` просто делает источник просмотров ОДНИМ.
 */
interface MetrikaInitParameters {
  ssr: boolean;
  webvisor: boolean;
  clickmap: boolean;
  accurateTrackBounce: boolean;
  trackLinks: boolean;
  defer: boolean;
}

interface MetrikaHitParameters {
  /** Адрес, с которого пришли. Для первого просмотра — внешний, дальше — предыдущая страница сайта. */
  referer?: string;
}

/** Один отложенный вызов счётчика: аргументы `ym(...)`, сохранённые до загрузки `tag.js`. */
type MetrikaQueueEntry = unknown[];

interface MetrikaCounter {
  (counterId: number, event: "init", parameters: MetrikaInitParameters): void;
  (counterId: number, event: "hit", url: string, parameters?: MetrikaHitParameters): void;
  /** Достижение цели, заведённой в интерфейсе Метрики как «JavaScript-событие». */
  (counterId: number, event: "reachGoal", goalName: string): void;
  /**
   * Очередь вызовов, сделанных до загрузки `tag.js`. Читается самой библиотекой: в конце `tag.js`
   * стоит `(function(a){var b=I(a,"ym");if(b){var c=I(b,"a"); … }})(window)` — она забирает
   * накопленное и подменяет `push`, чтобы последующие вызовы исполнялись сразу.
   */
  a?: MetrikaQueueEntry[];
  /** Отметка времени установки счётчика. Её же выставляет официальный сниппет Метрики. */
  l?: number;
}

declare global {
  interface Window {
    ym?: MetrikaCounter;
  }
}

/**
 * Отправляет достижение цели в тот же счётчик, что и просмотры.
 *
 * Вызывается из компонентов-событий (например, формы заявки), поэтому обязан быть безобидным в
 * любой обстановке: на сервере `window` нет вовсе, а в браузере очередь `window.ym` появляется
 * только после того, как отработал загрузчик (`METRIKA_LOADER`) или эффект `MetrikaTracker`. До
 * этого момента и на неотслеживаемых адресах (`/login`, `/admin/*`, где счётчик не монтируется)
 * цель просто не отправляется — молча. Аналитика не должна ронять действие, которое она измеряет.
 *
 * Номер счётчика берётся из `YANDEX_METRIKA_ID`: второй литерал с тем же числом рано или поздно
 * разъехался бы с первым.
 */
export function reachGoal(goalName: string): void {
  if (typeof window === "undefined") return;
  window.ym?.(YANDEX_METRIKA_ID, "reachGoal", goalName);
}

/**
 * Состояние вынесено на уровень модуля, а не в `useRef`, сознательно.
 *
 * `MetrikaTracker` РАЗМОНТИРУЕТСЯ при переходе на `/admin` или `/login` (эти разделы не считаем) и
 * монтируется обратно при возврате на публичную страницу. `useRef` при размонтировании обнуляется —
 * счётчик получил бы второй `init`, а уже отправленный адрес отправился бы повторно. Значения
 * модуля переживают перемонтирование и двойной вызов эффекта в React StrictMode, а счётчик на
 * странице ровно один, поэтому общее на модуль состояние здесь равно состоянию счётчика.
 */
let counterInitialized = false;
/** Последний ОТПРАВЛЕННЫЙ адрес. Служит только защитой от повторной отправки того же просмотра. */
let lastHitUrl: string | null = null;
/** Последний увиденный адрес сайта. Служит только источником `referer` для следующего просмотра. */
let previousUrl: string | null = null;

/**
 * Создаёт очередь `window.ym`, если библиотека ещё не загружена.
 *
 * Повторяет официальный сниппет Метрики, но на TypeScript. Проверено по коду `tag.js`: очередь
 * читается как массив массивов аргументов (`hl` подменяет `push` и разбирает каждый элемент как
 * список аргументов), поэтому обычный массив вместо объекта `arguments` библиотеку устраивает.
 *
 * Если библиотека уже загружена — возвращаем её саму и ничего не перезаписываем.
 */
function ensureCounter(): MetrikaCounter {
  const loaded = window.ym;
  if (loaded) return loaded;

  const queue: MetrikaCounter = function (...args: unknown[]) {
    (queue.a ??= []).push(args);
  } as unknown as MetrikaCounter;

  queue.l = Date.now();
  window.ym = queue;
  return queue;
}

/**
 * Метрика не должна работать в административной части.
 *
 * `/admin/*` — чужие сессии и содержимое базы, `/login` — форма входа. Вебвизор пишет содержимое
 * страницы, и записывать туда админ-панель нельзя. Проверка по адресу, без перестройки маршрутов:
 * `/login` живёт в группе `(public)`, но публичной страницей по смыслу не является.
 */
function isTrackedPath(pathname: string): boolean {
  return pathname !== "/login" && pathname !== "/admin" && !pathname.startsWith("/admin/");
}

/**
 * Параметры, которыми главная хранит состояние офиса (`src/features/office-machine/url-sync.ts`).
 * Из адреса для Метрики они вычищаются: это состояние интерфейса, а не отдельные страницы.
 */
const OFFICE_STATE_PARAMS = ["department", "section"];

/**
 * Адрес, который уходит в Метрику как просмотр.
 *
 * Почему параметры офиса вычищаются — измерено в браузере, а не выведено из общих соображений.
 * Офис синхронизирует состояние СЫРЫМ `window.history.replaceState`, и в Next 16 этот вызов
 * пропатчен фреймворком так, что `useSearchParams()` его ВИДИТ. Без вычистки получалось:
 *
 * - один клик по пункту шапки «Найти потери» давал ДВА просмотра — сначала `/?section=office`,
 *   затем `/`, потому что `useDepartmentUrlSync` сразу убирает параметр;
 * - каждый выбор отдела и каждый возврат в overview добавляли ещё по просмотру, то есть один
 *   визит с осмотром пяти отделов превращался в десяток просмотров.
 *
 * Цена этого — завышенная глубина просмотра и обнулённый показатель отказов ровно на той странице,
 * куда ведёт реклама. Счётчик ставится под Директ, поэтому искажались бы именно те цифры, ради
 * которых он ставится.
 *
 * Вычистка ограничена главной НАМЕРЕННО. Эти параметры читает только `src/app/page.tsx`, и снимать
 * их со всех адресов подряд значило бы поставить тихую ловушку: страница, которая когда-нибудь
 * заведёт собственный `?section=`, молча склеила бы свои просмотры в один. Параметры остальных
 * разделов (например, фильтры блога) не трогаются нигде.
 */
function buildTrackedUrl(pathname: string, search: string): string {
  const params = new URLSearchParams(search);
  if (pathname === "/") {
    for (const key of OFFICE_STATE_PARAMS) params.delete(key);
  }
  const query = params.toString();
  return `${window.location.origin}${pathname}${query ? `?${query}` : ""}`;
}

function MetrikaTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.toString();

  useEffect(() => {
    const ym = ensureCounter();

    if (!counterInitialized) {
      ym(YANDEX_METRIKA_ID, "init", {
        ssr: true,
        webvisor: true,
        clickmap: true,
        accurateTrackBounce: true,
        trackLinks: true,
        defer: true,
      });
      counterInitialized = true;
    }

    const url = buildTrackedUrl(pathname, search);
    // Тот же адрес не отправляется дважды: это гасит и повтор эффекта в StrictMode, и
    // перемонтирование компонента, и любую лишнюю перерисовку родителя, и — вместе с
    // `buildTrackedUrl` — переключение отделов в офисе.
    if (url === lastHitUrl) return;

    // Первый просмотр за загрузку документа: источником должен остаться ВНЕШНИЙ переход — переход
    // из рекламы, поиска или с чужого сайта. Дальше источник — предыдущая страница сайта, иначе
    // каждый внутренний переход выглядел бы как ещё один вход из рекламы.
    const referer = previousUrl ?? (document.referrer || undefined);

    ym(YANDEX_METRIKA_ID, "hit", url, referer ? { referer } : undefined);
    lastHitUrl = url;
    previousUrl = url;
  }, [pathname, search]);

  return (
    <Script
      id="yandex-metrika-loader"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{ __html: METRIKA_LOADER }}
    />
  );
}

/**
 * Счётчик Яндекс Метрики.
 *
 * Подключается один раз из корневого `src/app/layout.tsx`. Сам layout остаётся серверным
 * компонентом — клиентская граница проходит здесь.
 *
 * Про `<Suspense>`: `useSearchParams()` без него переводит ВСЮ страницу в клиентский рендер, а
 * `/cases`, `/contacts`, `/faq`, `/how-we-work` и `/products/*` пререндерятся статически — это
 * ровно то, ради чего они статические (CLAUDE.md, «Performance rules»). Граница ограничивает
 * ожидание строки запроса одним этим компонентом.
 *
 * Поэтому же `<noscript>` стоит СНАРУЖИ границы: внутри неё на статической странице сервер
 * отрисовал бы заглушку, и картинка-счётчик появлялась бы только скриптом — то есть никогда не
 * появлялась бы у посетителя без JavaScript, для которого она и нужна.
 */
export function YandexMetrika() {
  const pathname = usePathname();
  const tracked = isTrackedPath(pathname);

  /**
   * Уход в административную часть снимает защиту от повтора, но НЕ трогает цепочку источников.
   *
   * Иначе путь «страница → `/login` → та же страница» терял бы просмотр: адрес совпал бы с
   * последним отправленным, и возврат не засчитался бы. Разделение на два значения нужно именно
   * здесь: обнули мы заодно и `previousUrl`, источником возврата стал бы `document.referrer` —
   * внешний адрес, с которого когда-то открыли документ, и внутренний переход выглядел бы как
   * ещё один вход из рекламы.
   */
  useEffect(() => {
    if (!tracked) lastHitUrl = null;
  }, [tracked]);

  if (!tracked) return null;

  return (
    <>
      <Suspense fallback={null}>
        <MetrikaTracker />
      </Suspense>
      <noscript>
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element -- Счётчик-пиксель на чужом хосте:
              оптимизировать через next/image нечего, а сам next/image требует JavaScript, которого
              в <noscript> по определению нет. */}
          <img src={NOSCRIPT_PIXEL_SRC} style={{ position: "absolute", left: "-9999px" }} alt="" />
        </div>
      </noscript>
    </>
  );
}
