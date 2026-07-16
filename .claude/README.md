# Claude Code Configuration

## Skills

- `/allqbit-product-ux`
- `/allqbit-copywriting`
- `/allqbit-art-direction`
- `/allqbit-motion`
- `/interactive-office`
- `/frontend-quality`
- `/browser-qa`

### Внешние скиллы (импортированы вручную)

- `/motion-framer` — источник: [freshtechbro/claudedesignskills](https://github.com/freshtechbro/claudedesignskills), используется как справочник по паттернам Framer Motion при реализации `07-motion-system.md`.
- `/ui-ux-pro-max` — источник: [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill), справочная база стилей/палитр/типографики/UX-гайдлайнов. Не заменяет `docs/02-art-direction.md` и `allqbit-art-direction` — используется как дополнительный источник идей, при конфликте приоритет у документов проекта.

## Subagents

- `ux-strategist`
- `motion-engineer`
- `frontend-architect`
- `qa-reviewer`

Пример: «Попроси ux-strategist провести независимый аудит прототипа».

## Settings

`.claude/settings.json` запрещает чтение типичных secret-файлов. Добавьте реальные пути проекта.

Локальные разрешения хранить в `.claude/settings.local.json`, который исключён из Git.

## Hooks

Не включены до появления стабильных scripts. После инициализации можно добавить formatter, lint/typecheck, Playwright smoke и блокировку опасных commands.


## Strict orchestration

Полный протокол — `CLAUDE.md` → "Mandatory strict execution protocol" (единственный источник
правды, с 2026-07-16). Кратко: один Master Plan (`WORKPLAN.md`), без повторного планирования перед
уже описанным шагом, один цикл (TODO → реализация → проверки → skeptic → фикс → следующий TODO).

Обязательные агенты:

- `planner` — только для Master Plan, изменения scope или повторного `FAIL` skeptic'а;
- `skeptic` — проверяет план (один раз) и каждый выполненный шаг. Выполнение без его `PASS`
  считается незавершённым.

Именованный триггер: `/strict-plan-execution`.
