// Server-only: не импортировать напрямую в "use client"-компоненты (см. DECISIONS.md, Step 2).
//
// Тексты отделов приходят из базы контента и правятся в админ-панели (`/admin/departments`).
// `data/departments.json` остался источником первичного заполнения и страховкой на случай пустой
// базы — см. `src/server/content/departments.ts`.
export { getDepartmentById, getDepartmentIds, getDepartments } from "@/server/content/departments";
