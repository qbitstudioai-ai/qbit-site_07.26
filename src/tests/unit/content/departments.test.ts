import { readFileSync } from "node:fs";
import path from "node:path";
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

  // Step 7.3, OQ-P1 (skeptic Phase A round 2 + Phase B, hardened after both rounds):
  // src/components/office/departmentPhotos.ts imports pre-generated per-department WebP
  // thumbnails (src/assets/office-photos/${id}-thumbnail.webp — generated once from the
  // references/**/*.png originals named in Department.reference, see departmentPhotos.ts's own
  // comment for why the originals aren't imported directly). The naming convention itself encodes
  // the department id, so this test verifies BOTH that the expected file is actually imported for
  // each id, AND that the object-literal binds that id's key to exactly that import (not a swapped
  // one, e.g. `sales: supportThumbnail`) — checking only "the file exists somewhere in the source"
  // would miss a swapped assignment, since both variables/paths would still be present in the file.
  it("departmentPhotos.ts binds each department id to its own thumbnail file, not a swapped one", () => {
    const source = readFileSync(
      path.resolve(process.cwd(), "src/components/office/departmentPhotos.ts"),
      "utf-8",
    );
    const mapMatch = source.match(/photoByDepartmentId[^{]*=\s*\{([\s\S]*?)\n\};/);
    expect(
      mapMatch,
      "could not find the photoByDepartmentId object literal in departmentPhotos.ts",
    ).not.toBeNull();
    const mapBody = mapMatch![1];

    for (const id of DEPARTMENT_IDS) {
      const importMatch = source.match(
        new RegExp(`import\\s+(\\w+)\\s+from\\s+["'][^"']*${id}-thumbnail\\.webp["']`),
      );
      expect(
        importMatch,
        `no static import found for src/assets/office-photos/${id}-thumbnail.webp`,
      ).not.toBeNull();
      const importedVariableName = importMatch![1];

      const bindingRegex = new RegExp(`\\b${id}\\s*:\\s*${importedVariableName}\\b`);
      expect(
        bindingRegex.test(mapBody),
        `photoByDepartmentId["${id}"] is not bound to "${importedVariableName}" ` +
          `(the import of ${id}-thumbnail.webp) — possible swapped assignment`,
      ).toBe(true);
    }
  });
});
