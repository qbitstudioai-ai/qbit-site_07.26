import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";

// jsdom не реализует window.matchMedia вовсе (не «реализует с matches: false» — самой функции нет).
// Со Step 8 её вызывает usePrefersReducedMotion при каждом рендере OfficeMachine, поэтому без этой
// заглушки падает весь набор с TypeError, хотя в браузере кода это не касается.
// Заглушка сознательно живёт здесь, а не в самом хуке: matchMedia есть во всех целевых браузерах, и
// защитная ветка в продакшн-коде маскировала бы дефект окружения под фичу продукта.
// Дефолт — «reduce не запрошен» (matches: false), то есть полный motion: те тесты, которым нужна
// другая ветка, подменяют matchMedia сами (см. use-prefers-reduced-motion.test.ts).
if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}

// DEPT-SEO.2D: главная размечает запись истории (`history.state`) и при монтировании доверяет этой
// разметке больше, чем props (так браузер возвращает посетителя «назад»). jsdom держит одну историю
// на весь файл тестов, и разметка, оставленная одним рендером, досталась бы следующему — рендеру с
// другими props на том же адресе, чего в браузере не бывает. Каждый тест начинает с чистой записи.
if (typeof window !== "undefined") {
  afterEach(() => {
    window.history.replaceState(null, "", "/");
  });
}
