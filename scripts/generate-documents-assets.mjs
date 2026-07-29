// Раздел «Документы» — производные фона и файлы-заглушки каталога.
//
// Скрипт детерминированно порождает всё, что нельзя держать в репозитории руками:
//
//   1) адаптивные производные фотографии архива `public/dox/dox.png` (1672×941, ~1.9 МБ):
//      `dox-{960,1600}.{webp,avif}`. Оригинальный PNG остаётся по требуемому публичному адресу
//      `/dox/dox.png` и служит fallback-источником <picture>; браузер его не скачивает, если
//      поддерживает AVIF/WebP;
//
//   2) скачиваемые файлы-заглушки каталога (`public/dox/files/`). Это НЕ настоящие документы
//      QBit и не юридические тексты — минимальные валидные файлы соответствующих форматов с
//      пометкой «образец», чтобы кнопка «Скачать документ» вела на реально существующий файл
//      нужного типа, а не на 404. При подключении админ-панели папка заменяется реальными
//      файлами, а `src/features/documents/documents.ts` — данными из API.
//
// Запуск: `npm run assets:documents`.

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const doxDir = path.join(projectRoot, "public", "dox");
const filesDir = path.join(doxDir, "files");

const BACKGROUND_WIDTHS = [960, 1600];
const WEBP_OPTIONS = { quality: 78, effort: 6 };
const AVIF_OPTIONS = { quality: 48, effort: 6 };

/* ── ZIP (метод «stored») — минимальный писатель для OOXML-заглушек ─────────────────────────────
   Node не умеет собирать zip из коробки, а тянуть зависимость ради двух файлов-образцов нельзя.
   Записи кладутся без сжатия (method 0): так не нужен ни один кодек, а результат остаётся валидным
   архивом, который открывают Word и Excel. Дата/время фиксированы (1980-01-01), поэтому повторный
   прогон даёт байт-идентичный файл. */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let crc = -1;
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ -1) >>> 0;
}

function zipStored(entries) {
  const parts = [];
  const central = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const data = Buffer.from(entry.data, "utf8");
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8); // stored
    local.writeUInt16LE(0, 10); // time
    local.writeUInt16LE(0x0021, 12); // date: 1980-01-01
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    parts.push(local, name, data);

    const record = Buffer.alloc(46);
    record.writeUInt32LE(0x02014b50, 0);
    record.writeUInt16LE(20, 4);
    record.writeUInt16LE(20, 6);
    record.writeUInt16LE(0, 8);
    record.writeUInt16LE(0, 10);
    record.writeUInt16LE(0, 12);
    record.writeUInt16LE(0x0021, 14);
    record.writeUInt32LE(crc, 16);
    record.writeUInt32LE(data.length, 20);
    record.writeUInt32LE(data.length, 24);
    record.writeUInt16LE(name.length, 28);
    record.writeUInt32LE(offset, 42);
    central.push(record, name);

    offset += local.length + name.length + data.length;
  }

  const centralBuffer = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuffer.length, 12);
  end.writeUInt32LE(offset, 16);

  return Buffer.concat([...parts, centralBuffer, end]);
}

/* ── PDF ──────────────────────────────────────────────────────────────────────────────────────
   Минимальный одностраничный PDF со стандартным шрифтом Helvetica (в PDF он встроен по
   определению, файл остаётся крошечным). Текст — только ASCII: WinAnsiEncoding не покрывает
   кириллицу, а тащить встраивание шрифта ради образца не нужно. */

function minimalPdf(lines) {
  const content = [
    "BT",
    "/F1 20 Tf",
    "56 780 Td",
    `(${lines[0]}) Tj`,
    "/F1 11 Tf",
    "0 -28 Td",
    ...lines.slice(1).map((line) => `(${line}) Tj 0 -16 Td`),
    "ET",
  ].join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [];
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, "latin1");
}

/* ── OOXML ─────────────────────────────────────────────────────────────────────────────────── */

const OOXML_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="TARGET"/></Relationships>`;

function minimalDocx(paragraphs) {
  const body = paragraphs
    .map(
      (text) =>
        `<w:p><w:r><w:t xml:space="preserve">${text.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</w:t></w:r></w:p>`,
    )
    .join("");

  return zipStored([
    {
      name: "[Content_Types].xml",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
    },
    { name: "_rels/.rels", data: OOXML_RELS.replace("TARGET", "word/document.xml") },
    {
      name: "word/document.xml",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/></w:sectPr></w:body></w:document>`,
    },
  ]);
}

