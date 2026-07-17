"use client";

import { useSyncExternalStore } from "react";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onStoreChange: () => void): () => void {
  const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY);
  mediaQuery.addEventListener("change", onStoreChange);
  return () => mediaQuery.removeEventListener("change", onStoreChange);
}

function getSnapshot(): boolean {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

// Сервер не знает предпочтение пользователя — единственный безопасный снапшот здесь `false`
// (motion разрешён). Иначе разметка, отрендеренная на сервере, разошлась бы с первым клиентским
// рендером у пользователя с включённым reduce (hydration mismatch). Расплата честная: у такого
// пользователя первый кадр приходит с "motion разрешён" и схлопывается сразу после гидратации —
// на практике незаметно, потому что сами CSS-анимации обнулены глобально (globals.css) ещё до
// того, как выполнится хоть один скрипт, а этот хук управляет только JS-таймерами.
function getServerSnapshot(): boolean {
  return false;
}

// Подписка на `change` медиа-запроса — это и есть MOTION_PREFERENCE_CHANGE из
// docs/05-homepage-state-machine.md: смена системной настройки на лету подхватывается без
// перезагрузки. Отдельного действия редьюсера не заводится — предпочтение не является состоянием
// офиса, оно лишь параметр длительностей (WORKPLAN.md Step 8, Out of scope).
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
