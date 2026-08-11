// Раздел «Кейсы» — производные утверждённых исходников из `public/cases/`.
//
// Скрипт НИЧЕГО не рисует и не придумывает: он только переводит два утверждённых пользователем
// файла в форматы, пригодные для веба. Исходники остаются в репозитории нетронутыми.
//
//   1) `cases-background.png` (1672×941, ~1.6 МБ) — фотография архива реализованных проектов.
//      Порождаются `cases-background-{960,1600}.{webp,avif}`. Оригинал остаётся по своему адресу и
//      служит последним источником <picture>; браузер его не скачивает, если понимает AVIF/WebP.
//      Кадрирование, цвет и композиция НЕ меняются — только размер и кодек.
//
//   2) `case-stamp.png` — печать. Файл требует отдельного объяснения, см. ниже.
//
// Запуск: `npm run assets:cases`.
//
// ── Почему печать нельзя взять как есть ───────────────────────────────────────────────────────
//
// Файл `case-stamp.png` только НАЗЫВАЕТСЯ PNG. Физически это JPEG (сигнатура FF D8 FF E0 «JFIF»),
// а значит альфа-канала у него нет в принципе. Прозрачность в нём НАРИСОВАНА — редактор экспортировал
// вместе с оттиском свою служебную «шахматку» из квадратов #ECECEC и #FFFFFF. Положенная на бумагу
// документа такая картинка дала бы не печать, а серый клетчатый квадрат поверх текста.
//
// Поэтому здесь восстанавливается то, что было утеряно при экспорте: клетка переводится в настоящий
// альфа-канал. Сам оттиск при этом не перерисовывается и не заменяется другим изображением —
// восстанавливается только его прозрачность.
//
// Метод. Фон шахматки НЕЙТРАЛЕН (r = g = b), краска печати — насыщенно-красная. Для композита
// `пиксель = a·краска + (1−a)·фон` разность «красный минус среднее зелёного и синего» не зависит от
// яркости нейтрального фона вовсе:
//
//     s = r − (g + b) / 2 = a · (Cr − (Cg + Cb) / 2) = a · INK_SPREAD
//
// откуда a = s / INK_SPREAD. Опорный цвет краски INK измерен по самому файлу (среднее верхнего
// процента насыщенности): rgb(214, 28, 26), INK_SPREAD = 187. NOISE_FLOOR отсекает звон JPEG вокруг
// границ клетки: без него 75 % площади получили бы альфу 3–5 % и на бумаге проступил бы красный
// туман квадратом. Порог выбран по замеру распределения: 75-й перцентиль s равен 10, 90-й — уже 145,
// то есть промежуточных значений в этом диапазоне почти нет и отсечение не съедает полутона оттиска.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const casesDir = path.join(projectRoot, "public", "cases");

const BACKGROUND_SOURCE = path.join(casesDir, "cases-background.png");
const STAMP_SOURCE = path.join(casesDir, "case-stamp.png");

const BACKGROUND_WIDTHS = [960, 1600];
const WEBP_OPTIONS = { quality: 78, effort: 6 };
const AVIF_OPTIONS = { quality: 48, effort: 6 };

/** Ширина производной печати. Максимальный видимый размер оттиска — 168 CSS-px, запас на 3× DPR. */
const STAMP_WIDTH = 512;

/** Опорный цвет краски и его «красный разброс» — измерены по самому исходнику (см. шапку файла). */
const INK = { r: 214, g: 28, b: 26 };
const INK_SPREAD = INK.r - (INK.g + INK.b) / 2;
const NOISE_FLOOR = 14;

/**
 * Останавливает работу с внятным сообщением, если утверждённого исходника нет.
 * Подставлять замену запрещено: фон и печать выбраны пользователем.
 */
function requireSource(file) {
  try {
    readFileSync(file);
  } catch {
    throw new Error(
      `Не найден утверждённый исходник ${path.relative(projectRoot, file)}. ` +
        `Замена другим изображением запрещена — положите файл на место и повторите запуск.`,
    );
  }
}

async function buildBackground(generated) {
  for (const width of BACKGROUND_WIDTHS) {
    for (const [format, options] of [
      ["webp", WEBP_OPTIONS],
      ["avif", AVIF_OPTIONS],
    ]) {
      const outPath = path.join(casesDir, `cases-background-${width}.${format}`);
      const info = await sharp(BACKGROUND_SOURCE)
        .resize({ width, withoutEnlargement: true })
        .toFormat(format, options)
        .toFile(outPath);
      generated.push([path.relative(projectRoot, outPath), info.size]);
    }
  }
}

async function buildStamp(generated) {
  const { data, info } = await sharp(STAMP_SOURCE).raw().toBuffer({ resolveWithObject: true });
  const pixels = info.width * info.height;
  const rgba = Buffer.alloc(pixels * 4);

  for (let index = 0; index < pixels; index += 1) {
    const source = index * info.channels;
    const r = data[source];
    const g = data[source + 1];
    const b = data[source + 2];

    const spread = r - (g + b) / 2;
    const alpha = Math.max(0, Math.min(1, (spread - NOISE_FLOOR) / (INK_SPREAD - NOISE_FLOOR)));

    const target = index * 4;
    rgba[target] = INK.r;
    rgba[target + 1] = INK.g;
    rgba[target + 2] = INK.b;
    rgba[target + 3] = Math.round(alpha * 255);
  }

  const withAlpha = sharp(rgba, {
    raw: { width: info.width, height: info.height, channels: 4 },
  }).resize({ width: STAMP_WIDTH, withoutEnlargement: true });

  for (const [format, options] of [
    ["png", { compressionLevel: 9 }],
    ["webp", { quality: 86, effort: 6, alphaQuality: 100 }],
    ["avif", { quality: 60, effort: 6 }],
  ]) {
    const outPath = path.join(casesDir, `case-stamp-${STAMP_WIDTH}.${format}`);
    const result = await withAlpha.clone().toFormat(format, options).toFile(outPath);
    generated.push([path.relative(projectRoot, outPath), result.size]);
  }
}

async function main() {
  requireSource(BACKGROUND_SOURCE);
  requireSource(STAMP_SOURCE);
  sharp.cache(false);

  const generated = [];
  await buildBackground(generated);
  await buildStamp(generated);

  for (const [name, size] of generated) {
    console.log(`${name} — ${(size / 1024).toFixed(1)} КБ`);
  }
}

await main();
