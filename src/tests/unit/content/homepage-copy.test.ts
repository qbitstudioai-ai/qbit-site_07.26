import { describe, expect, it } from "vitest";
import { getHomepageCopy } from "@/content/homepage-copy";

describe("homepage-copy adapter", () => {
  // Пункт «Контакты» указывал на href="#", хотя маршрут /contacts существует и отдаёт 200.
  // Тест закрепляет реальный адрес и запрещает вернуть заглушку "#" в общее меню.
  it("points every header link at a real destination, including Контакты", () => {
    const { heroLinks } = getHomepageCopy();
    const contacts = heroLinks.find((link) => link.label === "Контакты");
    expect(contacts).toBeDefined();
    expect(contacts?.href).toBe("/contacts");
    expect(heroLinks.filter((link) => link.href === "#")).toEqual([]);
    for (const link of heroLinks) {
      expect(link.href.startsWith("/") || link.href.startsWith("http")).toBe(true);
    }
  });

  it("returns the expected shape from real data", () => {
    const copy = getHomepageCopy();
    expect(copy.eyebrow.length).toBeGreaterThan(0);
    expect(copy.headline).toBeTypeOf("string");
    expect(copy.headline.length).toBeGreaterThan(0);
    expect(copy.subheadline.length).toBeGreaterThan(0);
    expect(copy.primaryCta.length).toBeGreaterThan(0);
    expect(copy.secondaryCta.length).toBeGreaterThan(0);
    expect(copy.interactionHint.length).toBeGreaterThan(0);
    expect(Array.isArray(copy.valuePoints)).toBe(true);
    expect(copy.valuePoints.length).toBeGreaterThan(0);
    for (const point of copy.valuePoints) {
      expect(point.length).toBeGreaterThan(0);
    }
    expect(copy.heroInfoPanel.scenarios).toHaveLength(3);
    for (const scenario of copy.heroInfoPanel.scenarios) {
      expect(scenario.metric.length).toBeGreaterThan(0);
      expect(scenario.effectLabel).toMatch(/^Расчётн/);
    }
    expect(copy.heroInfoPanel.postscript.ariaLabel.length).toBeGreaterThan(0);
    expect(copy.officeOverview.leftStory.paragraphs).toHaveLength(2);
    expect(copy.officeOverview.rightStory.paragraphs).toHaveLength(2);
    expect(copy.returnToOfficeLabel.length).toBeGreaterThan(0);
  });

  it("keeps the approved office overview actions and editorial headings verbatim", () => {
    const copy = getHomepageCopy();
    expect(copy.returnToOfficeLabel).toBe("← На главную");
    expect(copy.officeOverview.instruction).toBe("Выберите отдел");
    expect(JSON.stringify(copy.officeOverview)).not.toContain("Наведи курсор на область офиса");
    expect(copy.taskSection.overviewCtaLabel).toBe("Получить бесплатный разбор");
    expect(copy.officeOverview.ctaAccessibleLabel).toBe("Получить бесплатный разбор процессов");
    expect(copy.officeOverview.leftStory.title).toBe("Где незаметно теряются ресурсы");
    expect(copy.officeOverview.rightStory.title).toBe("Когда процессы работают как система");
  });

  it("keeps the approved first-screen offer verbatim", () => {
    const copy = getHomepageCopy();
    expect(copy.headerPhoneAccessibleLabel).toBe("Позвонить по номеру +7 937 534-65-75.");
    expect(copy.headline).toBe("Автоматизируем продажи, поддержку и документы с помощью ИИ");
    expect(copy.subheadline).toBe(
      "Находим ручные операции и потери между системами. Внедряем автоматизацию, которая ускоряет обработку заявок, снижает ошибки и освобождает сотрудников от рутины.",
    );
    expect(copy.valuePoints).toEqual([
      "Быстрее заявки",
      "Меньше ручной работы",
      "Меньше ошибок",
      "Больше контроля",
    ]);
    expect(copy.primaryCta).toBe("Получить бесплатный разбор процессов");
    expect(copy.secondaryCta).toBe("Найти потери в своём отделе");
  });

  it("keeps project scenarios explicitly calculated rather than presenting them as cases", () => {
    const copy = getHomepageCopy();
    expect(copy.heroInfoPanel.title).toBe("ПРОЕКТНЫЕ СЦЕНАРИИ");
    expect(copy.heroInfoPanel.subtitle).toBe("Примеры решений и расчётный бизнес-эффект");
    expect(copy.heroInfoPanel.scenarios.map((scenario) => scenario.metric)).toEqual([
      "20–25",
      "700 000",
      "75–80",
    ]);
    expect(copy.heroInfoPanel.scenarios.slice(1).map((scenario) => scenario.metricPrefix)).toEqual([
      "до",
      "до",
    ]);
    expect(copy.heroInfoPanel.scenarios[1].qualifier).toBe("потенциальной выручки");
  });
});
