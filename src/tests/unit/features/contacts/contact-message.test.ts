import { describe, expect, it } from "vitest";
import { buildContactMessage } from "@/features/contacts/contactMessage";

/**
 * Текст, который узел Telegram сценария n8n отправляет как есть. Проверяется читаемость и то, что
 * незаполненный способ связи не превращается в пустую строку.
 */

const META = {
  submissionId: "11111111-2222-3333-4444-555555555555",
  submittedAt: "2026-07-29T09:05:00.000Z",
  page: "/contacts",
} as const;

const SUBMISSION = {
  name: "Павел",
  phone: "+79375346575",
  telegram: "@Promt_Pavel",
  process: "Менеджеры вручную переносят заявки из Telegram в CRM и теряют часть из них.",
};

describe("buildContactMessage", () => {
  it("собирает читаемое сообщение со всеми полями заявки", () => {
    const message = buildContactMessage(SUBMISSION, META);

    expect(message).toContain("Заявка с сайта QBit-Studio-Ai — страница «Контакты»");
    expect(message).toContain("Имя: Павел");
    expect(message).toContain("Телефон: +79375346575");
    expect(message).toContain("Telegram: @Promt_Pavel");
    expect(message).toContain(SUBMISSION.process);
    expect(message).toContain(META.submissionId);
  });

  it("называет страницу отправки: заявка с главной не выдаёт себя за контактную", () => {
    const fromHome = buildContactMessage(SUBMISSION, { ...META, page: "/" });
    const fromContacts = buildContactMessage(SUBMISSION, { ...META, page: "/contacts" });

    expect(fromHome).toContain(
      "Заявка с сайта QBit-Studio-Ai — главная страница, раздел «Ваша задача»",
    );
    expect(fromHome).not.toContain("страница «Контакты»");
    expect(fromContacts).toContain("Заявка с сайта QBit-Studio-Ai — страница «Контакты»");

    // Меняется только заголовок: остальной формат сообщения общий для обеих страниц.
    expect(fromHome.split("\n").slice(1)).toEqual(fromContacts.split("\n").slice(1));
  });

  it("показывает время в московском часовом поясе, а не в UTC", () => {
    expect(buildContactMessage(SUBMISSION, META)).toContain("29.07.2026, 12:05 МСК");
  });

  it("пропускает строку незаполненного способа связи", () => {
    const withoutPhone = buildContactMessage({ ...SUBMISSION, phone: null }, META);
    expect(withoutPhone).not.toContain("Телефон:");
    expect(withoutPhone).toContain("Telegram: @Promt_Pavel");

    const withoutTelegram = buildContactMessage({ ...SUBMISSION, telegram: null }, META);
    expect(withoutTelegram).not.toContain("Telegram:");
    expect(withoutTelegram).toContain("Телефон: +79375346575");
  });

  it("переносит описание процесса без разметки: спецсимволы уходят как есть", () => {
    const message = buildContactMessage(
      { ...SUBMISSION, process: "Отчёт *важно* _срочно_ [ссылка](x)" },
      META,
    );

    expect(message).toContain("Отчёт *важно* _срочно_ [ссылка](x)");
  });
});
