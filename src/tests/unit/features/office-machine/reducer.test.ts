import { describe, expect, it } from "vitest";
import { initOfficeMachineState, officeMachineReducer } from "@/features/office-machine/reducer";

describe("office-machine reducer", () => {
  it("starts in 'hero' when not initially revealed", () => {
    expect(initOfficeMachineState(false)).toEqual({ view: "hero" });
  });

  it("starts in 'overview' when initially revealed (boot with ?department=<id>)", () => {
    expect(initOfficeMachineState(true)).toEqual({ view: "overview" });
  });

  it("ACTIVATE_CTA transitions from 'hero' to 'overview'", () => {
    const next = officeMachineReducer({ view: "hero" }, { type: "ACTIVATE_CTA" });
    expect(next).toEqual({ view: "overview" });
  });

  it("ACTIVATE_CTA is idempotent when already in 'overview'", () => {
    const next = officeMachineReducer({ view: "overview" }, { type: "ACTIVATE_CTA" });
    expect(next).toEqual({ view: "overview" });
  });
});
