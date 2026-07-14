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

For every implementation task larger than a trivial one-line correction, use the following workflow. This protocol is mandatory.

### Phase A — planning

1. Ask the `planner` subagent to inspect the relevant documentation and current code.
2. The planner creates or updates `WORKPLAN.md`.
3. Every step in the plan must include:
   - objective;
   - allowed scope;
   - files expected to change;
   - dependencies;
   - acceptance criteria;
   - verification commands;
   - risks;
   - rollback approach.
4. Ask the `skeptic` subagent to review the proposed plan.
5. Resolve the skeptic's objections.
6. Present the final plan to the user.
7. Do not implement until the user approves the plan, unless the user explicitly delegated approval.

### Phase B — step execution

For each approved step:

1. Mark only that step as `IN_PROGRESS` in `WORKPLAN.md`.
2. Restate the exact scope and acceptance criteria.
3. Implement only that step.
4. Run the verification commands defined for that step.
5. Record changed files and results in `WORKLOG.md`.
6. Mark the step as `AWAITING_SKEPTIC`.
7. Invoke the `skeptic` subagent.
8. The skeptic must inspect:
   - the plan step;
   - the actual diff;
   - test output;
   - architecture impact;
   - accessibility impact;
   - performance impact;
   - hidden regressions;
   - unsupported assumptions.
9. The skeptic returns exactly one verdict:
   - `PASS`;
   - `FAIL`;
   - `BLOCKED`.
10. Do not start the next step without `PASS`.

### Phase C — correction loop

If the skeptic returns `FAIL`:

1. Keep the same step `IN_PROGRESS`.
2. Fix only the issues within the approved scope.
3. Repeat verification.
4. Invoke the skeptic again.
5. Continue until `PASS` or until a plan change is required.

If a fix requires expanding scope or changing architecture:

1. Stop implementation.
2. Mark the step `BLOCKED`.
3. Update the proposed plan.
4. Ask the skeptic to review the amended plan.
5. Ask the user to approve the change.

### Phase D — milestone review

After every milestone:

1. Invoke `frontend-architect`.
2. Invoke `qa-reviewer`.
3. Invoke `ux-strategist` for user-facing changes.
4. Invoke `motion-engineer` for motion-related changes.
5. Consolidate findings.
6. Do not proceed to the next milestone while Blocker or Critical defects remain.

### Required status values

Use only:

- `PROPOSED`
- `APPROVED`
- `IN_PROGRESS`
- `AWAITING_SKEPTIC`
- `FAILED_REVIEW`
- `BLOCKED`
- `PASSED`
- `COMPLETED`

### Non-negotiable rules

- Never silently skip the skeptic review.
- Never combine multiple approved steps into one implementation pass.
- Never mark a step complete based only on self-review.
- Never change the plan after approval without recording and approving the amendment.
- Never claim a check passed unless its command was actually run.
- Never let the skeptic edit implementation files.
- Keep the skeptic independent and read-only.
- Preserve evidence in `WORKLOG.md`.

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