function minimalXlsx(rows) {
  const sheetRows = rows
    .map(
      (cells, rowIndex) =>
        `<row r="${rowIndex + 1}">${cells
          .map(
            (cell, cellIndex) =>
              `<c r="${String.fromCharCode(65 + cellIndex)}${rowIndex + 1}" t="inlineStr"><is><t xml:space="preserve">${cell
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")}</t></is></c>`,
          )
          .join("")}</row>`,
    )
    .join("");

  return zipStored([
    {
      name: "[Content_Types].xml",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`,
    },
    { name: "_rels/.rels", data: OOXML_RELS.replace("TARGET", "xl/workbook.xml") },
    {
      name: "xl/workbook.xml",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Образец" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
    },
    {
      name: "xl/worksheets/sheet1.xml",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`,
    },
  ]);
}

/* ── Растровый «скан» ─────────────────────────────────────────────────────────────────────────
   Один документ каталога намеренно является изображением (PNG): так ветка предпросмотра
   «файл сам себе preview» покрыта реальными данными, а не гипотезой. */

const SCAN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1240" height="1754" viewBox="0 0 1240 1754">
  <rect width="1240" height="1754" fill="#f7f3ec"/>
  <rect x="0" y="0" width="1240" height="10" fill="#8f5722"/>
  <text x="110" y="190" font-family="Segoe UI, Arial, sans-serif" font-size="46" font-weight="700" fill="#1e1a16">Регламент взаимодействия</text>
  <text x="110" y="248" font-family="Segoe UI, Arial, sans-serif" font-size="46" font-weight="700" fill="#1e1a16">с подрядчиками</text>
  <text x="110" y="316" font-family="Segoe UI, Arial, sans-serif" font-size="26" fill="#6f6559">QBit-Studio-Ai · образец страницы, не действующий документ</text>
  ${Array.from({ length: 22 }, (_, index) => {
    const y = 400 + index * 46;
    const width = index % 5 === 4 ? 620 : 1020;
    return `<rect x="110" y="${y}" width="${width}" height="14" rx="7" fill="#d9d2c6"/>`;
  }).join("\n  ")}
</svg>`;

async function main() {
  mkdirSync(filesDir, { recursive: true });
  sharp.cache(false);

  const generated = [];

  // 1. Производные фона.
  const source = path.join(doxDir, "dox.png");
  for (const width of BACKGROUND_WIDTHS) {
    for (const [format, options] of [
      ["webp", WEBP_OPTIONS],
      ["avif", AVIF_OPTIONS],
    ]) {
      const outPath = path.join(doxDir, `dox-${width}.${format}`);
      const info = await sharp(source)
        .resize({ width, withoutEnlargement: true })
        .toFormat(format, options)
        .toFile(outPath);
      generated.push([path.relative(projectRoot, outPath), info.size]);
    }
  }

  // 2. Скачиваемые заглушки каталога.
  const stubs = [
    [
      "ustav-qbit.pdf",
      minimalPdf([
        "QBit-Studio-Ai",
        "Sample file: corporate charter placeholder.",
        "This document contains no legal text.",
        "It is replaced by a real file from the admin panel.",
      ]),
    ],
    [
      "qbit-presentation.pdf",
      minimalPdf([
        "QBit-Studio-Ai",
        "Sample file: company presentation placeholder.",
        "Slides are replaced by a real export later.",
      ]),
    ],
    [
      "privacy-policy.pdf",
      minimalPdf([
        "QBit-Studio-Ai",
        "Sample file: personal data policy placeholder.",
        "This document contains no legal text.",
      ]),
    ],
    [
      "delivered-projects.xlsx",
      minimalXlsx([
        ["Проект", "Отрасль", "Статус"],
        ["Образец строки 1", "—", "Завершён"],
        ["Образец строки 2", "—", "Завершён"],
        ["Файл-заглушка QBit-Studio-Ai", "", ""],
      ]),
    ],
    [
      "automation-in-progress.docx",
      minimalDocx([
        "QBit-Studio-Ai — файл-заглушка",
        "Список проектов автоматизации в работе.",
        "Содержимое заменяется реальным файлом из админ-панели.",
      ]),
    ],
    [
      "qbit-requisites.txt",
      Buffer.from(
        [
          "QBit-Studio-Ai — файл-заглушка",
          "",
          "Реквизиты будут опубликованы после подключения админ-панели.",
          "Этот файл не содержит действующих банковских данных.",
        ].join("\r\n"),
        "utf8",
      ),
    ],
  ];

  for (const [name, data] of stubs) {
    const outPath = path.join(filesDir, name);
    writeFileSync(outPath, data);
    generated.push([path.relative(projectRoot, outPath), data.length]);
  }

  const scanPath = path.join(filesDir, "contractor-guideline.png");
  const scanInfo = await sharp(Buffer.from(SCAN_SVG))
    .png({ compressionLevel: 9, palette: true })
    .toFile(scanPath);
  generated.push([path.relative(projectRoot, scanPath), scanInfo.size]);

  for (const [name, size] of generated) {
    console.log(`${name} — ${(size / 1024).toFixed(1)} КБ`);
  }
}

await main();
