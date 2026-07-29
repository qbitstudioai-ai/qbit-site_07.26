# Analytics and Conversion

> **Статус (Amendment 23, 2026-07-22): ОТЛОЖЕНО.** Аналитика исключена из пилота Этапа 3 (Steps 24–25
> отменены решением пользователя). Этот документ остаётся утверждённой спецификацией на будущее: если
> аналитику вернут, словарь событий/параметров ниже — источник истины. В текущем пилоте `trackEvent`
> не реализуется. См. `WORKPLAN.md`, «Amendment 23».

## События

```text
homepage_view
hero_primary_cta_click
office_interaction_start
department_preview
department_open
department_switch
before_after_start
before_after_complete
diagnostic_start
diagnostic_step_complete
diagnostic_complete
contact_open
lead_submit
lead_submit_success
lead_submit_error
```

## Параметры

department, inputMode, motionMode, viewportCategory, source, campaign, diagnostic role/industry/problems, entryDepartment, timeToFirstDepartment и timeToLead.

Не отправлять чувствительные данные.

## Вопросы

- понимают ли интерактивность;
- какой отдел открывают;
- доходят ли до after;
- какой отдел приводит к CTA;
- мешает ли animation;
- где бросают диагностику и форму.

## Lead context

Выбранный отдел, отмеченные проблемы, diagnostic result, source, consent и comment.
