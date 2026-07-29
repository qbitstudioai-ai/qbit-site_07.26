import type { ContactSubmission } from "./contactSchema";

/**
 * Текст заявки для Telegram.
 *
 * Сценарий n8n («Qbit_sait/Webhook → Telegram notification») ничего не форматирует: узел Telegram
 * подставляет `body.message` как есть, а при его отсутствии шлёт служебную заглушку. Поэтому
 * читаемый текст собирает сервер сайта — n8n остаётся простым транспортом.
 *
 * Разметка не используется намеренно: узел Telegram отправлен без `parse_mode`, и любые `*`, `_`
 * или `[` из описания процесса были бы либо экранированы неверно, либо привели бы к отказу
 * Telegram разобрать сообщение. Обычный текст доставляется всегда.
 */

/** Заголовок: сразу видно, с какой страницы какого сайта пришла заявка. */
const MESSAGE_HEADING = "Заявка с сайта QBit-Studio-Ai — страница «Контакты»";

/** Часовой пояс отображаемого времени: заявки читает человек в Москве, а не в UTC. */
const DISPLAY_TIME_ZONE = "Europe/Moscow";

function formatSubmittedAt(iso: string): string {
  const formatted = new Intl.DateTimeFormat("ru-RU", {
    timeZone: DISPLAY_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));

  return `${formatted} МСК`;
}

export function buildContactMessage(
  submission: ContactSubmission,
  meta: { submissionId: string; submittedAt: string },
): string {
  const lines = [MESSAGE_HEADING, "", `Имя: ${submission.name}`];

  // Незаполненный способ связи строкой «Телефон: —» не показывается: обязателен хотя бы один из
  // двух, и пустая строка только удлиняет сообщение в телефоне.
  if (submission.phone) lines.push(`Телефон: ${submission.phone}`);
  if (submission.telegram) lines.push(`Telegram: ${submission.telegram}`);

  lines.push("", "Процесс:", submission.process);
  lines.push("", `${formatSubmittedAt(meta.submittedAt)} · заявка ${meta.submissionId}`);

  return lines.join("\n");
}
