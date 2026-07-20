import type { StaticImageData } from "next/image";
import type { DepartmentId } from "@/content/types";
import salesThumbnail from "../../assets/office-photos/sales-thumbnail.webp";
import supportThumbnail from "../../assets/office-photos/support-thumbnail.webp";
import executiveThumbnail from "../../assets/office-photos/executive-thumbnail.webp";
import hrThumbnail from "../../assets/office-photos/hr-thumbnail.webp";
import logisticsThumbnail from "../../assets/office-photos/logistics-thumbnail.webp";

// Адаптивные производные сцен (Step 10). WebP+AVIF × ширины 768/1280/1536, порождаются
// `npm run assets:images` (scripts/generate-office-images.mjs) из оригиналов references/**.
import overview768Avif from "../../assets/office-photos/overview-768.avif";
import overview1280Avif from "../../assets/office-photos/overview-1280.avif";
import overview1536Avif from "../../assets/office-photos/overview-1536.avif";
import overview768Webp from "../../assets/office-photos/overview-768.webp";
import overview1280Webp from "../../assets/office-photos/overview-1280.webp";
import overview1536Webp from "../../assets/office-photos/overview-1536.webp";
import sales768Avif from "../../assets/office-photos/sales-768.avif";
import sales1280Avif from "../../assets/office-photos/sales-1280.avif";
import sales1536Avif from "../../assets/office-photos/sales-1536.avif";
import sales768Webp from "../../assets/office-photos/sales-768.webp";
import sales1280Webp from "../../assets/office-photos/sales-1280.webp";
import sales1536Webp from "../../assets/office-photos/sales-1536.webp";
import support768Avif from "../../assets/office-photos/support-768.avif";
import support1280Avif from "../../assets/office-photos/support-1280.avif";
import support1536Avif from "../../assets/office-photos/support-1536.avif";
import support768Webp from "../../assets/office-photos/support-768.webp";
import support1280Webp from "../../assets/office-photos/support-1280.webp";
import support1536Webp from "../../assets/office-photos/support-1536.webp";
import executive768Avif from "../../assets/office-photos/executive-768.avif";
import executive1280Avif from "../../assets/office-photos/executive-1280.avif";
import executive1536Avif from "../../assets/office-photos/executive-1536.avif";
import executive768Webp from "../../assets/office-photos/executive-768.webp";
import executive1280Webp from "../../assets/office-photos/executive-1280.webp";
import executive1536Webp from "../../assets/office-photos/executive-1536.webp";
import hr768Avif from "../../assets/office-photos/hr-768.avif";
import hr1280Avif from "../../assets/office-photos/hr-1280.avif";
import hr1536Avif from "../../assets/office-photos/hr-1536.avif";
import hr768Webp from "../../assets/office-photos/hr-768.webp";
import hr1280Webp from "../../assets/office-photos/hr-1280.webp";
import hr1536Webp from "../../assets/office-photos/hr-1536.webp";
import logistics768Avif from "../../assets/office-photos/logistics-768.avif";
import logistics1280Avif from "../../assets/office-photos/logistics-1280.avif";
import logistics1536Avif from "../../assets/office-photos/logistics-1536.avif";
import logistics768Webp from "../../assets/office-photos/logistics-768.webp";
import logistics1280Webp from "../../assets/office-photos/logistics-1280.webp";
import logistics1536Webp from "../../assets/office-photos/logistics-1536.webp";

// Step 7.3, OQ-P1: реальные фото из references/ (не CSS-заглушки), но НЕ статический импорт
// оригиналов напрямую. Найдено при skeptic Phase B review: оригиналы (3.1–3.6 МБ, 1536×1024,
// плохо сжатый PNG для этого типа контента) заставляли next/image заново декодировать/пересжимать
// тяжёлый исходник на каждый холодный кэш-промах Image Optimization. Исправлено в два шага:
// (1) предварительная генерация лёгких WebP-производных (`src/assets/office-photos/`) — миниатюры
// 160×160 под рендер 32×32 CSS px, фон — тот же 1536×1024 с лучшим сжатием; (2) `<Image
// unoptimized>` в `DepartmentNavigationRail.tsx`/`OfficeExperience.tsx` — раз производные уже нужного
// размера и формата, повторная обработка через `/next/image`-эндпойнт на каждый запрос не нужна и
// лишь добавляет сетевой round-trip. Независимо найдено (не только теоретически): под нагрузкой
// полного e2e-прогона это порождало сотни short-lived TCP-соединений к `/_next/image`, вплоть до
// исчерпания эфемерных портов Windows в рамках одного прогона (`netstat` показывал TIME_WAIT-сокеты
// вплоть до верхней границы диапазона) — устранено полностью переходом на `unoptimized` (обычная
// статическая раздача файла, без отдельного оптимизирующего запроса). Со Step 10 эти производные
// (миниатюры + `office-background.webp`) больше не «чёрный ящик»: они детерминированно
// перегенерируются тем же `npm run assets:images`, что и адаптивные сцены ниже.
// `Department.reference` в data/departments.json по-прежнему указывает на оригинал в references/ —
// это описание исходного дизайн-референса, не буквальный путь импорта. Соответствие
// department.id ↔ конкретный файл-производное проверяется тестами (src/tests/unit/content/
// departments.test.ts для миниатюр, src/tests/unit/components/office/office-scenes.test.ts для
// адаптивных сцен) через саму схему именования, чтобы перепутанное присваивание не осталось
// незамеченным.
export const photoByDepartmentId: Record<DepartmentId, StaticImageData> = {
  sales: salesThumbnail,
  support: supportThumbnail,
  executive: executiveThumbnail,
  hr: hrThumbnail,
  logistics: logisticsThumbnail,
};

