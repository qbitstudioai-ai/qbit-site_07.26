# Allqbit Website — Project Instructions

## Product goal

Build an interactive website that sells business-process automation through understandable outcomes:

- fewer lost enquiries;
- faster customer response;
- less repetitive manual work;
- clearer statuses and responsibility;
- more management visibility.

Do not lead with AI, agents, integrations, CRM, BPM, or digital transformation.

## Core concept

The desktop homepage is an interactive office without vertical scrolling. It contains five departments:

1. Sales.
2. Technical support.
3. Executive management.
4. HR.
5. Logistics.

The office is navigation and diagnosis, not decoration.

When a department is selected:

- the selected department expands into the main 90% area;
- other departments move into a 10% navigation rail;
- the user sees the problem, current process, automation scenario, outcome, and CTA;
- switching departments does not reload the page.

## Source of truth

- Product and UX: `docs/`
- Structured content: `data/`
- Visual references: `references/`

Never silently contradict approved documents. Report conflicts before implementation.

## Required workflow

For every substantial task:

1. Read relevant documentation.
2. Inspect the codebase.
3. State assumptions and risks.
4. Produce a scoped plan.
5. Make the smallest coherent change.
6. Run relevant checks.
7. Verify UI changes in a running browser.
8. Report results and remaining issues.

Do not implement the whole project in one pass.


## Mandatory strict execution protocol

This protocol is mandatory. It replaced a heavier per-step planning cycle on 2026-07-16 (see
`DECISIONS.md`) to cut token/context overhead without dropping any of the quality gates. **This
section is the single source of truth for the process** — do not restate it in `docs/`, skills, or
subagent files; point back here instead.

### 1. One Master Plan

`WORKPLAN.md` is created once by the `planner` subagent, covering the whole project (or the whole
current milestone) broken into small, independently-verifiable steps — each with objective, scope,
dependencies, acceptance criteria, verification commands, risks, and rollback.

After the user approves it, the Master Plan is **immutable** except through a recorded Amendment
(reason, old scope, new scope, impact, user approval). Do not silently rewrite an approved step.

### 2. No per-step re-planning

If the next step is already described in `WORKPLAN.md`, go straight to implementation. Do not draft
a new mini-plan, do not re-invoke `planner`, and do not spend tokens restating a scope that is
already written down. Restate the acceptance criteria in one line if useful, then implement.

### 3. One execution cycle

```text
Next TODO → Implement → Local checks → Skeptic review → Fix (if FAIL) → Next TODO
```

For each step:

1. Mark it `IN_PROGRESS` in `WORKPLAN.md`.
2. Implement only that step's scope.
3. Run its verification commands.
4. Record what changed and the command results in `WORKLOG.md` — facts only (files touched,
   commands run, exit status, one line per finding). Do not narrate the deliberation or re-quote
   earlier rounds verbatim; a corrected fact replaces the old one, it doesn't get appended next to it.
5. Mark it `AWAITING_SKEPTIC` and invoke `skeptic`.
6. On `FAIL`: fix within the approved scope, re-run checks, invoke `skeptic` again.
7. On `BLOCKED`: stop, raise a plan Amendment, get user approval before continuing.
8. On `PASS`: mark `COMPLETED`, move to the next TODO — no separate closure ceremony.

### 4. Skeptic stays mandatory

`skeptic` is independent and read-only. It inspects the plan step, the actual diff, test output,
architecture/accessibility/performance impact, hidden regressions, and unsupported assumptions, then
returns exactly one verdict: `PASS`, `FAIL`, or `BLOCKED`. The next TODO is forbidden without `PASS`.
A step is never marked complete on self-review alone.

Skeptic must separate **blocking** findings (wrong behavior, missing acceptance criteria, real
regressions, architecture/a11y/perf problems) from **non-blocking** findings (wording, bookkeeping
fields, doc cross-references). Non-blocking findings are fixed inline and noted — they do not by
themselves force another full round. Blocking findings do.

### 5. Planner used only for

1. Creating (or substantially re-scoping) the Master Plan.
2. A real change in project scope.
3. Skeptic returning `FAIL`/`BLOCKED` repeatedly on the same step in a way that needs re-planning,
   not just a fix.

Do not invoke `planner` to describe a step that is already in `WORKPLAN.md`.

### 6. Milestone review

At the end of a real milestone (not every step): invoke `frontend-architect`, `qa-reviewer`, and —
for user-facing or motion-related work — `ux-strategist`/`motion-engineer`. Consolidate findings. Do
not proceed to the next milestone while a Blocker or Critical defect remains.

### Required status values

Use only: `PROPOSED`, `APPROVED`, `IN_PROGRESS`, `AWAITING_SKEPTIC`, `FAILED_REVIEW`, `BLOCKED`,
`PASSED`, `COMPLETED`.

### Non-negotiable rules

- Never silently skip the skeptic review.
- Never combine multiple approved steps into one implementation pass.
- Never mark a step complete based only on self-review.
- Never change the plan after approval without recording and approving the amendment.
- Never claim a check passed unless its command was actually run.
- Never let the skeptic edit implementation files.
- Keep the skeptic independent and read-only.
- Preserve evidence in `WORKLOG.md` — but keep it compact (see rule 3).

## Architecture rules

- Use semantic HTML for text, buttons, forms, and navigation.
- Do not place the whole interface in Canvas or WebGL.
- Use SVG/DOM for interactive zones whenever possible.
- Use WebGL only for clear visual value.
- Keep content separate from components.
- Model homepage states explicitly.
- Make departments directly addressable by URL.
- Avoid unnecessary client components.
- Keep animation orchestration separate from content.

## Copy rules

Use business language: lost enquiries, response speed, manual work, time, money, control, delays, responsibility.

Do not make unsupported promises about revenue, savings, employee replacement, or full autonomy.

Savings calculations must use user inputs, show the formula, and be labelled preliminary.

## Motion rules

- Motion explains cause, movement, status, or transformation.
- Never delay the hero message for an intro.
- Do not animate everything simultaneously.
- Support `prefers-reduced-motion`.
- Critical content must not depend on animation completion.

## Responsive rules

- Desktop may use cursor exploration.
- Tablet supports pointer and touch.
- Mobile must not depend on hover.
- Mobile is not a scaled-down desktop office.
- CTA remains easy to reach.

## Accessibility rules

- All departments are keyboard reachable.
- Focus is visible.
- Escape closes an active department.
- Meaning never relies only on colour.
- WebGL/Canvas always has semantic HTML equivalents.
- No autoplay audio.

## Performance rules

- Render useful HTML immediately.
- Lazy-load department assets.
- Do not preload all detailed scenes.
- Pause nonessential animation when hidden.
- Avoid layout thrashing and React state updates on every pointer move.
- Prefer transforms and opacity.

## Quality gate

After project initialization, maintain equivalent scripts for:

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e
```

## Safety

- Never commit secrets.
- Never read `.env`, `.env.local`, or secret files.
- Do not run destructive commands without explicit approval.
- Do not rewrite unrelated files.
- Do not create commits unless requested.

## First milestone

Low-fidelity prototype only:

- full-office overview;
- five interactive zones;
- hover/focus/touch;
- department selection;
- 10/90 layout;
- department switching;
- return to overview;
- keyboard operation;
- mobile touch flow;
- reduced-motion behaviour.

No final 3D art, detailed characters, backend, CRM, or calculator.
