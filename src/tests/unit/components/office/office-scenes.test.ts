import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { officeSceneById, OFFICE_SCENE_WIDTHS } from "@/components/office/departmentPhotos";
import { DEPARTMENT_IDS } from "@/content/schema";

// Step 10 (AC4): departmentPhotos.ts импортирует адаптивные производные сцен
// (src/assets/office-photos/${sceneId}-${width}.{avif,webp}), порождённые
// scripts/generate-office-images.mjs. Как и тест миниатюр в content/departments.test.ts, этот тест
// работает по ИСХОДНОМУ ТЕКСТУ файла: схема именования сама кодирует id сцены, формат и ширину,
// поэтому проверяем, что officeSceneById[sceneId][format] связан именно с импортами файлов этой же
// сцены, формата и ширины в правильном порядке — перепутанное присваивание (напр.
// `sales: { avif: [support...] }`, спутанные форматы или ширины) иначе осталось бы незамеченным
// (runtime-значения image-импортов в Vite — строки-URL, а не объекты, поэтому проверка по тексту
// надёжнее рантайм-проверки размеров).

const SCENE_IDS = ["overview", ...DEPARTMENT_IDS] as const;
const FORMATS = ["avif", "webp"] as const;

const source = readFileSync(
  path.resolve(process.cwd(), "src/components/office/departmentPhotos.ts"),
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
    `officeSceneById["${sceneId}"] block not found in departmentPhotos.ts`,
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
  it("exposes exactly the overview master scene plus the 5 department scenes", () => {
    expect(Object.keys(officeSceneById).sort()).toEqual([...SCENE_IDS].sort());
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
