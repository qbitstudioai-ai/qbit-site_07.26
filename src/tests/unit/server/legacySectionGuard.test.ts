// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  assertLegacySectionOnCreate,
  assertLegacySectionOnUpdate,
  LegacySectionError,
  type LegacySectionErrorCode,
} from "@/server/content/legacySectionGuard";

/**
 * Save-guard скрытой legacy-секции «Материалы по теме» (Amendment 61 / REL-02F.2).
 *
 * Все переходы состояний «сохранено → прислано» из WORKPLAN, плюс нормализация, без которой обычное
 * сохранение давало бы ложный отказ: `.trim()` схемы запроса и `\r\n → \n`.
 */

const TEXT = "**Краткий ответ:** текст.\n\n**Источники:**\n- [Источник](https://example.com/a)";
const SECTION =
  "**Материалы по теме:**\n- «[Сбор заявок](/products/leads-to-crm)» — пояснение.  \n- «[Связка](/blog/sayt-crm)» — пояснение.";

const WITH_SECTION = `${TEXT}\n\n${SECTION}`;
const NO_SECTION = TEXT;
const INVALID = `${TEXT}\n\n## Материалы по теме\n- [Сбор](/products/leads-to-crm)`;

function codeOf(action: () => void): LegacySectionErrorCode | "allowed" {
  try {
    action();
    return "allowed";
  } catch (error) {
    if (error instanceof LegacySectionError) return error.code;
    throw error;
  }
}

describe("assertLegacySectionOnCreate", () => {
  it.each([
    ["no_section", NO_SECTION, "allowed"],
    ["ok", WITH_SECTION, "legacy_section_forbidden"],
    ["invalid", INVALID, "legacy_section_invalid"],
  ] as const)("POST %s → %s", (_label, body, expected) => {
    expect(codeOf(() => assertLegacySectionOnCreate(body))).toBe(expected);
  });
});

describe("assertLegacySectionOnUpdate: переходы состояний", () => {
  it.each([
    // сохранено no_section
    ["no_section → no_section", NO_SECTION, `${NO_SECTION}\n\nНовый абзац.`, "allowed"],
    ["no_section → ok (новая секция)", NO_SECTION, WITH_SECTION, "legacy_section_forbidden"],
    ["no_section → invalid", NO_SECTION, INVALID, "legacy_section_invalid"],
    // сохранено ok
    [
      "ok → ok, секция не изменилась, правка другого текста",
      WITH_SECTION,
      `Новый абзац.\n\n${WITH_SECTION}`,
      "allowed",
    ],
    ["ok → ok, тот же текст", WITH_SECTION, WITH_SECTION, "allowed"],
    [
      "ok → ok, изменён пункт",
      WITH_SECTION,
      WITH_SECTION.replace("пояснение.  \n", "другое пояснение.  \n"),
      "legacy_section_changed",
    ],
    [
      "ok → ok, изменён заголовок (без двоеточия)",
      WITH_SECTION,
      WITH_SECTION.replace("**Материалы по теме:**", "**Материалы по теме**"),
      "legacy_section_changed",
    ],
    [
      "ok → ok, переставлены пункты",
      WITH_SECTION,
      `${TEXT}\n\n**Материалы по теме:**\n- «[Связка](/blog/sayt-crm)» — пояснение.\n- «[Сбор заявок](/products/leads-to-crm)» — пояснение.  `,
      "legacy_section_changed",
    ],
    [
      "ok → ok, добавлен пункт",
      WITH_SECTION,
      `${WITH_SECTION}\n- «[Кейс](/cases/analiz-zvonkov)» — пояснение.`,
      "legacy_section_changed",
    ],
    [
      "ok → ok, пробелы переноса строки внутри секции убраны",
      WITH_SECTION,
      WITH_SECTION.replace("пояснение.  \n", "пояснение.\n"),
      "legacy_section_changed",
    ],
    ["ok → no_section (удаление)", WITH_SECTION, NO_SECTION, "legacy_section_removal_forbidden"],
    ["ok → invalid", WITH_SECTION, INVALID, "legacy_section_invalid"],
    [
      "ok → invalid (добавлена вторая секция)",
      WITH_SECTION,
      `${WITH_SECTION}\n\n${SECTION}`,
      "legacy_section_invalid",
    ],
    // сохранено invalid (возможно только мимо API)
    ["invalid → тот же текст", INVALID, INVALID, "allowed"],
    ["invalid → другой текст", INVALID, `Новый абзац.\n\n${INVALID}`, "legacy_section_invalid"],
    ["invalid → no_section", INVALID, NO_SECTION, "legacy_section_invalid"],
    ["invalid → ok", INVALID, WITH_SECTION, "legacy_section_invalid"],
  ] as const)("%s", (_label, previous, incoming, expected) => {
    expect(codeOf(() => assertLegacySectionOnUpdate(previous, incoming))).toBe(expected);
  });
});

describe("assertLegacySectionOnUpdate: нормализация как у схемы запроса", () => {
  it("trim: секция в самом конце, у последнего пункта пробелы переноса и перевод строки — не «изменено»", () => {
    const stored = `${TEXT}\n\n**Материалы по теме:**\n- «[Сбор заявок](/products/leads-to-crm)» — пояснение.  \n`;
    // Ровно то, что дойдёт из формы через `z.string().trim()`.
    const incoming = stored.trim();

    expect(codeOf(() => assertLegacySectionOnUpdate(stored, incoming))).toBe("allowed");
  });

  it("CRLF в базе и LF из textarea — не «изменено»", () => {
    const stored = WITH_SECTION.replace(/\n/gu, "\r\n");

    expect(codeOf(() => assertLegacySectionOnUpdate(stored, WITH_SECTION))).toBe("allowed");
    expect(codeOf(() => assertLegacySectionOnUpdate(WITH_SECTION, stored))).toBe("allowed");
  });

  it("CRLF и trim не прячут настоящую правку секции", () => {
    const stored = `${WITH_SECTION.replace(/\n/gu, "\r\n")}\r\n`;
    const incoming = WITH_SECTION.replace("Сбор заявок", "Другой продукт");

    expect(codeOf(() => assertLegacySectionOnUpdate(stored, incoming))).toBe(
      "legacy_section_changed",
    );
  });

  it("invalid в базе с CRLF и концевыми пробелами — тот же текст после нормализации разрешён", () => {
    const stored = `${INVALID.replace(/\n/gu, "\r\n")}\r\n  `;

    expect(codeOf(() => assertLegacySectionOnUpdate(stored, INVALID))).toBe("allowed");
  });
});

describe("LegacySectionError: ответ API", () => {
  it.each([
    ["legacy_section_forbidden", 409],
    ["legacy_section_changed", 409],
    ["legacy_section_removal_forbidden", 409],
    ["legacy_section_invalid", 400],
  ] as const)("%s → %i, code и details у поля bodyMarkdown", (code, status) => {
    const error = new LegacySectionError(code);

    expect(error.status).toBe(status);
    expect(error.body).toEqual({
      error: error.message,
      code,
      details: [{ path: "bodyMarkdown", message: error.message }],
    });
    expect(error.message).toMatch(/Материалы по теме/u);
  });
});
