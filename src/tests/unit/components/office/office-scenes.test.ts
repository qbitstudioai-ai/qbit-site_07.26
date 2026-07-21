import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { officeSceneById, OFFICE_SCENE_WIDTHS } from "@/components/office/departmentPhotos";
import { buildOfficeSections } from "@/features/office-machine/sections";
import { getDepartments } from "@/content/departments";
import { getHomepageCopy } from "@/content/homepage-copy";
import { DEPARTMENT_IDS } from "@/content/schema";

// Step 10 (AC4): каталог сцен связывает id сцены с адаптивными производными
// (src/assets/office-photos/${sceneId}-${width}.{avif,webp}). Как и тест миниатюр в
// content/departments.test.ts, этот тест работает по ИСХОДНОМУ ТЕКСТУ файла: схема именования сама
// кодирует id сцены, формат и ширину, поэтому проверяем, что officeSceneById[sceneId][format] связан
// именно с импортами файлов этой же сцены, формата и ширины в правильном порядке — перепутанное
// присваивание (напр. `sales: { avif: [support...] }`, спутанные форматы или ширины) иначе осталось
// бы незамеченным (runtime-значения image-импортов в Vite — строки-URL, а не объекты, поэтому
// проверка по тексту надёжнее рантайм-проверки размеров).
//
// Step 18: каталог переехал в officeScenes.ts и СГЕНЕРИРОВАН из scripts/office-scenes.config.mjs.
// Поэтому список сцен здесь больше не прибит константой, а читается из того же конфига: тест стал
// сторожем РАССИНХРОНА (конфиг правили, `npm run assets:scenes` не запускали), а не копией списка.
// Прежняя редакция фиксировала ровно шесть сцен и упала бы на добавлении седьмой — то есть сама
// была одной из трёх точек правки, которые шаг убирает.

// Ids читаются регуляркой, а не импортом .mjs: у конфига нет типов, и import сломал бы typecheck.
const configSource = readFileSync(
  path.resolve(process.cwd(), "scripts/office-scenes.config.mjs"),
  "utf-8",
);
const SCENE_IDS = [...configSource.matchAll(/\bid:\s*"([^"]+)"/g)].map((match) => match[1]);
const FORMATS = ["avif", "webp"] as const;

const source = readFileSync(
  path.resolve(process.cwd(), "src/components/office/officeScenes.ts"),
  "utf-8",
);

// varName → относительный путь импорта.
const importPathByVar = new Map<string, string>();
for (const match of source.matchAll(/import\s+(\w+)\s+from\s+["']([^"']+)["']/g)) {
  importPathByVar.set(match[1], match[2]);
}

function sceneBlock(sceneId: string): string {
  const blockMatch = source.match(new RegExp(`\\b${sceneId}:\\s*\\{([\\s\\S]*?)\\}`));
  expect(
    blockMatch,
    `officeSceneById["${sceneId}"] block not found in officeScenes.ts`,
  ).not.toBeNull();
  return blockMatch![1];
}

function varsForFormat(block: string, sceneId: string, format: string): string[] {
  const arrayMatch = block.match(new RegExp(`${format}:\\s*\\[([^\\]]*)\\]`));
  expect(arrayMatch, `officeSceneById["${sceneId}"].${format} array not found`).not.toBeNull();
  return arrayMatch![1]
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

describe("officeSceneById adaptive scene mapping (Step 10)", () => {
  // Сторож рассинхрона: сгенерированный каталог обязан покрывать РОВНО список сцен из конфига.
  it("exposes exactly the scenes declared in office-scenes.config.mjs", () => {
    expect(SCENE_IDS.length, "не удалось прочитать список сцен из конфига").toBeGreaterThan(0);
    expect(Object.keys(officeSceneById).sort()).toEqual([...SCENE_IDS].sort());
  });

  // ...и продолжает содержать мастер-сцену плюс сцену на каждый отдел. Без этой проверки каталог,
  // согласованный сам с собой, но потерявший отдел, прошёл бы предыдущий тест.
  //
  // ВКЛЮЧЕНИЕ, а не равенство, и это ровно то, ради чего пункт «каталог сцен» был в scope шага.
  // Первая редакция писала здесь `toEqual([...])`, то есть точное равенство МНОЖЕСТВ, включая длину:
  // добавление седьмой сцены уронило бы этот тест, и «одна точка правки» превратилась бы в две —
  // конфиг и тест. Дефект, который шаг должен был убрать, был бы просто перенесён в новую форму
  // (поймано skeptic-ревью Step 18, находка B1). Требование же здесь другое и от числа сцен не
  // зависит: каталог обязан СОДЕРЖАТЬ мастер-сцену и сцену каждого отдела, а сверх того — сколько
  // угодно.
  it("still covers the overview master scene and every department", () => {
    expect(SCENE_IDS).toEqual(expect.arrayContaining(["overview", ...DEPARTMENT_IDS]));
  });

  /**
   * Сторож, обещанный док-комментарием `sections.ts` (поле `sceneId`), — до skeptic-ревью Step 18
   * он был ОБЕЩАН, но не написан (находка B3).
   *
   * Обещание не риторическое: до Step 18 сцена выводилась выражением
   * `activeDepartment ? activeDepartment.id : "overview"` и была типизирована целиком. Реестр
   * объявляет `sceneId: string` намеренно — слой машины состояний не должен зависеть от каталога
   * изображений, — но платой за это стал непроверяемый компилятором каст `as OfficeSceneId` в
   * `OfficeExperience`. Без этого теста опечатка в будущей записи реестра дала бы
   * `officeSceneById[bad] === undefined`, разыменование `sources.webp` и падение всего офиса в
   * рантайме — вместо ошибки сборки. Тест возвращает ту гарантию, только на другом этапе.
   */
  it("keeps every sceneId in the office section registry resolvable in the catalog", () => {
    const sections = buildOfficeSections(getDepartments(), getHomepageCopy().taskSection);
    expect(sections.length).toBeGreaterThan(0);
    for (const section of sections) {
      expect(
        Object.keys(officeSceneById),
        `раздел "${section.id}" ссылается на сцену "${section.sceneId}", которой нет в каталоге`,
      ).toContain(section.sceneId);
    }
  });

  it("declares the agreed widths 768/1280/1536 in ascending order", () => {
    expect([...OFFICE_SCENE_WIDTHS]).toEqual([768, 1280, 1536]);
  });

  it.each(SCENE_IDS)(
    "binds scene '%s' to its own AVIF+WebP derivatives at each width, not swapped ones",
    (sceneId) => {
      const block = sceneBlock(sceneId);

      for (const format of FORMATS) {
        const vars = varsForFormat(block, sceneId, format);
        expect(
          vars.length,
          `officeSceneById["${sceneId}"].${format} must list one variable per width`,
        ).toBe(OFFICE_SCENE_WIDTHS.length);

        vars.forEach((varName, index) => {
          const importPath = importPathByVar.get(varName);
          expect(
            importPath,
            `variable "${varName}" used in officeSceneById["${sceneId}"].${format} is not imported`,
          ).toBeDefined();

          const expectedWidth = OFFICE_SCENE_WIDTHS[index];
          const expectedSuffix = `${sceneId}-${expectedWidth}.${format}`;
          expect(
            importPath!.endsWith(expectedSuffix),
            `officeSceneById["${sceneId}"].${format}[${index}] resolves to "${importPath}", ` +
              `expected an import ending in "${expectedSuffix}" — possible swapped scene/format/width`,
          ).toBe(true);
        });
      }
    },
  );
});
