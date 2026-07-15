import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useDepartmentUrlSync } from "@/features/office-machine/url-sync";

describe("useDepartmentUrlSync", () => {
  afterEach(() => {
    window.history.replaceState(null, "", "/");
  });

  it("sets ?department=<id> in the URL without a full reload when a department becomes active", () => {
    const { rerender } = renderHook(({ id }) => useDepartmentUrlSync(id), {
      initialProps: { id: null as null | "sales" },
    });
    expect(window.location.search).toBe("");

    rerender({ id: "sales" });
    expect(window.location.search).toBe("?department=sales");
  });

  it("removes the department param when closed (back to null)", () => {
    const { rerender } = renderHook(({ id }) => useDepartmentUrlSync(id), {
      initialProps: { id: "sales" as null | "sales" },
    });
    expect(window.location.search).toBe("?department=sales");

    rerender({ id: null });
    expect(window.location.search).toBe("");
  });

  it("does not touch the URL when the id does not change (no redundant history writes)", () => {
    const { rerender } = renderHook(({ id }) => useDepartmentUrlSync(id), {
      initialProps: { id: "sales" as null | "sales" },
    });
    const before = window.location.href;
    rerender({ id: "sales" });
    expect(window.location.href).toBe(before);
  });
});
