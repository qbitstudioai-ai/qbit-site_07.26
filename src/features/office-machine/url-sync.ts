import { useEffect, useRef, type Dispatch } from "react";
import {
  TASK_SECTION_ID,
  type OfficeHistoryLayer,
  type OfficeMachineAction,
  type OfficeMachineState,
  type OfficeSectionId,
} from "./reducer";

// Сырой history.pushState/replaceState (решение OQ-B, DECISIONS.md 2026-07-15) — без
// next/navigation useRouter/useSearchParams, чтобы не инициировать повторный рендер серверного
// дерева (page.tsx/HomepageShell) при каждой смене отдела.
//
// Step 12.7: разделов стало шесть, и адресуются они РАЗНЫМИ параметрами — `?department=<id>` для
// пяти отделов, `?section=task` для «Вашей задачи». Складывать «задачу» в `?department=` было бы
// неправдой: это не отдел. Взамен лишний параметр всегда вычищается — иначе в URL останутся оба.
//
// DEPT-SEO.2D (DECISIONS.md 2026-09-17, пересмотр OQ-B после production-проверки). Прежняя модель
// «только replaceState» оставляла в истории одну запись на весь визит главной, и браузерный «назад»
// из офиса уводил посетителя с сайта. Модель теперь — не больше ДВУХ логических записей:
//
//   внешняя страница → HERO → OFFICE
//
// - HERO → OFFICE — единственный pushState;
// - выбор, переключение и закрытие раздела внутри OFFICE — replaceState текущей OFFICE-записи;
// - OFFICE → HERO изнутри: если OFFICE-запись создана переходом из HERO, это history.back() на
//   существующую HERO-запись (без двух одинаковых HERO подряд); если посетитель пришёл прямой
//   ссылкой, предыдущей HERO-записи нет, и текущая запись приводится к HERO через replaceState —
//   back() увёл бы его на чужой сайт;
// - popstate восстанавливает машину одним действием RESTORE_FROM_HISTORY и НЕ пишет в историю.
//
// HERO и OFFICE-overview имеют один адрес `/`, поэтому логический слой хранится в history.state
// под собственным ключом. Остальные поля history.state сохраняются: запись строится как
// `{ ...history.state, [KEY]: entry }` — кроме двух внутренних полей Next.js, см.
// `withOfficeHistoryEntry`.

export const OFFICE_HISTORY_STATE_KEY = "__allqbitOfficeHistory";

export interface OfficeHistoryEntry {
  layer: OfficeHistoryLayer;
  /** OFFICE-запись создана pushState из HERO-записи этого же визита (перед ней лежит HERO). */
  pushedFromHero: boolean;
}

export function readOfficeHistoryEntry(historyState: unknown): OfficeHistoryEntry | null {
  if (typeof historyState !== "object" || historyState === null) return null;
  const raw = (historyState as Record<string, unknown>)[OFFICE_HISTORY_STATE_KEY];
  if (typeof raw !== "object" || raw === null) return null;
  const { layer, pushedFromHero } = raw as Record<string, unknown>;
  if (layer !== "hero" && layer !== "office") return null;
  return { layer, pushedFromHero: layer === "office" && pushedFromHero === true };
}

/**
 * Next.js (App Router) перехватывает `pushState`/`replaceState`: если в переданном объекте нет
 * `__NA`, он сам копирует `__NA` и `__PRIVATE_NEXTJS_INTERNALS_TREE` из текущей записи и обновляет
 * свой адрес страницы (`useSearchParams`); если `__NA` есть — считает вызов своим и адрес не
 * обновляет. Поэтому, когда перехват уже установлен, эти два поля в объект не кладутся: Next вернёт
 * их сам, а его представление об адресе останется верным — как при прежнем `replaceState(null, …)`.
 *
 * Перехват ставится в эффекте корневого компонента Next, а эффекты выполняются от дочерних к
 * родительским: первая синхронизация офиса при монтировании идёт ДО него. Выбросить поля в этот
 * момент значило бы потерять `__NA` — и Next перезагрузил бы страницу на следующем «назад». Поэтому
 * без перехвата сохраняется всё. Все прочие поля сохраняются всегда.
 */
const NEXT_INTERNAL_HISTORY_KEYS = ["__NA", "__PRIVATE_NEXTJS_INTERNALS_TREE"];

function nextJsHistoryPatchInstalled(): boolean {
  return Object.prototype.hasOwnProperty.call(window.history, "pushState");
}

