import { act, renderHook, waitFor } from "@testing-library/react";
import { useReducer } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  initOfficeMachineState,
  officeMachineReducer,
  type OfficeMachineInit,
  type OfficeSectionId,
} from "@/features/office-machine/reducer";
import {
  OFFICE_HISTORY_STATE_KEY,
  buildOfficeRelativeUrl,
  readOfficeHistoryEntry,
  useOfficeBrowserHistory,
  withOfficeHistoryEntry,
} from "@/features/office-machine/url-sync";

// DEPT-SEO.2D: модель истории главной — не больше двух логических записей HERO → OFFICE.

const SECTION_IDS: readonly OfficeSectionId[] = [
  "sales",
  "support",
  "executive",
  "hr",
  "logistics",
  "task",
];

function renderMachine(init: OfficeMachineInit) {
  return renderHook(() => {
    const [state, dispatch] = useReducer(officeMachineReducer, init, initOfficeMachineState);
    useOfficeBrowserHistory(state, dispatch, SECTION_IDS);
    return { state, dispatch };
  });
}

function officeEntry() {
  return readOfficeHistoryEntry(window.history.state);
}

describe("office history helpers", () => {
  it("keeps foreign history.state fields when adding the office entry", () => {
    const current = { __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: { tree: [] }, custom: 1 };
    const entry = { layer: "office", pushedFromHero: true } as const;
    // До установки перехвата Next.js (первая синхронизация при монтировании) сохраняется всё.
    expect(withOfficeHistoryEntry(current, entry)).toEqual({
      ...current,
      [OFFICE_HISTORY_STATE_KEY]: entry,
    });
    // С перехватом внутренние поля Next копирует сам — и только тогда обновляет адрес роутера.
    expect(withOfficeHistoryEntry(current, entry, true)).toEqual({
      custom: 1,
      [OFFICE_HISTORY_STATE_KEY]: entry,
    });
    expect(current.__NA).toBe(true);
    expect(withOfficeHistoryEntry(null, { layer: "hero", pushedFromHero: false })).toEqual({
      [OFFICE_HISTORY_STATE_KEY]: { layer: "hero", pushedFromHero: false },
    });
  });

  it("reads only well-formed entries", () => {
    expect(readOfficeHistoryEntry(null)).toBeNull();
    expect(readOfficeHistoryEntry({ __NA: true })).toBeNull();
    expect(readOfficeHistoryEntry({ [OFFICE_HISTORY_STATE_KEY]: { layer: "x" } })).toBeNull();
    expect(
      readOfficeHistoryEntry({
        [OFFICE_HISTORY_STATE_KEY]: { layer: "hero", pushedFromHero: true },
      }),
    ).toEqual({ layer: "hero", pushedFromHero: false });
  });

  it("writes department/section params and keeps foreign params and hash", () => {
    const href = "https://allqbit.ru/?utm_source=x&section=office#top";
    expect(buildOfficeRelativeUrl(href, "sales")).toBe("/?utm_source=x&department=sales#top");
    expect(buildOfficeRelativeUrl(href, "task")).toBe("/?utm_source=x&section=task#top");
    expect(buildOfficeRelativeUrl("https://allqbit.ru/?department=hr&a=1", null)).toBe("/?a=1");
  });
});

