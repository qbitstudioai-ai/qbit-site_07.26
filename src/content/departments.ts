// Server-only: не импортировать напрямую в "use client"-компоненты (см. DECISIONS.md, Step 2) —
// иначе zod и валидация попадут в client-бандл.
import rawDepartments from "../../data/departments.json";
import { departmentsSchema } from "./schema";
import type { Department, DepartmentId } from "./types";

const departments: Department[] = departmentsSchema.parse(rawDepartments);

export function getDepartments(): Department[] {
  return departments;
}

export function getDepartmentIds(): DepartmentId[] {
  return departments.map((department) => department.id);
}

export function getDepartmentById(id: DepartmentId): Department | undefined {
  return departments.find((department) => department.id === id);
}
