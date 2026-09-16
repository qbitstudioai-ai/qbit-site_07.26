import { describe, expect, it } from "vitest";
import seedDepartments from "../../../../../data/departments.json";
import type { Department } from "@/content/types";
import { solutionUrl } from "@/features/solutions/solutionsRoutes";
import {
  NOT_FOUND_ROBOTS,
  SOLUTION_TITLE_SUBJECT,
  solutionSeoDescription,
  solutionSeoTitle,
  solutionStructuredData,
} from "@/features/solutions/solutionsSeo";
import { ORGANIZATION_ID, SITE_NAME, SITE_URL, WEBSITE_ID } from "@/lib/seo";

const departments = seedDepartments as unknown as Department[];

/** Типы узлов, которые странице отдела разрешены. Список закрытый — см. проверку ниже. */
const ALLOWED_NODE_TYPES = ["BreadcrumbList", "WebPage", "Organization"] as const;

/**
 * Типы, появление которых означало бы заявление о несуществующем факте: коммерческое предложение
 * без цены и условий, вопросы-ответы там, где их нет, инструкция вместо технической цепочки,
 * отзывы и оценки, которых не существует.
 */
const FORBIDDEN_NODE_TYPES = [
  "Service",
  "Offer",
  "AggregateOffer",
  "FAQPage",
  "Question",
  "Answer",
  "HowTo",
  "HowToStep",
  "Review",
  "AggregateRating",
  "Product",
  "Article",
] as const;

describe("SEO страницы отдела", () => {
  describe("заголовок выдачи", () => {
    it("собирается утверждённой формулой «<Отдел>: <предмет> — <бренд>»", () => {
      for (const department of departments) {
        expect(solutionSeoTitle(department), department.id).toBe(
          `${department.name}: ${SOLUTION_TITLE_SUBJECT} — ${SITE_NAME}`,
        );
      }
    });

    it("не сводится к одному названию отдела", () => {
      // Регрессия против «Продажи — QBit-Studio-Ai»: одно название отдела не отвечает ни на один
      // поисковый запрос, ради которого страница создаётся.
      for (const department of departments) {
        expect(solutionSeoTitle(department), department.id).not.toBe(
          `${department.name} — ${SITE_NAME}`,
        );
      }
    });

    it("уникален у всех пяти страниц", () => {
      const titles = departments.map(solutionSeoTitle);
      expect(new Set(titles).size).toBe(titles.length);
    });

    it("содержит название компании ровно один раз", () => {
      for (const department of departments) {
        const occurrences = solutionSeoTitle(department).split(SITE_NAME).length - 1;
        expect(occurrences, department.id).toBe(1);
      }
    });

    it("одинаково формулирует предмет на всех страницах", () => {
      // Различающийся по отделам «предмет» был бы уже описанием отдела, то есть новым
      // маркетинговым текстом, которого в этом шаге быть не должно.
      for (const department of departments) {
        expect(solutionSeoTitle(department)).toContain(SOLUTION_TITLE_SUBJECT);
      }
    });
  });

  describe("описание", () => {
    it("совпадает с `problem` отдела ДОСЛОВНО", () => {
      for (const department of departments) {
        expect(solutionSeoDescription(department), department.id).toBe(department.problem);
      }
    });

    it("не обрезается и не дополняется", () => {
      for (const department of departments) {
        const description = solutionSeoDescription(department);
        expect(description.length, department.id).toBe(department.problem.length);
        expect(description.endsWith("…"), department.id).toBe(false);
      }
    });
  });

  describe("robots несуществующего отдела", () => {
    /**
     * Закрепляется ЗНАЧЕНИЕ константы, и только оно.
     *
     * Что реально уезжает в ответ на несуществующий адрес, этот тест не доказывает: `notFound()`
     * заменяет метаданные страницы собственным `noindex` Next.js. Фактический вывод проверяется в
     * `src/tests/e2e/solutions-pages.spec.ts` («несуществующий сегмент отвечает 404»), где ответ
     * читается с работающего сервера.
     */
    it("закрывает индексирование, но не обход", () => {
      expect(NOT_FOUND_ROBOTS.index).toBe(false);
      expect(NOT_FOUND_ROBOTS.follow).toBe(true);
    });
  });

  describe("разметка schema.org", () => {
    it("состоит ровно из BreadcrumbList, WebPage и Organization", () => {
      for (const department of departments) {
        const types = solutionStructuredData(department).map((node) => node["@type"]);
        expect(types, department.id).toEqual([...ALLOWED_NODE_TYPES]);
      }
    });

    it("не содержит ни одного запрещённого типа и ни одной выдуманной даты", () => {
      for (const department of departments) {
        const serialized = JSON.stringify(solutionStructuredData(department));

        for (const forbidden of FORBIDDEN_NODE_TYPES) {
          expect(serialized, `${department.id}: ${forbidden}`).not.toContain(`"${forbidden}"`);
        }

        // Подтверждённой даты публикации отдела не существует; `updated_at` неправленой записи
        // равен моменту `db:seed`. В разметке страницы такая дата читалась бы как дата обновления
        // документа — то есть как факт, которого нет.
        expect(serialized, department.id).not.toContain("datePublished");
        expect(serialized, department.id).not.toContain("dateModified");
        expect(serialized, department.id).not.toContain("datePosted");
      }
    });

    it("описывает путь двумя ступенями и не изобретает раздел /solutions", () => {
      for (const department of departments) {
        const [breadcrumb] = solutionStructuredData(department);
        const items = (breadcrumb as { itemListElement: { name: string; item: string }[] })
          .itemListElement;

        expect(items, department.id).toHaveLength(2);
        expect(items[0]).toMatchObject({ position: 1, name: "Главная", item: SITE_URL });
        expect(items[1]).toMatchObject({
          position: 2,
          name: department.name,
          item: solutionUrl(department),
        });

        // Промежуточной страницы `/solutions` не существует — ступени с её адресом быть не должно.
        expect(items.map((item) => item.item)).not.toContain(`${SITE_URL}/solutions`);
      }
    });

    it("указывает тот же адрес, что canonical, и связывает страницу с сайтом и организацией", () => {
      for (const department of departments) {
        const [, webPage, organization] = solutionStructuredData(department);
        const url = solutionUrl(department);

        expect(webPage).toMatchObject({
          "@type": "WebPage",
          "@id": `${url}#webpage`,
          url,
          name: solutionSeoTitle(department),
          description: solutionSeoDescription(department),
          inLanguage: "ru-RU",
          isPartOf: { "@id": WEBSITE_ID },
          publisher: { "@id": ORGANIZATION_ID },
        });

        // Организация — та же сущность графа, что на остальных страницах: общий `@id`, а не
        // однофамилец с тем же названием.
        expect(organization).toMatchObject({ "@type": "Organization", "@id": ORGANIZATION_ID });
      }
    });
  });
});
