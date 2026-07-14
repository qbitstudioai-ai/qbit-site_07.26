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

Главная команда:

```text
/strict-plan-execution
```

Обязательные агенты:

- `planner` — составляет план;
- `skeptic` — проверяет план и каждый шаг.

Выполнение без skeptic verdict считается незавершённым.
