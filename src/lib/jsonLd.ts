/**
 * Безопасная сериализация JSON-LD для вставки в `<script type="application/ld+json">`.
 *
 * `JSON.stringify` экранирует кавычки и обратные слэши, но НЕ трогает `<`. HTML-парсер завершает
 * блок `<script>` на первой же последовательности `</script`, где бы она ни встретилась — в том
 * числе внутри строкового литерала JSON. Поэтому заголовок статьи вида
 *
 *     Название</script><script>…</script>
 *
 * введённый в админ-панели, вырывался из блока и исполнялся у КАЖДОГО посетителя раздела.
 * Экранирование `<` как `<` закрывает это: escape-последовательность корректна по JSON,
 * `JSON.parse` возвращает исходный символ, и разметка schema.org не меняется.
 *
 * Заодно экранируются `>` и `&` (безопасность внутри HTML-комментария, где действуют отдельные
 * правила разбора) и U+2028/U+2029 — они допустимы в JSON, но обрывают строку в JavaScript.
 *
 * Символы заданы КОДАМИ, а не литералами: U+2028 и U+2029 невидимы в редакторе, и литерал
 * ломался бы при правке файла незаметно.
 */

const ESCAPED_CODES = new Map<number, string>([
  [0x3c, "\\u003c"], // <
  [0x3e, "\\u003e"], // >
  [0x26, "\\u0026"], // &
  [0x2028, "\\u2028"], // LINE SEPARATOR
  [0x2029, "\\u2029"], // PARAGRAPH SEPARATOR
]);

// Класс символов собирается из тех же кодов, что и таблица замен: два списка не могут разойтись.
const HTML_SENSITIVE = new RegExp(
  `[${[...ESCAPED_CODES.keys()].map((code) => `\\u${code.toString(16).padStart(4, "0")}`).join("")}]`,
  "g",
);

export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(
    HTML_SENSITIVE,
    (character) => ESCAPED_CODES.get(character.codePointAt(0) ?? 0) ?? character,
  );
}
