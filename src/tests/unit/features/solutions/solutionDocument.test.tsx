import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import seedDepartments from "../../../../../data/departments.json";
import type { Department } from "@/content/types";
import { SolutionDocument } from "@/features/solutions/SolutionDocument";

const departments = seedDepartments as unknown as Department[];
const CONTACT_HREF = "https://t.me/Promt_Pavel";

/**
 * ПОЛНОТА ДОКУМЕНТА — главное требование шага, и этот файл её сторожит.
 *
 * До DEPT-SEO.2A содержимое отдела существовало только как состояние главной, и часть текста в
 * серверный HTML не попадала вовсе. Измерено на production 2026-09-16 по `/?department=sales`:
 * пять `pain` присутствовали, но лишь ОДНА из пяти `gain`, ноль из четырёх `customerBenefits` и ни
 * одного CTA — остальное лежало внутри RSC-payload, то есть внутри `<script>`, и содержимым
 * страницы не являлось.
 *
 * Поэтому проверки ниже сделаны СРАЗУ после `render`, без `findBy*`, без `waitFor` и без таймеров:
 * текст обязан быть в разметке с первого кадра. Если кто-нибудь однажды вернёт сюда постепенное
 * раскрытие (`useEffect` + `setTimeout`, как в `CustomerBenefits`), эти тесты упадут — в этом их
 * единственное назначение.
 */
describe("SolutionDocument", () => {
  it.each(departments.map((department) => [department.id, department] as const))(
    "%s: весь текст отдела присутствует в разметке сразу",
    (_id, department) => {
      render(<SolutionDocument department={department} contactHref={CONTACT_HREF} />);

      // Заголовок документа — ровно один H1, и это название отдела.
      const headings1 = screen.getAllByRole("heading", { level: 1 });
      expect(headings1).toHaveLength(1);
      expect(headings1[0]).toHaveTextContent(department.name);

      expect(screen.getByText(department.headline)).toBeInTheDocument();
      expect(screen.getByText(department.problem)).toBeInTheDocument();

      // Все пять пар «боль → выгода», а не только выбранная.
      for (const point of department.painPoints) {
        expect(
          screen.getByRole("heading", { level: 2, name: point.pain }),
          `нет боли: ${point.pain}`,
        ).toBeInTheDocument();
        expect(screen.getByText(point.gain), `нет выгоды: ${point.gain}`).toBeInTheDocument();
      }

      // Каждый существующий `howItWorks`. Отсутствующий не подменяется заглушкой.
      for (const point of department.painPoints) {
        if (!point.howItWorks) continue;
        expect(screen.getByText(point.howItWorks)).toBeInTheDocument();
      }

      // Все четыре результата для бизнеса.
      const benefits = screen.getByRole("list");
      for (const benefit of department.customerBenefits) {
        expect(
          within(benefits).getByText(benefit),
          `нет результата: ${benefit}`,
        ).toBeInTheDocument();
      }
      expect(within(benefits).getAllByRole("listitem")).toHaveLength(
        department.customerBenefits.length,
      );

      // CTA виден сразу и ведёт в единый контакт сайта.
      const cta = screen.getByRole("link", { name: department.ctaLabel });
      expect(cta).toHaveAttribute("href", CONTACT_HREF);
      expect(cta).toHaveAttribute("rel", "noopener noreferrer");
    },
  );

  it("не пропускает ни одной пары «боль → выгода»", () => {
    const department = departments[0];
    render(<SolutionDocument department={department} contactHref={CONTACT_HREF} />);

    // H2 ровно столько, сколько пар болей, плюс один заголовок блока результатов.
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(
      department.painPoints.length + 1,
    );
  });

  it("использует существующую подпись блока результатов, а не новую формулировку", () => {
    const department = departments[0];
    render(<SolutionDocument department={department} contactHref={CONTACT_HREF} />);

    // Строка взята дословно из `CustomerBenefits.tsx` — нового текста на странице нет.
    expect(
      screen.getByRole("heading", { level: 2, name: "Результат для бизнеса" }),
    ).toBeInTheDocument();
  });

  it("не показывает текста, которого нет в данных отдела", () => {
    const department = departments.find((item) => item.id === "sales")!;
    const { container } = render(
      <SolutionDocument department={department} contactHref={CONTACT_HREF} />,
    );

    /**
     * Весь видимый текст документа обязан находиться в самом отделе. Исключения перечислены явно и
     * их ровно два — обе подписи скопированы дословно из уже работающих компонентов офиса
     * (`PainGainPanel.tsx`/`MobilePainGainAccordion.tsx` и `CustomerBenefits.tsx`), а не сочинены
     * для этой страницы.
     */
    const ownStrings = new Set<string>([
      department.name,
      department.headline,
      department.problem,
      department.ctaLabel,
      ...department.painPoints.flatMap((point) =>
        [point.pain, point.gain, point.howItWorks].filter((value): value is string =>
          Boolean(value),
        ),
      ),
      ...department.customerBenefits,
    ]);
    const borrowedLabels = new Set(["Как работает", "Результат для бизнеса"]);

    const textNodes: string[] = [];
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const value = node.textContent?.trim();
      if (value) textNodes.push(value);
    }

    expect(textNodes.length).toBeGreaterThan(0);
    for (const value of textNodes) {
      expect(
        ownStrings.has(value) || borrowedLabels.has(value),
        `посторонний текст на странице: «${value}»`,
      ).toBe(true);
    }
  });
});

/**
 * Блоки перелинковки на странице отдела (SOL-OUT-02).
 *
 * Данные здесь ТЕСТОВЫЕ и намеренно не совпадают с утверждёнными 11 связями: механизм обязан
 * работать сам по себе, без единой production-связи в базе. Сами связи — задача SOL-OUT-03.
 */
