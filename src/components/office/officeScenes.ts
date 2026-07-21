// СГЕНЕРИРОВАННЫЙ ФАЙЛ — не редактировать руками.
//
// Источник: scripts/office-scenes.config.mjs. Команда: `npm run assets:scenes`
// (или `npm run assets:images`, который вызывает ту же генерацию в конце).
//
// Ручная правка будет затёрта следующим запуском, а рассинхрон со списком сцен поймает unit-тест
// src/tests/unit/components/office/office-scenes.test.ts.

import type { OfficeSceneSources } from "./departmentPhotos";

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

/** id сцены офиса: мастер-сцена overview + сцены отделов. */
export type OfficeSceneId = "overview" | "sales" | "support" | "executive" | "hr" | "logistics";

/** Ширины адаптивных производных, по возрастанию. */
export const OFFICE_SCENE_WIDTHS = [768, 1280, 1536] as const;

/** Источники каждой сцены: производные по форматам, упорядоченные по OFFICE_SCENE_WIDTHS. */
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
