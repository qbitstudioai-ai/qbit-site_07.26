import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

// jsdom не реализует window.matchMedia вовсе (проверено на jsdom@29.1.1: typeof === "undefined"),
// поэтому в наборе есть общая заглушка — src/tests/unit/setup.ts. Она статична: всегда matches:false
// и никогда не шлёт change. Здесь подменяем её управляемой: иначе покрывался бы только тривиальный
// false-путь, а обе интересные ветки (reduce включён; предпочтение сменилось на лету) остались бы
// непроверенными.
function stubMatchMedia(initialMatches: boolean) {
  const listeners = new Set<() => void>();
  const state = { matches: initialMatches };

  const matchMedia = vi.fn((query: string) => ({
    matches: state.matches,
    media: query,
    addEventListener: (_type: "change", listener: () => void) => {
      listeners.add(listener);
    },
    removeEventListener: (_type: "change", listener: () => void) => {
      listeners.delete(listener);
    },
  }));

  vi.stubGlobal("matchMedia", matchMedia);

  return {
    matchMedia,
    emitChange(nextMatches: boolean) {
      state.matches = nextMatches;
      for (const listener of listeners) listener();
    },
    get listenerCount() {
      return listeners.size;
    },
  };
}

describe("usePrefersReducedMotion", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns false when the user has not asked for reduced motion", () => {
    stubMatchMedia(false);
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);
  });

  it("returns true when (prefers-reduced-motion: reduce) matches", () => {
    stubMatchMedia(true);
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(true);
  });

  it("reacts to a preference change without a reload (docs/05 MOTION_PREFERENCE_CHANGE)", () => {
    const media = stubMatchMedia(false);
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);

    act(() => media.emitChange(true));
    expect(result.current).toBe(true);

    act(() => media.emitChange(false));
    expect(result.current).toBe(false);
  });

  it("unsubscribes on unmount (no listener leak)", () => {
    const media = stubMatchMedia(false);
    const { unmount } = renderHook(() => usePrefersReducedMotion());
    expect(media.listenerCount).toBe(1);
    unmount();
    expect(media.listenerCount).toBe(0);
  });
});
