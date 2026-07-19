import type { DepartmentId } from "@/content/types";

/**
 * Идентификатор раздела 90%-области: пять отделов плюс «Ваша задача» (Step 12.7).
 *
 * «Ваша задача» — не отдел: у неё нет болей/выгод, сцены и записи в data/departments.json. Но в
 * раскладке она ведёт себя ровно как отдел (тот же 10/90-шелл, тот же рельс, те же переходы и
 * Escape), поэтому виды машины (`department-opening/active/switching/closing`) переиспользуются, а
 * различается только тип идентификатора. Имена видов остались прежними намеренно: переименование
 * ради одного нового раздела задело бы весь набор тестов, ничего не изменив по сути.
 */
export const TASK_SECTION_ID = "task" as const;
export type OfficeSectionId = DepartmentId | typeof TASK_SECTION_ID;

export type OfficeMachineView =
  | "hero"
  | "overview"
  | "department-opening"
  | "department-active"
  | "department-switching"
  | "department-closing";

export interface OfficeMachineState {
  view: OfficeMachineView;
  activeSectionId: OfficeSectionId | null;
}

export type OfficeMachineAction =
  | { type: "ACTIVATE_CTA" }
  | { type: "SELECT_DEPARTMENT"; departmentId: OfficeSectionId }
  | { type: "OPEN_COMPLETE" }
  | { type: "SWITCH_DEPARTMENT"; departmentId: OfficeSectionId }
  | { type: "SWITCH_COMPLETE" }
  | { type: "CLOSE_DEPARTMENT" }
  | { type: "CLOSE_COMPLETE" }
  | { type: "ESCAPE" }
  | { type: "RETURN_TO_HERO" };

export interface OfficeMachineInit {
  initialRevealed: boolean;
  initialSectionId: OfficeSectionId | null;
}

export function initOfficeMachineState(init: OfficeMachineInit): OfficeMachineState {
  if (init.initialSectionId) {
    return { view: "department-active", activeSectionId: init.initialSectionId };
  }
  return { view: init.initialRevealed ? "overview" : "hero", activeSectionId: null };
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
      return { view: "overview", activeSectionId: null };

    case "SELECT_DEPARTMENT":
      if (state.view !== "overview") return state;
      return { view: "department-opening", activeSectionId: action.departmentId };

    case "OPEN_COMPLETE":
      if (state.view !== "department-opening") return state;
      return { ...state, view: "department-active" };

    case "SWITCH_DEPARTMENT":
      if (!DEPARTMENT_ACTIVE_LIKE_VIEWS.includes(state.view)) return state;
      if (action.departmentId === state.activeSectionId) return state;
      return { view: "department-switching", activeSectionId: action.departmentId };

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
      return { view: "overview", activeSectionId: null };

    case "RETURN_TO_HERO":
      if (state.view === "hero") return state;
      return { view: "hero", activeSectionId: null };

    default:
      return state;
  }
}
