// Техническая обложка для соцсетей и мессенджеров: `public/og/qbit-og-1200x630.png`.
//
// Что на ней есть: УЖЕ существующий логотип `public/logo.svg` на УЖЕ существующем фирменном фоне
// (`--color-surface-cream` из `src/styles/tokens.css`). Больше ничего.
//
// Чего на ней НЕТ и не должно появиться: слогана, обещаний, цен, названий услуг, «SEO-текста».
// Обложка — техническое требование Open Graph (у ссылки должна быть картинка), а не новый
// рекламный носитель. Аудит SEO/GEO прямо запрещает добавлять на неё новый текст.
//
// Логотип лежит в SVG как встроенный base64-PNG, поэтому растеризация SVG не нужна: PNG
// извлекается напрямую и вписывается в безопасную область обложки.
//
// Запуск: `npm run assets:og`.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const logoPath = path.join(projectRoot, "public", "logo.svg");
const outDir = path.join(projectRoot, "public", "og");
const outPath = path.join(outDir, "qbit-og-1200x630.png");

// Размер, который ожидают Open Graph и Twitter `summary_large_image` (соотношение 1.91:1).
const WIDTH = 1200;
const HEIGHT = 630;

// `--color-surface-cream` из src/styles/tokens.css — тот же фон, что у страниц сайта.
const BACKGROUND = { r: 0xfa, g: 0xf6, b: 0xef, alpha: 1 };

// Логотип занимает центральную часть, поля остаются пустыми: превью в мессенджерах часто
// обрезается по краям, и вписанный «в край» логотип терял бы части.
const LOGO_MAX_WIDTH = Math.round(WIDTH * 0.52);
const LOGO_MAX_HEIGHT = Math.round(HEIGHT * 0.52);

function extractEmbeddedPng(svgSource) {
  const match = /xlink:href="data:image\/png;base64,([A-Za-z0-9+/=]+)"/.exec(svgSource);
  if (!match) {
    throw new Error(
      "В public/logo.svg не найдено встроенное PNG-изображение. Скрипт рассчитан именно на такой " +
        "логотип: если формат сменился, обновите извлечение, а не отключайте проверку.",
    );
  }
  return Buffer.from(match[1], "base64");
}

const logoPng = extractEmbeddedPng(readFileSync(logoPath, "utf8"));

const logo = await sharp(logoPng)
  .resize({
    width: LOGO_MAX_WIDTH,
    height: LOGO_MAX_HEIGHT,
    fit: "inside",
    withoutEnlargement: true,
  })
  .toBuffer();

const image = await sharp({
  create: { width: WIDTH, height: HEIGHT, channels: 4, background: BACKGROUND },
})
  .composite([{ input: logo, gravity: "centre" }])
  .png({ compressionLevel: 9 })
  .toBuffer();

mkdirSync(outDir, { recursive: true });
writeFileSync(outPath, image);

const { width, height } = await sharp(image).metadata();
console.log(`og-image: ${path.relative(projectRoot, outPath)} — ${width}×${height}`);
