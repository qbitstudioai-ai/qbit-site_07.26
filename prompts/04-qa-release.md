# Prompt 04 — QA and Release Audit

Не добавляй новые функции.

Проведи независимый аудит:

- product message;
- overview/preview/open/switch/close;
- direct URL и history;
- mobile/touch;
- keyboard/focus/Escape;
- semantic controls;
- contrast/zoom/reduced motion/axe;
- initial load/assets/code splitting/long tasks/memory;
- lint/typecheck/tests/build/console;
- fallback и secrets.

Раздели дефекты на Blocker, Critical, Major, Minor, Suggestion.

Для каждого: место, шаги, actual, expected, fix. Не исправляй код до утверждения отчёта.
