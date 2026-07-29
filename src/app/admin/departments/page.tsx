import { DepartmentsEditor } from "@/features/admin/DepartmentsEditor";
import { listAllDepartments } from "@/server/repositories/departments";

/**
 * Раздел «Отделы».
 *
 * Данные читаются на сервере и передаются редактору готовыми: клиентскому коду доступ к базе не
 * нужен, а первый экран не должен начинаться со скелетона.
 */
export default function AdminDepartmentsPage() {
  return <DepartmentsEditor departments={listAllDepartments()} />;
}
