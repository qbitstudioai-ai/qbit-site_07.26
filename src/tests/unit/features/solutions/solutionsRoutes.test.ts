import { describe, expect, it } from "vitest";
import seedDepartments from "../../../../../data/departments.json";
import { DEPARTMENT_IDS, SOLUTION_PATH_BY_DEPARTMENT_ID } from "@/content/schema";
import type { Department, DepartmentId } from "@/content/types";
import {
  departmentIdBySolutionSlug,
  SOLUTION_SLUG_BY_DEPARTMENT_ID,
  solutionPath,
  solutionUrl,
} from "@/features/solutions/solutionsRoutes";
import { SITE_URL } from "@/lib/seo";

/**
 * Адреса раздела «Решения».
 *
 * Главное, что здесь проверяется, — что источник истины ОДИН. `solutionPath` объявлен таблицей в
 * схеме контента, записан полем у каждого отдела и разобран на сегменты модулем маршрутов. Три
 * представления одного и того же факта обязаны совпадать; разъехавшись, они дали бы страницу по
 * одному адресу, canonical по второму и строку карты сайта по третьему.
 */

const departments = seedDepartments as unknown as Department[];
const slugs = Object.values(SOLUTION_SLUG_BY_DEPARTMENT_ID);

describe("адреса раздела «Решения»", () => {
  it("описывает ровно пять отделов", () => {
    expect(slugs).toHaveLength(5);
    expect(Object.keys(SOLUTION_SLUG_BY_DEPARTMENT_ID).sort()).toEqual([...DEPARTMENT_IDS].sort());
  });

  it("сегменты уникальны — два отдела не могут делить один адрес", () => {
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  /**
   * Пара `executive ↔ management` — единственное место, где идентификатор отдела не равен сегменту
   * его адреса. Это не рассинхрон: идентификатор — первичный ключ, к которому привязаны зона офиса,
   * сцена и связи материалов, а `management` — публичное слово, утверждённое таблицей адресов с
   * самого начала. Тест закрепляет обе стороны, чтобы ни одну нельзя было «починить» по отдельности.
   */
  it("отображает executive на management в обе стороны", () => {
    expect(SOLUTION_SLUG_BY_DEPARTMENT_ID.executive).toBe("management");
    expect(departmentIdBySolutionSlug("management")).toBe("executive");

    // Обратное направление тоже обязано отсутствовать: адреса `/solutions/executive` не существует.
    expect(departmentIdBySolutionSlug("executive")).toBeNull();
  });

  it("каждый сегмент разрешается обратно в свой отдел", () => {
    for (const id of DEPARTMENT_IDS) {
      const slug = SOLUTION_SLUG_BY_DEPARTMENT_ID[id];
      expect(departmentIdBySolutionSlug(slug), slug).toBe(id);
    }
  });

  it("неизвестный сегмент даёт null, а не исключение и не чужой отдел", () => {
    for (const unknown of ["", "sale", "Sales", "sales/", "../sales", "departments", "task"]) {
      expect(departmentIdBySolutionSlug(unknown), unknown).toBeNull();
    }
  });

  /**
   * Форма адреса. Проверяется здесь, а не в схеме, потому что именно из неё модуль маршрутов
   * выводит сегмент: адрес с лишним уровнем вложенности дал бы сегмент, которого не существует в
   * маршруте `/solutions/[slug]`, и страница отвечала бы 404 при формально верной таблице.
   */
  it("каждый утверждённый адрес имеет вид /solutions/<slug>", () => {
    for (const id of DEPARTMENT_IDS) {
      const path = SOLUTION_PATH_BY_DEPARTMENT_ID[id];
      expect(path, id).toMatch(/^\/solutions\/[a-z][a-z0-9-]*$/);
      expect(path, id).toBe(`/solutions/${SOLUTION_SLUG_BY_DEPARTMENT_ID[id]}`);
    }
  });

  /**
   * Поле отдела и таблица схемы — один и тот же факт. Их совпадение уже требует `superRefine`
   * схемы при чтении из базы; здесь оно закрепляется для исходных данных, из которых база
   * наполняется.
   */
  it("solutionPath каждого отдела совпадает с утверждённой таблицей адресов", () => {
    expect(departments).toHaveLength(5);

    for (const department of departments) {
      expect(department.solutionPath, department.id).toBe(
        SOLUTION_PATH_BY_DEPARTMENT_ID[department.id as DepartmentId],
      );
      expect(solutionPath(department), department.id).toBe(department.solutionPath);
    }
  });

  it("абсолютный адрес — основной домен, без строки запроса и якоря", () => {
    for (const department of departments) {
      const url = solutionUrl(department);

      expect(url, department.id).toBe(`${SITE_URL}${department.solutionPath}`);
      expect(url, department.id).toMatch(/^https:\/\/allqbit\.ru\/solutions\/[a-z-]+$/);
      expect(url).not.toContain("?");
      expect(url).not.toContain("#");
    }
  });

  it("не заводит параллельного пространства адресов /departments/*", () => {
    for (const department of departments) {
      expect(solutionUrl(department)).not.toContain("/departments/");
    }
  });
});
