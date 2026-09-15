import { extractLegacyRelatedSection } from "@/features/blog/legacyRelatedSection.mjs";

/**
 * Защита скрытой legacy-секции «Материалы по теме» при сохранении статьи (Amendment 61 / REL-02F.2).
 *
 * После F.2 секция в публичной статье не показывается (см. `features/blog/articleBody.ts`), но до
 * REL-02F.3 физически остаётся в тексте всех статей. Значит, редактор может изменить то, чего
 * посетитель не видит, — и не узнать об этом. Поэтому:
 *
 * - новую секцию создать нельзя (ни в новой статье, ни в существующей без секции);
 * - существующую — нельзя ни изменить, ни удалить обычным сохранением: удаление — это REL-02F.3;
 * - неоднозначную форму сохранить нельзя.
 *
 * Обычная правка статьи, в которой секция уже есть, при этом работает: секция сравнивается с
 * сохранённой ПОБАЙТНО по точному диапазону extractor, а не через `parseBlogMarkdown()`.
 *
 * Перед сравнением обе стороны приводятся к тому, что реально дошло бы до базы через схему запроса:
 * `.trim()` (у `bodyMarkdown` в `articleSchema`) и `\r\n → \n` (textarea браузера всегда отдаёт
 * `\n`). Без этого секция в самом конце текста с пробелами переноса строки на последнем пункте или
 * тело с `\r\n` давали бы ложное «изменено» на каждом сохранении.
 *
 * Модуль чистый: ни базы, ни HTTP. Где и в какой транзакции вызывать — решает вызывающий код.
 */

export type LegacySectionErrorCode =
  | "legacy_section_forbidden"
  | "legacy_section_changed"
  | "legacy_section_removal_forbidden"
  | "legacy_section_invalid";

const MESSAGES: Readonly<Record<LegacySectionErrorCode, string>> = Object.freeze({
  legacy_section_forbidden:
    "Блок «Материалы по теме» в тексте статьи больше не используется: материалы по теме задаются в разделе «Связи». Уберите блок из текста.",
  legacy_section_changed:
    "Блок «Материалы по теме» в тексте скрыт в публичной статье и не редактируется. Верните его в прежнем виде, а материалы по теме измените в разделе «Связи».",
  legacy_section_removal_forbidden:
    "Блок «Материалы по теме» в тексте скрыт в публичной статье и будет удалён отдельной уборкой. Верните его в прежнем виде.",
  legacy_section_invalid:
    "Блок «Материалы по теме» в тексте не распознан. Верните текст статьи в прежнем виде или уберите этот блок из новой статьи.",
});

/** 409 — конфликт с состоянием сохранённой статьи; 400 — сама форма текста неоднозначна. */
const STATUS: Readonly<Record<LegacySectionErrorCode, number>> = Object.freeze({
  legacy_section_forbidden: 409,
  legacy_section_changed: 409,
  legacy_section_removal_forbidden: 409,
  legacy_section_invalid: 400,
});

export interface LegacySectionErrorBody {
  error: string;
  code: LegacySectionErrorCode;
  details: { path: "bodyMarkdown"; message: string }[];
}

/**
 * Отказ save-guard. Отдельный класс, а не `ContentRelationError` (D6): это ошибка текста статьи, а не
 * связи. Ответ несёт `details` с путём `bodyMarkdown`, чтобы форма показала сообщение у поля текста.
 */
export class LegacySectionError extends Error {
  readonly code: LegacySectionErrorCode;
  readonly status: number;

  constructor(code: LegacySectionErrorCode) {
    super(MESSAGES[code]);
    this.name = "LegacySectionError";
    this.code = code;
    this.status = STATUS[code];
  }

  get body(): LegacySectionErrorBody {
    return {
      error: this.message,
      code: this.code,
      details: [{ path: "bodyMarkdown", message: this.message }],
    };
  }
}

/** Та же нормализация, что проходит текст по пути в базу. */
export function normalizeArticleBody(markdown: string): string {
  return markdown.replace(/\r\n/gu, "\n").trim();
}

/** Создание статьи: секции быть не должно вовсе. */
export function assertLegacySectionOnCreate(incomingBody: string): void {
  const incoming = extractLegacyRelatedSection(normalizeArticleBody(incomingBody));
  if (incoming.state === "invalid") throw new LegacySectionError("legacy_section_invalid");
  if (incoming.state === "ok") throw new LegacySectionError("legacy_section_forbidden");
}

/** Правка статьи: секция либо отсутствует с обеих сторон, либо не изменилась ни на байт. */
export function assertLegacySectionOnUpdate(previousBody: string, incomingBody: string): void {
  const previousText = normalizeArticleBody(previousBody);
  const incomingText = normalizeArticleBody(incomingBody);
  const previous = extractLegacyRelatedSection(previousText);

  // Сохранённая форма уже неоднозначна (возможна только мимо API). Сравнить секцию не с чем, поэтому
  // fail-closed: разрешено только сохранение, не меняющее текст вовсе.
  if (previous.state === "invalid") {
    if (incomingText !== previousText) throw new LegacySectionError("legacy_section_invalid");
    return;
  }

  const incoming = extractLegacyRelatedSection(incomingText);
  if (incoming.state === "invalid") throw new LegacySectionError("legacy_section_invalid");

  if (previous.state === "no_section") {
    if (incoming.state === "ok") throw new LegacySectionError("legacy_section_forbidden");
    return;
  }

  if (incoming.state === "no_section") {
    throw new LegacySectionError("legacy_section_removal_forbidden");
  }

  const previousSlice = previousText.slice(previous.range.start, previous.range.end);
  const incomingSlice = incomingText.slice(incoming.range.start, incoming.range.end);
  if (incomingSlice !== previousSlice) throw new LegacySectionError("legacy_section_changed");
}
