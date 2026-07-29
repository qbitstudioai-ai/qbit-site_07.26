import { cache } from "react";
import seedDepartments from "../../../data/departments.json";
import { departmentSchema, departmentsSchema } from "@/content/schema";
import type { Department, DepartmentId } from "@/content/types";
import { getDepartments as readDepartments, listAllDepartments } from "../repositories/departments";

/**
 * Публичный доступ к отделам.
 *
 * Порядок отделов и их системные идентификаторы задаёт схема контента (`DEPARTMENT_IDS`): к ним
 * привязаны зоны офиса, фотографии сцен и маршруты. Из базы приходит только текст.
 *
 * Если база ещё не заполнена (`npm run db:seed` не запускали), отдаются исходные тексты из
 * `data/departments.json` — пустой офис на главной был бы худшим из возможных состояний.
 */

const fallbackDepartments: Department[] = departmentsSchema.parse(seedDepartments);

/**
 * Содержимое отдела проверяется схемой ПРИ ЧТЕНИИ.
 *
 * `toDepartment` в репозитории превращает нечитаемую JSON-колонку в `{}` — молча и без признаков
 * беды. Дальше `PainGainPanel` берёт `painPoints[0].gain.length` и падает, а вместе с ним и главная
 * страница (найдено code review 2026-07-27). Это тот же класс отказа, что закрыт для `page_content`
 * в SEC-09, только цена выше: отдел показывается на главной.
 *
 * Негодная запись заменяется исходным текстом ЭТОГО ЖЕ отдела из seed — так зона офиса остаётся на
 * месте и посетитель видит осмысленный текст, а не пустоту. Подробности уходят в серверный лог без
 * значений полей.
 */
function validateDepartment(department: Department): Department | null {
  /**
   * Схема ОДНОГО отдела, а не коллекции.
   *
   * `departmentsSchema` — это `z.array(...).length(5)` плюс требование «все пять идентификаторов в
   * фиксированном порядке». Массив из одного элемента её не проходит НИКОГДА, поэтому первая
   * редакция этой проверки отправляла в ветку ошибки каждый отдел и подменяла seed-текстами весь
   * пользовательский контент: правки из админ-панели переставали появляться на сайте, а на каждый
   * рендер главной уходило пять `console.error`. Дефект был невидим, потому что содержимое базы
   * сейчас совпадает с seed. Найдено независимым ревью 2026-07-28.
   *
   * Коллекционные инварианты здесь неприменимы по существу: список опубликованных отделов может
   * быть неполным — именно это и означает снятие отдела с публикации.
   */
  const parsed = departmentSchema.safeParse(department);
  if (parsed.success) return parsed.data;

  const seed = fallbackDepartments.find((item) => item.id === department.id);
  console.error(
    `[departments] содержимое отдела «${department.id}» не соответствует схеме — ${
      seed ? "показан исходный текст" : "отдел скрыт"
    }. Поля: ${parsed.error.issues.map((issue) => issue.path.join(".")).join("; ")}`,
  );
  return seed ?? null;
}

export const getDepartments = cache((): Department[] => {
  const stored = readDepartments();

  /**
   * Пустой список означает РАЗНОЕ, и различать это обязательно.
   *
   * Если в таблице нет ни одной строки — базу ещё не заполняли (`npm run db:seed` не запускали), и
   * показать исходные тексты правильно: пустой офис на главной хуже.
   *
   * Если строки есть, но ни одна не опубликована — это осознанное решение владельца скрыть всё.
   * Подставлять seed здесь означало бы опубликовать демо-контент вопреки прямому действию в
   * админ-панели (найдено code review 2026-07-27).
   */
  if (stored.length === 0) {
    return listAllDepartments().length === 0 ? fallbackDepartments : [];
  }

  return stored
    .map(validateDepartment)
    .filter((department): department is Department => department !== null);
});

export function getDepartmentIds(): DepartmentId[] {
  return getDepartments().map((department) => department.id);
}

export function getDepartmentById(id: DepartmentId): Department | undefined {
  return getDepartments().find((department) => department.id === id);
}