export function withOfficeHistoryEntry(
  historyState: unknown,
  entry: OfficeHistoryEntry,
  leaveNextInternalsToRouter = false,
): Record<string, unknown> {
  const base: Record<string, unknown> =
    typeof historyState === "object" && historyState !== null
      ? { ...(historyState as Record<string, unknown>) }
      : {};
  if (leaveNextInternalsToRouter) {
    for (const key of NEXT_INTERNAL_HISTORY_KEYS) delete base[key];
  }
  return { ...base, [OFFICE_HISTORY_STATE_KEY]: entry };
}

/** Адрес раздела поверх текущего: чужие параметры и hash сохраняются. */
export function buildOfficeRelativeUrl(
  currentHref: string,
  sectionId: OfficeSectionId | null,
): string {
  const url = new URL(currentHref);
  if (sectionId === TASK_SECTION_ID) {
    url.searchParams.set("section", TASK_SECTION_ID);
    url.searchParams.delete("department");
  } else if (sectionId) {
    url.searchParams.set("department", sectionId);
    url.searchParams.delete("section");
  } else {
    url.searchParams.delete("department");
    url.searchParams.delete("section");
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

/** Раздел из адреса текущей записи; неизвестное значение — «раздел не выбран», как в `page.tsx`. */
function readSectionFromLocation(sectionIds: readonly OfficeSectionId[]): OfficeSectionId | null {
  const params = new URLSearchParams(window.location.search);
  const raw =
    params.get("section") === TASK_SECTION_ID ? TASK_SECTION_ID : params.get("department");
  return sectionIds.find((id) => id === raw) ?? null;
}

function currentRelativeUrl(): string {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

/**
 * Офис уже монтировался в этом документе. Первое монтирование после свежей навигации (`navigate`)
 * props не проверяет разметкой записи: Chrome при переходе на тот же адрес (Enter в адресной
 * строке, ссылка на `/`) заменяет запись, но оставляет её `history.state`, и старая OFFICE-разметка
 * вернула бы офис вместо запрошенного HERO. Для `reload`, `back_forward` и повторных монтирований
 * внутри документа (клиентские переходы Next.js) разметка записи — источник правды.
 */
let officeMountedInDocument = false;

function isFreshDocumentNavigation(): boolean {
  const [entry] = performance.getEntriesByType?.("navigation") ?? [];
  return (entry as PerformanceNavigationTiming | undefined)?.type === "navigate";
}

interface OfficeHistoryRefs {
  /** Состояние машины на последнем коммите — popstate-обработчик живёт дольше одного рендера. */
  desired: { layer: OfficeHistoryLayer; sectionId: OfficeSectionId | null };
  /** Известные разделы — для проверки значения из адреса. */
  sectionIds: readonly OfficeSectionId[];
  /** Слой, который представляет ТЕКУЩАЯ запись истории. null — запись ещё не нормализована. */
  entryLayer: OfficeHistoryLayer | null;
  /** Выставлен history.back() из internal return-to-home; следующий popstate — его результат. */
  awaitingOwnBack: boolean;
  /** Значения, с которыми эффект синхронизации уже отработал (StrictMode повторяет эффекты). */
  lastSynced: { layer: OfficeHistoryLayer; sectionId: OfficeSectionId | null } | null;
}

function syncOfficeHistory(refs: OfficeHistoryRefs, dispatch: Dispatch<OfficeMachineAction>) {
  const { desired } = refs;
  const nextUrl = buildOfficeRelativeUrl(window.location.href, desired.sectionId);
  const existing = readOfficeHistoryEntry(window.history.state);

  // Монтирование на записи, которую уже размечал этот модуль, — и разметка расходится с props.
  // Так бывает, когда Next.js возвращает посетителя на главную «назад» с другой страницы сайта: он
  // восстанавливает дерево, закэшированное на момент pushState/replaceState, — то есть props того
  // адреса, с которого запись была создана (обычно HERO `/`), а не адреса самой записи. Верить
  // props здесь нельзя: нормализация перезаписала бы OFFICE-запись в HERO, и в истории оказались бы
  // две HERO подряд. Источник правды — разметка записи и её адрес. То же покрывает reload
  // OFFICE-overview: у него адрес `/`, и сервер отдаёт HERO, и «назад» на OFFICE-запись с чужого
  // сайта, когда документ не сохранился в bfcache.
  const trustEntry =
    refs.entryLayer === null && (officeMountedInDocument || !isFreshDocumentNavigation());
  officeMountedInDocument = true;
  if (trustEntry && existing) {
    const entrySectionId =
      existing.layer === "office" ? readSectionFromLocation(refs.sectionIds) : null;
    if (existing.layer !== desired.layer || entrySectionId !== desired.sectionId) {
      refs.entryLayer = existing.layer;
      refs.desired = { layer: existing.layer, sectionId: entrySectionId };
      dispatch({ type: "RESTORE_FROM_HISTORY", ...refs.desired });
      return;
    }
  }

  // Первое монтирование (reload, прямая ссылка, запись без разметки): новых записей не создаём,
  // только помечаем текущую. pushedFromHero переживает reload — перед записью по-прежнему лежит HERO.
  if (refs.entryLayer === null) {
    const entry: OfficeHistoryEntry = {
      layer: desired.layer,
      pushedFromHero:
        desired.layer === "office" && existing?.layer === "office" && existing.pushedFromHero,
    };
    window.history.replaceState(
      withOfficeHistoryEntry(window.history.state, entry, nextJsHistoryPatchInstalled()),
      "",
      nextUrl,
    );
    refs.entryLayer = desired.layer;
    return;
  }

  if (refs.entryLayer === "hero" && desired.layer === "office") {
    const entry: OfficeHistoryEntry = { layer: "office", pushedFromHero: true };
    window.history.pushState(
      withOfficeHistoryEntry(window.history.state, entry, nextJsHistoryPatchInstalled()),
      "",
      nextUrl,
    );
    refs.entryLayer = "office";
    return;
  }

  if (refs.entryLayer === "office" && desired.layer === "hero" && existing?.pushedFromHero) {
    // UI уже в HERO; адрес и запись догонят через popstate. Слой записи считается HERO сразу,
    // чтобы повторный sync до прихода popstate не сделал второй back().
    refs.awaitingOwnBack = true;
    refs.entryLayer = "hero";
    window.history.back();
    return;
  }

  // Внутри слоя (или OFFICE → HERO без HERO-записи перед ним) — только замена текущей записи.
  const entry: OfficeHistoryEntry = {
    layer: desired.layer,
    pushedFromHero: desired.layer === "office" && existing?.pushedFromHero === true,
  };
  const entryChanged =
    existing?.layer !== entry.layer || existing.pushedFromHero !== entry.pushedFromHero;
  if (nextUrl !== currentRelativeUrl() || entryChanged) {
    window.history.replaceState(
      withOfficeHistoryEntry(window.history.state, entry, nextJsHistoryPatchInstalled()),
      "",
      nextUrl,
    );
  }
  refs.entryLayer = desired.layer;
}

export function useOfficeBrowserHistory(
  state: OfficeMachineState,
  dispatch: Dispatch<OfficeMachineAction>,
  sectionIds: readonly OfficeSectionId[],
) {
  const layer: OfficeHistoryLayer = state.view === "hero" ? "hero" : "office";
  const sectionId = state.activeSectionId;
  const refs = useRef<OfficeHistoryRefs>({
    desired: { layer, sectionId },
    sectionIds,
    entryLayer: null,
    awaitingOwnBack: false,
    lastSynced: null,
  });

  useEffect(() => {
    refs.current.sectionIds = sectionIds;
  }, [sectionIds]);

  useEffect(() => {
    const current = refs.current;
    // Повторный запуск с теми же значениями (StrictMode в dev) ничего не пишет: после восстановления
    // по разметке записи он иначе увидел бы старые props и вызвал бы back() с только что
    // восстановленной OFFICE-записи.
    if (current.lastSynced?.layer === layer && current.lastSynced.sectionId === sectionId) return;
    current.lastSynced = { layer, sectionId };
    current.desired = { layer, sectionId };
    syncOfficeHistory(current, dispatch);
  }, [layer, sectionId, dispatch]);

  useEffect(() => {
    const current = refs.current;

    function handlePopState(event: PopStateEvent) {
      const entry = readOfficeHistoryEntry(event.state);
      const ownBack = current.awaitingOwnBack;
      current.awaitingOwnBack = false;
      // Запись не наша (hash-переход и т. п.) — состояние офиса не трогаем.
      if (!entry) return;

      // Подавление записи в историю: слой текущей записи и желаемое состояние выставляются ДО
      // dispatch, поэтому эффект синхронизации увидит «запись уже такая» и не вызовет
      // pushState/back(); replaceState возможен только если адрес разошёлся с записью.
      current.entryLayer = entry.layer;

      if (ownBack) {
        // Результат нашего же back(): UI уже в HERO. Если посетитель успел снова войти в офис до
        // прихода popstate — догоняем историю обычным sync (это будет pushState из HERO).
        if (current.desired.layer !== entry.layer) syncOfficeHistory(current, dispatch);
        return;
      }

      current.desired = {
        layer: entry.layer,
        sectionId: entry.layer === "office" ? readSectionFromLocation(current.sectionIds) : null,
      };
      dispatch({ type: "RESTORE_FROM_HISTORY", ...current.desired });
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [dispatch]);
}
