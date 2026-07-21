// ЕДИНСТВЕННЫЙ СПИСОК СЦЕН ОФИСА (Step 18, пункт «каталог сцен»).
//
// До Step 18 список жил в ТРЁХ местах: здесь (в генераторе производных), в 36 ручных
// import-строках `src/components/office/departmentPhotos.ts` и в unit-тесте, прибивавшем ровно
// шесть сцен. Добавление сцены («до/после» для Этапа 3) требовало правки во всех трёх, причём
// пропуск любой из них проявлялся по-разному: пропустив генератор — не получить файлов, пропустив
// импорты — не получить сцены в бандле, пропустив тест — уронить зелёный на ровном месте.
//
// Теперь список один, и он здесь. Из него генератор порождает и производные, и TS-каталог
// `src/components/office/officeScenes.ts` (36 импортов + запись id → источники), а
// unit-тест сверяет каталог с этим файлом — то есть рассинхрон падает сразу и с внятным текстом,
// а не «когда-нибудь в браузере».
//
// Порядок добавления сцены: одна строка в SCENES ниже + `npm run assets:images`.
//
// Конфиг вынесен из самого генератора намеренно: тот на верхнем уровне вызывает main(), поэтому
// импортировать его ради констант значило бы запускать пересжатие картинок из теста.

/**
 * id сцены ↔ оригинал в `references/**`. id `overview` — мастер-сцена (используется и как источник
 * legacy `office-background.webp`). Остальные id совпадают с DepartmentId (src/content/schema.ts) —
 * соответствие проверяется unit-тестами через саму схему именования файлов.
 */
export const SCENES = [
  { id: "overview", source: "office-overview/01-company-overview.png", isDepartment: false },
  { id: "sales", source: "sales/02-sales-department.png", isDepartment: true },
  { id: "support", source: "support/03-support-department.png", isDepartment: true },
  { id: "executive", source: "executive/04-executive-department.png", isDepartment: true },
  { id: "hr", source: "hr/05-hr-department.png", isDepartment: true },
  { id: "logistics", source: "logistics/06-logistics-department.png", isDepartment: true },
];

/** Ширины адаптивной раздачи (OQ-A2-4). Высота выводится из аспекта оригинала (1536×1024 → 3:2). */
export const SCENE_WIDTHS = [768, 1280, 1536];

/** Форматы производных, в порядке предпочтения браузером (<source> сверху вниз). */
export const SCENE_FORMATS = ["avif", "webp"];