// Общего фона офиса позади department-active (`officeBackgroundPhoto` / `office-background.webp`,
// Step 7.3) здесь больше нет: Step 13 заменил его на сцену активного отдела из officeSceneById ниже,
// и последний потребитель исчез. Экспорт удалён вместе с импортом, чтобы 244 КБ не оставались в
// бандле ради кода, который никто не вызывает. Сам файл продолжает порождаться
// scripts/generate-office-images.mjs (legacyBgName) — генератор этот шаг не трогает.
//
// ── Адаптивные сцены офиса (Step 10) ─────────────────────────────────────────────────────────────
// Мастер-сцена overview + 5 сцен отделов. Экспортируются как источники + метаданные для ручного
// <picture>/srcset (OQ-A2-4). НЕ подключены к рендеру на этом шаге — overview остаётся карточками
// на токен-фоне (Step 12 подключит мастер-сцену), department-active использует общий фон выше
// (Step 13 подключит per-department сцены). Оригиналы references/** сюда не входят.

/** id сцены офиса: мастер-сцена overview + пять отделов (совпадают с DepartmentId). */
export type OfficeSceneId = "overview" | DepartmentId;

/** Ширины адаптивных производных, по возрастанию (см. scripts/generate-office-images.mjs). */
export const OFFICE_SCENE_WIDTHS = [768, 1280, 1536] as const;

/**
 * `sizes` мастер-сцены overview.
 *
 * Остаётся `100vw` и после Step 15 — сознательно, а не по недосмотру. Кадр overview ограничен
 * `min(ширина панели, высота панели × 3/2)` (OfficeSemanticMap.module.css), то есть зависит и от
 * ВЫСОТЫ вьюпорта. Выразить это в `sizes` можно только набором `(min-height: …)`-условий, которые
 * пришлось бы вручную держать синхронными с CSS, — а рассинхрон здесь тихо ведёт к недостаточной
 * ширине и мылу. `100vw` при этом никогда не занижает: кадр по построению не шире вьюпорта, поэтому
 * ошибка возможна только в сторону запаса.
 */
export const OFFICE_SCENE_SIZES = "100vw";

/**
 * `sizes` сцены отдела (Step 15, AC3). В отличие от overview, здесь кадр ограничен именно ШИРИНОЙ и
 * измерим: сцена расстелена под всей `.shell10x90`, у которой по бокам padding панели офиса
 * (`--space-6` × 2). Замерено: 1600px → ~1552px кадра (97vw), 1024px → ~976px (95vw); доля почти не
 * зависит от брейкпоинта, потому что отнимается фиксированный padding, а не процент.
 *
 * Отсюда 97vw вместо прежнего `100vw`: на 1600px это ровно тот же выбор (1536), а на промежуточных
 * ширинах чуть точнее. Главный эффект AC3 даёт не эта поправка, а сам факт `srcset` — браузер берёт
 * 768 на мобильном, 1280 на планшете и 1536 на desktop, то есть узкий вьюпорт не платит за
 * desktop-производную (проверяется e2e responsive-scene-framing.spec.ts).
 *
 * Занижать долю сильнее (под 90%-область без рельса) было бы ошибкой: фотослой лежит под ВСЕЙ
 * раскладкой, включая колонку рельса (Step 13, skeptic Phase B, finding 5), — `sizes` обязан
 * описывать реальный кадр, а не ту его часть, которая не закрыта интерфейсом.
 */
export const DEPARTMENT_SCENE_SIZES = "97vw";

/**
 * Источники одной сцены: массивы производных, упорядоченные по {@link OFFICE_SCENE_WIDTHS}.
 * `avif` — предпочтительный формат, `webp` — фолбэк.
 *
 * Дескриптор ширины для `<source srcset>` в Steps 12/13 берётся из {@link OFFICE_SCENE_WIDTHS}
 * по индексу, а `.src` — из StaticImageData. Turbopack не читает размеры AVIF (эмитит
 * предоптимизированный файл как есть — это и есть наша стратегия, см. `<Image unoptimized>`),
 * поэтому `StaticImageData.width` у AVIF ненадёжен; ширины из массива констант надёжны и
 * совпадают с реальными по построению (scripts/generate-office-images.mjs).
 */
export interface OfficeSceneSources {
  readonly avif: readonly StaticImageData[];
  readonly webp: readonly StaticImageData[];
}

export const officeSceneById: Record<OfficeSceneId, OfficeSceneSources> = {
  overview: {
    avif: [overview768Avif, overview1280Avif, overview1536Avif],
    webp: [overview768Webp, overview1280Webp, overview1536Webp],
  },
  sales: {
    avif: [sales768Avif, sales1280Avif, sales1536Avif],
    webp: [sales768Webp, sales1280Webp, sales1536Webp],
  },
  support: {
    avif: [support768Avif, support1280Avif, support1536Avif],
    webp: [support768Webp, support1280Webp, support1536Webp],
  },
  executive: {
    avif: [executive768Avif, executive1280Avif, executive1536Avif],
    webp: [executive768Webp, executive1280Webp, executive1536Webp],
  },
  hr: {
    avif: [hr768Avif, hr1280Avif, hr1536Avif],
    webp: [hr768Webp, hr1280Webp, hr1536Webp],
  },
  logistics: {
    avif: [logistics768Avif, logistics1280Avif, logistics1536Avif],
    webp: [logistics768Webp, logistics1280Webp, logistics1536Webp],
  },
};
