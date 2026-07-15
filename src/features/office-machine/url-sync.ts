import { useEffect } from "react";
import type { DepartmentId } from "@/content/types";

// Сырой history.pushState/replaceState (решение пользователя по OQ-B, см. DECISIONS.md
// 2026-07-15) — без next/navigation useRouter/useSearchParams, чтобы не инициировать повторный
// рендер серверного дерева (page.tsx/HomepageShell) при каждой смене отдела. replaceState (не
// pushState) намеренно — поддержка кнопок "назад"/"вперёд" вне scope Step 5 (см. WORKPLAN.md), и
// pushState создавал бы бессмысленные записи истории для UI, который их не поддерживает.
export function useDepartmentUrlSync(activeDepartmentId: DepartmentId | null) {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (activeDepartmentId) {
      url.searchParams.set("department", activeDepartmentId);
    } else {
      url.searchParams.delete("department");
    }
    const nextRelative = `${url.pathname}${url.search}${url.hash}`;
    const currentRelative = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (nextRelative !== currentRelative) {
      window.history.replaceState(null, "", nextRelative);
    }
  }, [activeDepartmentId]);
}
