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
