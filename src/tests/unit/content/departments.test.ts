import { describe, expect, it } from "vitest";
import { getDepartmentById, getDepartmentIds, getDepartments } from "@/content/departments";
import { DEPARTMENT_IDS, SOLUTION_PATH_BY_DEPARTMENT_ID } from "@/content/schema";

describe("departments adapter", () => {
  it("returns exactly 5 departments with unique ids covering the canonical set", () => {
    const departments = getDepartments();
    expect(departments).toHaveLength(5);

    const ids = departments.map((department) => department.id);
    expect(new Set(ids).size).toBe(5);
    expect(ids.slice().sort()).toEqual(DEPARTMENT_IDS.slice().sort());
  });

  it("getDepartmentIds returns the same ids as getDepartments", () => {
    expect(getDepartmentIds().slice().sort()).toEqual(
      getDepartments()
        .map((department) => department.id)
        .sort(),
    );
  });

  it.each(DEPARTMENT_IDS)("getDepartmentById returns the department for id=%s", (id) => {
    const department = getDepartmentById(id);
    expect(department).toBeDefined();
    expect(department?.id).toBe(id);
  });

  it("getDepartmentById returns undefined for an unknown id", () => {
    expect(getDepartmentById("unknown" as never)).toBeUndefined();
  });

  it.each(DEPARTMENT_IDS)("solutionPath for id=%s matches docs/09 routes", (id) => {
    const department = getDepartmentById(id);
    expect(department?.solutionPath).toBe(SOLUTION_PATH_BY_DEPARTMENT_ID[id]);
  });
});
