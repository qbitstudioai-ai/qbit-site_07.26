// Step 18 — генерация TS-каталога сцен офиса из единственного списка (./office-scenes.config.mjs).
//
// Отдельная команда, а не часть генератора картинок, и это важно практически: генератор пересжимает
// все производные через sharp, поэтому его прогон ради одной новой строки каталога переписал бы
// десятки бинарных файлов (кодеки не гарантируют байт-идентичность между версиями libvips). Каталог
// же — чистая функция от списка сцен, ему ни оригиналы, ни sharp не нужны.
//
// `npm run assets:images` вызывает writeCatalog в конце своей работы, поэтому полный прогон
// по-прежнему оставляет каталог согласованным.

import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SCENES, SCENE_WIDTHS, SCENE_FORMATS } from "./office-scenes.config.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");

const camel = (id) => id.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
const varName = (id, width, format) =>
  `${camel(id)}${width}${format[0].toUpperCase()}${format.slice(1)}`;

/**
 * Переписывает `src/components/office/officeScenes.ts`.
 *
 * Импорты обязаны быть СТАТИЧЕСКИМИ строками: бандлер разбирает их на этапе сборки и по ним же
 * эмитит производные с контент-хешем. Собрать запись циклом из массива id нельзя в принципе —
 * поэтому 36 строк импорта именно генерируются, а не пишутся руками. Это и есть та «одна точка»,
 * которой требует приёмка шага: сцена добавляется строкой в office-scenes.config.mjs, дальше —
 * команда.
 *
 * Результат КОММИТИТСЯ: иначе сборка на чистом клоне требовала бы `references/**` (3.2–3.6 МБ на
 * оригинал), которых там нет и быть не должно.
 */
export function writeCatalog() {
  const catalogPath = path.join(projectRoot, "src", "components", "office", "officeScenes.ts");

  const imports = SCENES.flatMap((scene) =>
    SCENE_FORMATS.flatMap((format) =>
      SCENE_WIDTHS.map(
        (width) =>
          `import ${varName(scene.id, width, format)} from "../../assets/office-photos/${scene.id}-${width}.${format}";`,
      ),
    ),
  ).join("\n");

  const entries = SCENES.map((scene) => {
    const perFormat = SCENE_FORMATS.map(
      (format) =>
        `    ${format}: [${SCENE_WIDTHS.map((width) => varName(scene.id, width, format)).join(", ")}],`,
    ).join("\n");
    return `  ${scene.id}: {\n${perFormat}\n  },`;
  }).join("\n");

  const ids = SCENES.map((scene) => `"${scene.id}"`).join(" | ");

  const contents = `// СГЕНЕРИРОВАННЫЙ ФАЙЛ — не редактировать руками.
//
// Источник: scripts/office-scenes.config.mjs. Команда: \`npm run assets:scenes\`
// (или \`npm run assets:images\`, который вызывает ту же генерацию в конце).
//
// Ручная правка будет затёрта следующим запуском, а рассинхрон со списком сцен поймает unit-тест
// src/tests/unit/components/office/office-scenes.test.ts.

import type { OfficeSceneSources } from "./departmentPhotos";

${imports}

/** id сцены офиса: мастер-сцена overview + сцены отделов. */
export type OfficeSceneId = ${ids};

/** Ширины адаптивных производных, по возрастанию. */
export const OFFICE_SCENE_WIDTHS = [${SCENE_WIDTHS.join(", ")}] as const;

/** Источники каждой сцены: производные по форматам, упорядоченные по OFFICE_SCENE_WIDTHS. */
export const officeSceneById: Record<OfficeSceneId, OfficeSceneSources> = {
${entries}
};
`;

  writeFileSync(catalogPath, contents, "utf-8");
  return catalogPath;
}

// Запуск напрямую (`node scripts/generate-scene-catalog.mjs`), а не импортом из генератора картинок.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const written = writeCatalog();
  console.log(`Каталог сцен переписан: ${path.relative(projectRoot, written)}`);
}
