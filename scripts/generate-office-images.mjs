// Step 10 — Adaptive image asset pipeline.
//
// Детерминированно порождает ВСЕ производные фотослоя офиса из тяжёлых оригиналов в `references/**`
// (1536×1024 PNG, 3.2–3.6 МБ каждый). Устраняет прежний «чёрный ящик»: миниатюры рельса и
// `office-background.webp` раньше были «сгенерированы один раз» вручную (см. departmentPhotos.ts).
// Теперь единственный источник истины производных — этот скрипт: `npm run assets:images`.
//
// Оригиналы `references/**/*.png` НИКОГДА не импортируются в клиентский граф и не запрашиваются
// браузером (порт-эксгейст под e2e, см. departmentPhotos.ts). Браузер получает только лёгкие
// производные из `src/assets/office-photos/`.
//
// OQ-A2-4 (закрыт 2026-07-18): sharp + скрипт; форматы WebP+AVIF; ширины 768/1280/1536; responsive-
// отдача ручным <picture>/srcset (подключается в Steps 12/13, здесь только генерация + экспорт).
//
// Воспроизводимость (Step 10 AC1): при одних и тех же оригиналах и одной версии sharp/libvips даёт
// один и тот же НАБОР файлов (имена/размеры/формат). Байт-идентичность кодеков между версиями/
// платформами не гарантируется и не требуется.

import { existsSync, mkdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { SCENES, SCENE_WIDTHS } from "./office-scenes.config.mjs";
import { writeCatalog } from "./generate-scene-catalog.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const referencesDir = path.join(projectRoot, "references");
const outputDir = path.join(projectRoot, "src", "assets", "office-photos");

// Список сцен и ширин раньше жил здесь. Со Step 18 он вынесен в ./office-scenes.config.mjs —
// единственный источник, из которого порождаются и производные, и TS-каталог сцен (см. writeCatalog
// ниже). См. импорт в начале файла.

// Детерминированные параметры кодеков. effort зафиксирован ради стабильного набора внутри версии.
const WEBP_OPTIONS = { quality: 80, effort: 6 };
const AVIF_OPTIONS = { quality: 50, effort: 6 };

// Миниатюра рельса: квадратный center-cover кроп под рендер 32×32 CSS px (2x DPR запас).
const THUMBNAIL_SIZE = 160;
const THUMBNAIL_OPTIONS = { quality: 72, effort: 6 };

// Бюджет веса на производную (Step 10 AC2). Пороги по формату×ширине; ни одна производная не должна
// превышать свой порог. Значения производны от согласованного потолка ≤~350КБ WebP / ≤~250КБ AVIF на
// 1536px и масштабированы по площади для меньших ширин (с запасом).
const BUDGET_BYTES = {
  webp: { 768: 140_000, 1280: 280_000, 1536: 350_000 },
  avif: { 768: 100_000, 1280: 200_000, 1536: 250_000 },
};

function kb(bytes) {
  return `${(bytes / 1024).toFixed(1)} КБ`;
}

async function main() {
  if (!existsSync(referencesDir)) {
    throw new Error(`Не найдена папка оригиналов: ${referencesDir}`);
  }
  mkdirSync(outputDir, { recursive: true });

  // sharp по умолчанию кэширует; для повторяемого прогона это неважно, но отключаем ради чистоты.
  sharp.cache(false);

  const generated = [];
  const violations = [];

  for (const scene of SCENES) {
    const sourcePath = path.join(referencesDir, scene.source);
    if (!existsSync(sourcePath)) {
      throw new Error(`Не найден оригинал сцены "${scene.id}": ${sourcePath}`);
    }

    // Адаптивные производные сцены: {id}-{width}.{webp,avif}.
    for (const width of SCENE_WIDTHS) {
      for (const [format, options, budgetTable] of [
        ["webp", WEBP_OPTIONS, BUDGET_BYTES.webp],
        ["avif", AVIF_OPTIONS, BUDGET_BYTES.avif],
      ]) {
        const fileName = `${scene.id}-${width}.${format}`;
        const outPath = path.join(outputDir, fileName);
        await sharp(sourcePath)
          .resize({ width, withoutEnlargement: false })
          .toFormat(format, options)
          .toFile(outPath);

        const bytes = statSync(outPath).size;
        const budget = budgetTable[width];
        generated.push({ fileName, bytes, budget });
        if (bytes > budget) {
          violations.push(`${fileName}: ${kb(bytes)} > бюджет ${kb(budget)}`);
        }
      }
    }

    // Миниатюра рельса — только для отделов (не для overview).
    if (scene.isDepartment) {
      const thumbName = `${scene.id}-thumbnail.webp`;
      const thumbPath = path.join(outputDir, thumbName);
      await sharp(sourcePath)
        .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, { fit: "cover", position: "centre" })
        .webp(THUMBNAIL_OPTIONS)
        .toFile(thumbPath);
      generated.push({ fileName: thumbName, bytes: statSync(thumbPath).size, budget: null });
    }
  }

  // Legacy общий фон офиса (текущий потребитель — OfficeExperience через departmentPhotos.ts).
  // Производная мастер-сцены overview @1536 в WebP; имя сохранено ради неизменности импорта до
  // подключения адаптивной overview-сцены в Step 12.
  const legacyBgName = "office-background.webp";
  const legacyBgPath = path.join(outputDir, legacyBgName);
  await sharp(path.join(referencesDir, SCENES[0].source))
    .resize({ width: 1536 })
    .webp(WEBP_OPTIONS)
    .toFile(legacyBgPath);
  {
    const bytes = statSync(legacyBgPath).size;
    const budget = BUDGET_BYTES.webp[1536];
    generated.push({ fileName: legacyBgName, bytes, budget });
    if (bytes > budget) {
      violations.push(`${legacyBgName}: ${kb(bytes)} > бюджет ${kb(budget)}`);
    }
  }

  writeCatalog();

  // Отчёт.
  const totalBytes = generated.reduce((sum, g) => sum + g.bytes, 0);
  console.log(
    `Сгенерировано ${generated.length} производных в ${path.relative(projectRoot, outputDir)}:`,
  );
  for (const g of generated.sort((a, b) => a.fileName.localeCompare(b.fileName))) {
    const budgetNote = g.budget ? ` (бюджет ${kb(g.budget)})` : "";
    console.log(`  ${g.fileName.padEnd(28)} ${kb(g.bytes).padStart(10)}${budgetNote}`);
  }
  console.log(`Суммарный вес производных: ${kb(totalBytes)}`);

  if (violations.length > 0) {
    console.error(`\nПревышение performance-budget (Step 10 AC2):`);
    for (const v of violations) console.error(`  ${v}`);
    process.exit(1);
  }
  console.log(`\nВсе производные в рамках performance-budget (Step 10 AC2).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
