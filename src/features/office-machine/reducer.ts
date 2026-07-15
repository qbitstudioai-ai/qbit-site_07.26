export type OfficeMachineView = "hero" | "overview";

export interface OfficeMachineState {
  view: OfficeMachineView;
}

export type OfficeMachineAction = { type: "ACTIVATE_CTA" };

export function initOfficeMachineState(initialRevealed: boolean): OfficeMachineState {
  return { view: initialRevealed ? "overview" : "hero" };
}

export function officeMachineReducer(
  state: OfficeMachineState,
  action: OfficeMachineAction,
): OfficeMachineState {
  switch (action.type) {
    case "ACTIVATE_CTA":
      return { view: "overview" };
    default:
      return state;
  }
}
