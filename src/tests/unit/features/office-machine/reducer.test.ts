import { describe, expect, it } from "vitest";
import { initOfficeMachineState, officeMachineReducer } from "@/features/office-machine/reducer";

describe("office-machine reducer", () => {
  describe("initOfficeMachineState", () => {
    it("starts in 'hero' when not initially revealed and no department in URL", () => {
      expect(initOfficeMachineState({ initialRevealed: false, initialDepartmentId: null })).toEqual(
        {
          view: "hero",
          activeDepartmentId: null,
        },
      );
    });

    it("starts in 'overview' when initially revealed but no valid department in URL", () => {
      expect(initOfficeMachineState({ initialRevealed: true, initialDepartmentId: null })).toEqual({
        view: "overview",
        activeDepartmentId: null,
      });
    });

    it("starts directly in 'department-active' when a valid department id is in the URL at boot", () => {
      expect(
        initOfficeMachineState({ initialRevealed: false, initialDepartmentId: "sales" }),
      ).toEqual({
        view: "department-active",
        activeDepartmentId: "sales",
      });
    });
  });

  describe("ACTIVATE_CTA", () => {
    it("transitions from 'hero' to 'overview'", () => {
      const next = officeMachineReducer(
        { view: "hero", activeDepartmentId: null },
        { type: "ACTIVATE_CTA" },
      );
      expect(next).toEqual({ view: "overview", activeDepartmentId: null });
    });

    it("is a no-op when already in 'overview'", () => {
      const state = { view: "overview" as const, activeDepartmentId: null };
      expect(officeMachineReducer(state, { type: "ACTIVATE_CTA" })).toBe(state);
    });
  });

  describe("SELECT_DEPARTMENT", () => {
    it("transitions from 'overview' to 'department-opening' with the selected id", () => {
      const next = officeMachineReducer(
        { view: "overview", activeDepartmentId: null },
        { type: "SELECT_DEPARTMENT", departmentId: "sales" },
      );
      expect(next).toEqual({ view: "department-opening", activeDepartmentId: "sales" });
    });

    it("is a no-op from 'hero'", () => {
      const state = { view: "hero" as const, activeDepartmentId: null };
      expect(
        officeMachineReducer(state, { type: "SELECT_DEPARTMENT", departmentId: "sales" }),
      ).toBe(state);
    });
  });

  describe("OPEN_COMPLETE", () => {
    it("transitions from 'department-opening' to 'department-active', keeping the id", () => {
      const next = officeMachineReducer(
        { view: "department-opening", activeDepartmentId: "sales" },
        { type: "OPEN_COMPLETE" },
      );
      expect(next).toEqual({ view: "department-active", activeDepartmentId: "sales" });
    });

    it("is a no-op outside 'department-opening'", () => {
      const state = { view: "department-active" as const, activeDepartmentId: "sales" as const };
      expect(officeMachineReducer(state, { type: "OPEN_COMPLETE" })).toBe(state);
    });
  });

  describe("SWITCH_DEPARTMENT", () => {
    it("transitions from 'department-active' to 'department-switching' with the new id", () => {
      const next = officeMachineReducer(
        { view: "department-active", activeDepartmentId: "sales" },
        { type: "SWITCH_DEPARTMENT", departmentId: "hr" },
      );
      expect(next).toEqual({ view: "department-switching", activeDepartmentId: "hr" });
    });

    it("clicking the hotspot of the already-active department is a no-op (does not reopen itself)", () => {
      const state = { view: "department-active" as const, activeDepartmentId: "sales" as const };
      expect(
        officeMachineReducer(state, { type: "SWITCH_DEPARTMENT", departmentId: "sales" }),
      ).toBe(state);
    });

    it("is a no-op from 'overview' (no department active to switch away from)", () => {
      const state = { view: "overview" as const, activeDepartmentId: null };
      expect(officeMachineReducer(state, { type: "SWITCH_DEPARTMENT", departmentId: "hr" })).toBe(
        state,
      );
    });
  });

  describe("SWITCH_COMPLETE", () => {
    it("transitions from 'department-switching' to 'department-active', keeping the new id", () => {
      const next = officeMachineReducer(
        { view: "department-switching", activeDepartmentId: "hr" },
        { type: "SWITCH_COMPLETE" },
      );
      expect(next).toEqual({ view: "department-active", activeDepartmentId: "hr" });
    });

    it("is a no-op outside 'department-switching'", () => {
      const state = { view: "department-active" as const, activeDepartmentId: "hr" as const };
      expect(officeMachineReducer(state, { type: "SWITCH_COMPLETE" })).toBe(state);
    });
  });

  describe("CLOSE_DEPARTMENT / ESCAPE", () => {
    it("CLOSE_DEPARTMENT transitions from 'department-active' to 'department-closing'", () => {
      const next = officeMachineReducer(
        { view: "department-active", activeDepartmentId: "sales" },
        { type: "CLOSE_DEPARTMENT" },
      );
      expect(next).toEqual({ view: "department-closing", activeDepartmentId: "sales" });
    });

    it("ESCAPE has the identical effect to CLOSE_DEPARTMENT", () => {
      const state = { view: "department-active" as const, activeDepartmentId: "sales" as const };
      expect(officeMachineReducer(state, { type: "ESCAPE" })).toEqual(
        officeMachineReducer(state, { type: "CLOSE_DEPARTMENT" }),
      );
    });

    it("closes from 'department-opening' too (interrupts an in-progress open)", () => {
      const next = officeMachineReducer(
        { view: "department-opening", activeDepartmentId: "sales" },
        { type: "ESCAPE" },
      );
      expect(next).toEqual({ view: "department-closing", activeDepartmentId: "sales" });
    });

    it("is a no-op from 'overview' (nothing to close)", () => {
      const state = { view: "overview" as const, activeDepartmentId: null };
      expect(officeMachineReducer(state, { type: "ESCAPE" })).toBe(state);
    });

    it("is a no-op when already 'department-closing'", () => {
      const state = { view: "department-closing" as const, activeDepartmentId: "sales" as const };
      expect(officeMachineReducer(state, { type: "CLOSE_DEPARTMENT" })).toBe(state);
    });
  });

  describe("CLOSE_COMPLETE", () => {
    it("transitions from 'department-closing' to 'overview', clearing the active id", () => {
      const next = officeMachineReducer(
        { view: "department-closing", activeDepartmentId: "sales" },
        { type: "CLOSE_COMPLETE" },
      );
      expect(next).toEqual({ view: "overview", activeDepartmentId: null });
    });

    it("is a no-op outside 'department-closing'", () => {
      const state = { view: "department-active" as const, activeDepartmentId: "sales" as const };
      expect(officeMachineReducer(state, { type: "CLOSE_COMPLETE" })).toBe(state);
    });
  });

  describe("RETURN_TO_HERO", () => {
    it("transitions from 'overview' to 'hero', clearing the active id", () => {
      const next = officeMachineReducer(
        { view: "overview", activeDepartmentId: null },
        { type: "RETURN_TO_HERO" },
      );
      expect(next).toEqual({ view: "hero", activeDepartmentId: null });
    });

    it("transitions from 'department-active' to 'hero', clearing the active id", () => {
      const next = officeMachineReducer(
        { view: "department-active", activeDepartmentId: "sales" },
        { type: "RETURN_TO_HERO" },
      );
      expect(next).toEqual({ view: "hero", activeDepartmentId: null });
    });

    it.each(["department-opening", "department-switching", "department-closing"] as const)(
      "also transitions from the transitional state '%s' to 'hero' (interrupts an in-progress open/switch/close)",
      (view) => {
        const next = officeMachineReducer(
          { view, activeDepartmentId: "sales" },
          { type: "RETURN_TO_HERO" },
        );
        expect(next).toEqual({ view: "hero", activeDepartmentId: null });
      },
    );

    it("is a no-op when already in 'hero'", () => {
      const state = { view: "hero" as const, activeDepartmentId: null };
      expect(officeMachineReducer(state, { type: "RETURN_TO_HERO" })).toBe(state);
    });
  });

  describe("invariant: at most one department is active at a time", () => {
    it("activeDepartmentId is always a single id or null, never a collection", () => {
      const afterSelect = officeMachineReducer(
        { view: "overview", activeDepartmentId: null },
        { type: "SELECT_DEPARTMENT", departmentId: "sales" },
      );
      const afterSwitch = officeMachineReducer(
        { view: "department-active", activeDepartmentId: afterSelect.activeDepartmentId },
        { type: "SWITCH_DEPARTMENT", departmentId: "hr" },
      );
      expect(afterSwitch.activeDepartmentId).toBe("hr");
      expect(afterSwitch.activeDepartmentId).not.toBe("sales");
    });
  });
});
