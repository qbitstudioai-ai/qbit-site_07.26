// Server-only: не импортировать напрямую в "use client"-компоненты (см. DECISIONS.md, Step 2) —
// иначе zod и валидация попадут в client-бандл.
import rawOfficeZones from "../../data/office-zones.json";
import { officeZonesDataSchema } from "./schema";
import type { DepartmentId, OfficeZone } from "./types";

const officeZonesData = officeZonesDataSchema.parse(rawOfficeZones);

export function getOfficeZones(): OfficeZone[] {
  return officeZonesData.zones;
}

export function getOfficeZoneByDepartment(id: DepartmentId): OfficeZone | undefined {
  return officeZonesData.zones.find((zone) => zone.departmentId === id);
}
