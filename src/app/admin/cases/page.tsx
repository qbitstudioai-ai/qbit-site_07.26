import { CasesEditor } from "@/features/admin/CasesEditor";
import { listAllCases, nextCaseSortOrder } from "@/server/repositories/cases";

/** Раздел «Кейсы»: список дел архива, публикация нового, правка и удаление. */
export default function AdminCasesPage() {
  return <CasesEditor cases={listAllCases()} nextSortOrder={nextCaseSortOrder()} />;
}
