import { TASK_SECTION_ID } from "./reducer";

/**
 * Контракт целей переноса фокуса (Step 17, находка milestone review Этапа 2).
 *
 * До этого модуля связь между машиной и презентационным слоем держалась на пяти строковых литералах,
 * записанных в разных файлах: `department-heading-<id>` производил `DepartmentCopy`/
 * `TaskSectionExperience`, `hotspot-<id>` — `DepartmentHotspot`, `mobile-department-carousel-card` —
 * `MobileDepartmentCarousel`, селектор карты — `OfficeSemanticMap`, а искала их все `OfficeMachine`.
 * Ни одна связка не проверялась компилятором: разъехавшаяся схема id молча ломала перенос фокуса, и
 * узнать об этом можно было только из e2e — если он до этого места доходил.
 *
 * Ровно так и случилось. Step 12.7 добавил ШЕСТОЙ раздел («Ваша задача») в механизм возврата фокуса,
 * рассчитанный на пять отделов: для него искался `hotspot-task`, которого не существует, а
 * единственным запасным кандидатом была мобильная карусель, скрытая выше 767px. Измерено на
 * milestone review: при закрытии раздела фокус уходил на `<body>` на desktop и tablet, а на мобильном
 * попадал на карусель — то есть «работал» по совпадению. Нарушение `docs/11` («после закрытия focus
 * возвращается») прожило до конца этапа, потому что тест закрытия проверял факт закрытия, но не фокус.
 *
 * Поэтому схема id живёт здесь, и и производители, и потребитель импортируют её отсюда.
 */

/** Заголовок открытого раздела — цель фокуса при открытии и переключении. */
export const sectionHeadingId = (sectionId: string) => `department-heading-${sectionId}`;

/** Кнопка-зона отдела на сцене overview — цель возврата фокуса после закрытия отдела. */
export const hotspotId = (departmentId: string) => `hotspot-${departmentId}`;

/** Карточка мобильной карусели. Стабильна: после сброса на первый отдел id всегда отрисован. */
export const MOBILE_CAROUSEL_CARD_ID = "mobile-department-carousel-card";

/** Кнопка входа в раздел «Ваша задача» на overview — цель возврата фокуса после его закрытия. */
export const TASK_ENTRY_BUTTON_ID = "task-entry-button";

/** Первая интерактивная зона сцены overview. */
export const OVERVIEW_MAP_FIRST_CONTROL = '[aria-label="Отделы компании"] button';

/**
 * Кандидаты возврата фокуса после закрытия раздела, в порядке предпочтения.
 *
 * Разделы бывают двух видов, и открывают их разные контролы: отдел открывается зоной на сцене,
 * «Ваша задача» — отдельной кнопкой над сценой. Возвращать фокус нужно на тот контрол, который
 * раздел открыл, иначе пользователь теряет место (`docs/11`).
 *
 * Последним кандидатом всегда идёт карусель: она — единственная навигация, гарантированно
 * отрисованная на мобильном, и служит фолбэком, когда основной контрол не отрисован.
 */
export const closeReturnCandidateIds = (returnSectionId: string): readonly string[] =>
  returnSectionId === TASK_SECTION_ID
    ? [TASK_ENTRY_BUTTON_ID, MOBILE_CAROUSEL_CARD_ID]
    : [hotspotId(returnSectionId), MOBILE_CAROUSEL_CARD_ID];
