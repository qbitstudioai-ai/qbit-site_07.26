import type { DepartmentId } from "@/content/types";

export type OfficeMachineView =
  | "hero"
  | "overview"
  | "department-opening"
  | "department-active"
  | "department-switching"
  | "department-closing";

export interface OfficeMachineState {
  view: OfficeMachineView;
  activeDepartmentId: DepartmentId | null;
}

export type OfficeMachineAction =
  | { type: "ACTIVATE_CTA" }
  | { type: "SELECT_DEPARTMENT"; departmentId: DepartmentId }
  | { type: "OPEN_COMPLETE" }
  | { type: "SWITCH_DEPARTMENT"; departmentId: DepartmentId }
  | { type: "SWITCH_COMPLETE" }
  | { type: "CLOSE_DEPARTMENT" }
  | { type: "CLOSE_COMPLETE" }
  | { type: "ESCAPE" };

export interface OfficeMachineInit {
  initialRevealed: boolean;
  initialDepartmentId: DepartmentId | null;
}

export function initOfficeMachineState(init: OfficeMachineInit): OfficeMachineState {
  if (init.initialDepartmentId) {
    return { view: "department-active", activeDepartmentId: init.initialDepartmentId };
  }
  return { view: init.initialRevealed ? "overview" : "hero", activeDepartmentId: null };
}

const DEPARTMENT_ACTIVE_LIKE_VIEWS: OfficeMachineView[] = [
  "department-opening",
  "department-active",
  "department-switching",
  "department-closing",
];

export function officeMachineReducer(
  state: OfficeMachineState,
  action: OfficeMachineAction,
): OfficeMachineState {
  switch (action.type) {
    case "ACTIVATE_CTA":
      if (state.view !== "hero") return state;
      return { view: "overview", activeDepartmentId: null };

    case "SELECT_DEPARTMENT":
      if (state.view !== "overview") return state;
      return { view: "department-opening", activeDepartmentId: action.departmentId };

    case "OPEN_COMPLETE":
      if (state.view !== "department-opening") return state;
      return { ...state, view: "department-active" };

    case "SWITCH_DEPARTMENT":
      if (!DEPARTMENT_ACTIVE_LIKE_VIEWS.includes(state.view)) return state;
      if (action.departmentId === state.activeDepartmentId) return state;
      return { view: "department-switching", activeDepartmentId: action.departmentId };

    case "SWITCH_COMPLETE":
      if (state.view !== "department-switching") return state;
      return { ...state, view: "department-active" };

    case "CLOSE_DEPARTMENT":
    case "ESCAPE":
      if (state.view === "department-closing") return state;
      if (!DEPARTMENT_ACTIVE_LIKE_VIEWS.includes(state.view)) return state;
      return { ...state, view: "department-closing" };

    case "CLOSE_COMPLETE":
      if (state.view !== "department-closing") return state;
      return { view: "overview", activeDepartmentId: null };

    default:
      return state;
  }
}
