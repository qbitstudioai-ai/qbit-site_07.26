import type { StaticImageData } from "next/image";
import type { DepartmentId } from "@/content/types";
import salesThumbnail from "../../assets/office-photos/sales-thumbnail.webp";
import supportThumbnail from "../../assets/office-photos/support-thumbnail.webp";
import executiveThumbnail from "../../assets/office-photos/executive-thumbnail.webp";
import hrThumbnail from "../../assets/office-photos/hr-thumbnail.webp";
import logisticsThumbnail from "../../assets/office-photos/logistics-thumbnail.webp";
import officeBackgroundPhotoSource from "../../assets/office-photos/office-background.webp";

// Step 7.3, OQ-P1: реальные фото из references/ (не CSS-заглушки), но НЕ статический импорт
// оригиналов напрямую. Найдено при skeptic Phase B review: оригиналы (3.1–3.6 МБ, 1536×1024,
// плохо сжатый PNG для этого типа контента) заставляли next/image заново декодировать/пересжимать
// тяжёлый исходник на каждый холодный кэш-промах Image Optimization. Исправлено в два шага:
// (1) предварительная генерация лёгких WebP-производных (`src/assets/office-photos/`,
// сгенерированы один раз из оригиналов references/**/*.png — миниатюры 160×160 под рендер 32×32
// CSS px, фон — тот же 1536×1024 с лучшим сжатием); (2) `<Image unoptimized>` в
// `DepartmentNavigationRail.tsx`/`OfficeExperience.tsx` — раз производные уже нужного размера и
// формата, повторная обработка через `/next/image`-эндпойнт на каждый запрос не нужна и лишь
// добавляет сетевой round-trip. Независимо найдено (не только теоретически): под нагрузкой полного
// e2e-прогона это порождало сотни short-lived TCP-соединений к `/_next/image`, вплоть до исчерпания
// эфемерных портов Windows в рамках одного прогона (`netstat` показывал TIME_WAIT-сокеты вплоть до
// верхней границы диапазона) — устранено полностью переходом на `unoptimized` (обычная статическая
// раздача файла, без отдельного оптимизирующего запроса). `Department.reference` в
// data/departments.json по-прежнему указывает на оригинал в references/ — это описание исходного
// дизайн-референса, не буквальный путь импорта. Соответствие department.id ↔ конкретный
// файл-производное проверяется тестом (src/tests/unit/content/departments.test.ts) через саму схему
// именования (`${id}-thumbnail.webp`), чтобы перепутанное присваивание в объекте ниже не осталось
// незамеченным.
export const photoByDepartmentId: Record<DepartmentId, StaticImageData> = {
  sales: salesThumbnail,
  support: supportThumbnail,
  executive: executiveThumbnail,
  hr: hrThumbnail,
  logistics: logisticsThumbnail,
};

// Общий фон офиса позади department-active (docs/03-office-map.md "Режим 10/90") — не рендерится в
// overview этим шагом (см. docs/03 уточнение по OQ-P1, Step 7.3).
export const officeBackgroundPhoto: StaticImageData = officeBackgroundPhotoSource;