describe("useOfficeBrowserHistory", () => {
  beforeEach(() => {
    window.history.replaceState({ foreign: "keep" }, "", "/");
  });

  afterEach(() => {
    window.history.replaceState(null, "", "/");
    vi.restoreAllMocks();
  });

  it("normalizes the initial HERO entry without adding history and keeps foreign state", () => {
    const push = vi.spyOn(window.history, "pushState");
    renderMachine({ initialRevealed: false, initialSectionId: null });
    expect(push).not.toHaveBeenCalled();
    expect(window.history.state.foreign).toBe("keep");
    expect(officeEntry()).toEqual({ layer: "hero", pushedFromHero: false });
  });

  it("HERO → OFFICE is the only pushState; switching sections replaces the OFFICE entry", () => {
    const push = vi.spyOn(window.history, "pushState");
    const replace = vi.spyOn(window.history, "replaceState");
    const { result } = renderMachine({ initialRevealed: false, initialSectionId: null });

    act(() => result.current.dispatch({ type: "ACTIVATE_CTA" }));
    expect(push).toHaveBeenCalledTimes(1);
    expect(officeEntry()).toEqual({ layer: "office", pushedFromHero: true });
    expect(window.history.state.foreign).toBe("keep");

    replace.mockClear();
    act(() => result.current.dispatch({ type: "SELECT_DEPARTMENT", departmentId: "sales" }));
    expect(window.location.search).toBe("?department=sales");
    act(() => result.current.dispatch({ type: "SWITCH_DEPARTMENT", departmentId: "task" }));
    expect(window.location.search).toBe("?section=task");
    expect(push).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledTimes(2);
    expect(officeEntry()).toEqual({ layer: "office", pushedFromHero: true });
  });

  it("does not write history when the section does not change", () => {
    const { result, rerender } = renderMachine({
      initialRevealed: false,
      initialSectionId: "sales",
    });
    const replace = vi.spyOn(window.history, "replaceState");
    const push = vi.spyOn(window.history, "pushState");
    rerender();
    act(() => result.current.dispatch({ type: "SWITCH_DEPARTMENT", departmentId: "sales" }));
    expect(replace).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("popstate restores the machine atomically and writes no history (no feedback loop)", () => {
    const { result } = renderMachine({ initialRevealed: false, initialSectionId: null });
    act(() => result.current.dispatch({ type: "ACTIVATE_CTA" }));
    act(() => result.current.dispatch({ type: "SELECT_DEPARTMENT", departmentId: "hr" }));

    const push = vi.spyOn(window.history, "pushState");
    const replace = vi.spyOn(window.history, "replaceState");
    const back = vi.spyOn(window.history, "back");

    // Имитация браузерного «назад» на HERO-запись.
    act(() => {
      window.history.replaceState(
        withOfficeHistoryEntry(null, { layer: "hero", pushedFromHero: false }),
        "",
        "/",
      );
      replace.mockClear();
      window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
    });
    expect(result.current.state).toEqual({ view: "hero", activeSectionId: null });

    // И «вперёд» на OFFICE-запись с HR.
    act(() => {
      window.history.replaceState(
        withOfficeHistoryEntry(null, { layer: "office", pushedFromHero: true }),
        "",
        "/?department=hr",
      );
      replace.mockClear();
      window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
    });
    expect(result.current.state).toEqual({ view: "department-active", activeSectionId: "hr" });

    expect(push).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    expect(back).not.toHaveBeenCalled();
  });

  it("ignores popstate entries that are not ours", () => {
    const { result } = renderMachine({ initialRevealed: false, initialSectionId: "sales" });
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate", { state: { __NA: true } }));
    });
    expect(result.current.state).toEqual({ view: "department-active", activeSectionId: "sales" });
  });

  it("internal return-to-home from a session-created OFFICE entry goes back to the HERO entry", async () => {
    const { result } = renderMachine({ initialRevealed: false, initialSectionId: null });
    act(() => result.current.dispatch({ type: "ACTIVATE_CTA" }));
    act(() => result.current.dispatch({ type: "SELECT_DEPARTMENT", departmentId: "sales" }));

    const back = vi.spyOn(window.history, "back");
    const push = vi.spyOn(window.history, "pushState");
    act(() => result.current.dispatch({ type: "RETURN_TO_HERO" }));
    expect(back).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();
    await waitFor(() => expect(window.location.search).toBe(""));
    expect(officeEntry()).toEqual({ layer: "hero", pushedFromHero: false });
    expect(result.current.state).toEqual({ view: "hero", activeSectionId: null });
  });

  it("internal return-to-home from a direct deep link replaces the entry instead of going back", () => {
    window.history.replaceState({ foreign: "keep" }, "", "/?department=sales&utm=1#x");
    const { result } = renderMachine({ initialRevealed: true, initialSectionId: "sales" });
    expect(officeEntry()).toEqual({ layer: "office", pushedFromHero: false });

    const back = vi.spyOn(window.history, "back");
    const push = vi.spyOn(window.history, "pushState");
    act(() => result.current.dispatch({ type: "RETURN_TO_HERO" }));
    expect(back).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(`${window.location.search}${window.location.hash}`).toBe("?utm=1#x");
    expect(officeEntry()).toEqual({ layer: "hero", pushedFromHero: false });
    expect(window.history.state.foreign).toBe("keep");
  });

  it("keeps pushedFromHero across a reload of the OFFICE entry", () => {
    window.history.replaceState(
      withOfficeHistoryEntry(null, { layer: "office", pushedFromHero: true }),
      "",
      "/?department=sales",
    );
    const push = vi.spyOn(window.history, "pushState");
    renderMachine({ initialRevealed: true, initialSectionId: "sales" });
    expect(push).not.toHaveBeenCalled();
    expect(officeEntry()).toEqual({ layer: "office", pushedFromHero: true });
  });

  it("trusts the marked entry over stale props on mount (Next.js restores a cached HERO tree)", () => {
    // Возврат «назад» с другой страницы сайта: запись размечена как OFFICE/HR, а props — от `/`.
    window.history.replaceState(
      withOfficeHistoryEntry({ __NA: true }, { layer: "office", pushedFromHero: true }),
      "",
      "/?department=hr",
    );
    const push = vi.spyOn(window.history, "pushState");
    const back = vi.spyOn(window.history, "back");
    const { result } = renderMachine({ initialRevealed: false, initialSectionId: null });

    expect(result.current.state).toEqual({ view: "department-active", activeSectionId: "hr" });
    expect(window.location.search).toBe("?department=hr");
    expect(officeEntry()).toEqual({ layer: "office", pushedFromHero: true });
    expect(push).not.toHaveBeenCalled();
    expect(back).not.toHaveBeenCalled();
  });

  it("restores the office overview on reload of a marked OFFICE entry at `/`", () => {
    window.history.replaceState(
      withOfficeHistoryEntry(null, { layer: "office", pushedFromHero: true }),
      "",
      "/",
    );
    const { result } = renderMachine({ initialRevealed: false, initialSectionId: null });
    expect(result.current.state).toEqual({ view: "overview", activeSectionId: null });
    expect(officeEntry()).toEqual({ layer: "office", pushedFromHero: true });
  });

  it("treats an unknown section in a marked entry as the overview and cleans the URL", () => {
    window.history.replaceState(
      withOfficeHistoryEntry(null, { layer: "office", pushedFromHero: false }),
      "",
      "/?department=unknown",
    );
    const { result } = renderMachine({ initialRevealed: false, initialSectionId: null });
    expect(result.current.state).toEqual({ view: "overview", activeSectionId: null });
    expect(window.location.search).toBe("");
  });

  it("ignores a stale OFFICE marker on the first mount of a freshly navigated document", async () => {
    // Переход на тот же адрес `/`: Chrome заменяет запись, но оставляет её history.state.
    vi.resetModules();
    const fresh = await import("@/features/office-machine/url-sync");
    vi.spyOn(performance, "getEntriesByType").mockReturnValue([
      { type: "navigate" } as unknown as PerformanceEntry,
    ]);
    window.history.replaceState(
      fresh.withOfficeHistoryEntry(null, { layer: "office", pushedFromHero: true }),
      "",
      "/",
    );
    const { result } = renderHook(() => {
      const [state, dispatch] = useReducer(
        officeMachineReducer,
        { initialRevealed: false, initialSectionId: null },
        initOfficeMachineState,
      );
      fresh.useOfficeBrowserHistory(state, dispatch, SECTION_IDS);
      return state;
    });
    expect(result.current).toEqual({ view: "hero", activeSectionId: null });
    expect(officeEntry()).toEqual({ layer: "hero", pushedFromHero: false });
  });

  it("a repeated sync effect (StrictMode) after restoring from the entry does not go back", () => {
    window.history.replaceState(
      withOfficeHistoryEntry(null, { layer: "office", pushedFromHero: true }),
      "",
      "/?department=hr",
    );
    const back = vi.spyOn(window.history, "back");
    const push = vi.spyOn(window.history, "pushState");
    const { result } = renderHook(
      () => {
        const [state, dispatch] = useReducer(
          officeMachineReducer,
          { initialRevealed: false, initialSectionId: null },
          initOfficeMachineState,
        );
        useOfficeBrowserHistory(state, dispatch, SECTION_IDS);
        return state;
      },
      { reactStrictMode: true },
    );
    expect(result.current).toEqual({ view: "department-active", activeSectionId: "hr" });
    expect(back).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(window.location.search).toBe("?department=hr");
    expect(officeEntry()).toEqual({ layer: "office", pushedFromHero: true });
  });
});
