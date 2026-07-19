import { useEffect } from "react";
import { TASK_SECTION_ID, type OfficeSectionId } from "./reducer";

// Сырой history.pushState/replaceState (решение пользователя по OQ-B, см. DECISIONS.md
// 2026-07-15) — без next/navigation useRouter/useSearchParams, чтобы не инициировать повторный
// рендер серверного дерева (page.tsx/HomepageShell) при каждой смене отдела. replaceState (не
// pushState) намеренно — поддержка кнопок "назад"/"вперёд" вне scope Step 5 (см. WORKPLAN.md), и
// pushState создавал бы бессмысленные записи истории для UI, который их не поддерживает.
//
// Step 12.7: разделов стало шесть, и адресуются они РАЗНЫМИ параметрами — `?department=<id>` для
// пяти отделов, `?section=task` для «Вашей задачи». Складывать «задачу» в `?department=` было бы
// неправдой: это не отдел, и ссылка вида `?department=task` вводила бы в заблуждение и ломала
// смысл параметра. Взамен приходится следить, чтобы лишний параметр всегда вычищался — иначе в
// URL останутся оба и адрес станет неоднозначным.
export function useDepartmentUrlSync(activeSectionId: OfficeSectionId | null) {
  useEffect(() => {
    const url = new URL(window.location.href);

    if (activeSectionId === TASK_SECTION_ID) {
      url.searchParams.set("section", TASK_SECTION_ID);
      url.searchParams.delete("department");
    } else if (activeSectionId) {
      url.searchParams.set("department", activeSectionId);
      url.searchParams.delete("section");
    } else {
      url.searchParams.delete("department");
      url.searchParams.delete("section");
    }

    const nextRelative = `${url.pathname}${url.search}${url.hash}`;
    const currentRelative = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (nextRelative !== currentRelative) {
      window.history.replaceState(null, "", nextRelative);
    }
  }, [activeSectionId]);
}