const SALES = departments.find((department) => department.id === "sales") as Department;

const PRODUCT_MATERIAL = {
  type: "product",
  id: "product-03",
  slug: "leads-to-crm",
  title: "Единый сбор заявок в CRM",
  href: "/products/leads-to-crm",
  summary: "Система собирает обращения из разных каналов и создаёт сделки в CRM.",
} as const;

const CASE_MATERIAL = {
  type: "case",
  id: "case-leads",
  slug: "sbor-zayavok-v-crm",
  title: "Сбор заявок из почты и мессенджеров в CRM",
  href: "/cases/sbor-zayavok-v-crm",
  summary: null,
} as const;

describe("SolutionDocument: связанные материалы", () => {
  it("без связей не показывает ни одной секции перелинковки", () => {
    render(<SolutionDocument department={SALES} contactHref={CONTACT_HREF} />);

    expect(screen.queryByRole("heading", { name: "Подходящие решения" })).toBeNull();
    expect(screen.queryByRole("heading", { name: /Пример(ы)? внедрения/u })).toBeNull();
    // Ни одной ссылки в разделы продуктов и кейсов — значит и пустой рамки нет.
    expect(screen.queryByRole("link", { name: /Продукт|Кейс/u })).toBeNull();
  });

  it("пустой список материалов равнозначен их отсутствию", () => {
    render(
      <SolutionDocument department={SALES} contactHref={CONTACT_HREF} relatedMaterials={[]} />,
    );

    expect(screen.queryByRole("heading", { name: "Подходящие решения" })).toBeNull();
    expect(screen.queryByRole("heading", { name: /Пример(ы)? внедрения/u })).toBeNull();
  });

  it("только продукты: блок кейсов не появляется", () => {
    render(
      <SolutionDocument
        department={SALES}
        contactHref={CONTACT_HREF}
        relatedMaterials={[PRODUCT_MATERIAL]}
      />,
    );

    expect(screen.getByRole("heading", { name: "Подходящие решения" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Пример(ы)? внедрения/u })).toBeNull();
  });

  it("показывает карточки с названием, описанием и каноническим адресом", () => {
    render(
      <SolutionDocument
        department={SALES}
        contactHref={CONTACT_HREF}
        relatedMaterials={[PRODUCT_MATERIAL, CASE_MATERIAL]}
      />,
    );

    const productLink = screen.getByRole("link", { name: /Единый сбор заявок в CRM/u });
    expect(productLink).toHaveAttribute("href", "/products/leads-to-crm");
    expect(within(productLink).getByText("Продукт")).toBeInTheDocument();
    expect(within(productLink).getByText(PRODUCT_MATERIAL.summary)).toBeInTheDocument();

    const caseLink = screen.getByRole("link", { name: /Сбор заявок из почты/u });
    expect(caseLink).toHaveAttribute("href", "/cases/sbor-zayavok-v-crm");
    expect(within(caseLink).getByText("Кейс")).toBeInTheDocument();
  });

  it("один кейс называется «Пример внедрения», несколько — «Примеры внедрения»", () => {
    const { unmount } = render(
      <SolutionDocument
        department={SALES}
        contactHref={CONTACT_HREF}
        relatedMaterials={[CASE_MATERIAL]}
      />,
    );
    expect(screen.getByRole("heading", { name: "Пример внедрения" })).toBeInTheDocument();
    unmount();

    render(
      <SolutionDocument
        department={SALES}
        contactHref={CONTACT_HREF}
        relatedMaterials={[CASE_MATERIAL, { ...CASE_MATERIAL, id: "case-calls", href: "/cases/x" }]}
      />,
    );
    expect(screen.getByRole("heading", { name: "Примеры внедрения" })).toBeInTheDocument();
  });

  it("карточка кейса не несёт ни одной цифры результата", () => {
    /**
     * Сторож копирайта. Подпись кейса — только его краткое название; измеренный результат
     * конкретного внедрения на странице отдела читался бы как обещание того же результата.
     */
    const { container } = render(
      <SolutionDocument
        department={SALES}
        contactHref={CONTACT_HREF}
        relatedMaterials={[CASE_MATERIAL]}
      />,
    );

    const block = container.querySelector("section[aria-labelledby='solution-cases-heading']");
    expect(block).not.toBeNull();
    expect(block?.textContent ?? "").not.toMatch(/\d/u);
  });

  it("перелинковка стоит после результатов для бизнеса и до призыва к действию", () => {
    const { container } = render(
      <SolutionDocument
        department={SALES}
        contactHref={CONTACT_HREF}
        relatedMaterials={[PRODUCT_MATERIAL, CASE_MATERIAL]}
      />,
    );

    const text = container.textContent ?? "";
    const benefits = text.indexOf("Результат для бизнеса");
    const products = text.indexOf("Подходящие решения");
    const cases = text.indexOf("Пример внедрения");
    const cta = text.indexOf(SALES.ctaLabel);

    expect(benefits).toBeGreaterThanOrEqual(0);
    expect(benefits).toBeLessThan(products);
    expect(products).toBeLessThan(cases);
    expect(cases).toBeLessThan(cta);
  });

  it("не добавляет второго H1 и держит секции на уровне H2", () => {
    render(
      <SolutionDocument
        department={SALES}
        contactHref={CONTACT_HREF}
        relatedMaterials={[PRODUCT_MATERIAL, CASE_MATERIAL]}
      />,
    );

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(
      screen.getByRole("heading", { level: 2, name: "Подходящие решения" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Пример внедрения" })).toBeInTheDocument();
  });
});
