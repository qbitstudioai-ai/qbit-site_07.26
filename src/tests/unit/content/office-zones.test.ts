import { describe, expect, it } from "vitest";
import { getDepartments } from "@/content/departments";
import { getOfficeZoneByDepartment, getOfficeZones } from "@/content/office-zones";
import { DEPARTMENT_IDS } from "@/content/schema";

describe("office-zones adapter", () => {
  it("returns exactly 5 zones with unique departmentIds covering the canonical set", () => {
    const zones = getOfficeZones();
    expect(zones).toHaveLength(5);

    const ids = zones.map((zone) => zone.departmentId);
    expect(new Set(ids).size).toBe(5);
    expect(ids.slice().sort()).toEqual(DEPARTMENT_IDS.slice().sort());
  });

  it.each(DEPARTMENT_IDS)("getOfficeZoneByDepartment returns a zone for id=%s", (id) => {
    const zone = getOfficeZoneByDepartment(id);
    expect(zone).toBeDefined();
    expect(zone?.departmentId).toBe(id);
  });

  it("is cross-consistent with departments.json: same set of department ids", () => {
    const departmentIds = getDepartments()
      .map((department) => department.id)
      .sort();
    const zoneDepartmentIds = getOfficeZones()
      .map((zone) => zone.departmentId)
      .sort();
    expect(zoneDepartmentIds).toEqual(departmentIds);
  });
});
