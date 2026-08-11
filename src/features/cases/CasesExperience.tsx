"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { CaseSelector } from "./CaseSelector";
import { CaseTransition } from "./CaseTransition";
import { CASES_PATH } from "./casesRoutes";
import type { CaseStudy } from "./types";
import styles from "./CasesExperience.module.css";

/**
 * Сцена раздела «Кейсы» — архив реализованных проектов.
 *
 * Метафора: рабочий стол с архивом. Слева — картотека небольших папок, справа — открытое досье
 * выбранного проекта. Фотография не декорация под интерфейсом: стеллажи, стол и большая папка
 * остаются видимыми, а интерфейс лежит НА столе.
 *
 * ── Почему сцена живёт в layout, а не в странице ─────────────────────────────────────────────
 *
 * Замерено на работающем сервере: при переходе с одного дела на другое App Router
 * размонтирует поддерево страницы — у динамического сегмента меняется значение параметра, и React
 * считает это новым узлом. Любое состояние клиентского компонента ВНУТРИ страницы при этом
 * теряется, поэтому перелистывание, собранное на странице, не запускалось ни разу: уходящий лист
 * исчезал вместе с компонентом, который должен был его показать (проба: `data-case-transition`
 * оставался `idle` на всех переходах).
 *
 * Layout при смене параметра не размонтируется — это его прямое назначение. Поэтому сцена, стопка
 * листов и картотека объявлены здесь, а страница отдаёт только сам документ. Из этого следует
 * граница server/client:
 *
 *   СЕРВЕР — маршрут, данные, метаданные и ВЕСЬ текст кейса (`/cases/[slug]/page.tsx` →
 *            `CaseDocument`). Документ приходит готовым HTML и передаётся сюда через `children`;
 *            клиентским он от этого не становится.
 *   КЛИЕНТ — только рама и движение: фон, картотека, перелистывание и печать.
 *
 * Активный кейс определяется адресом (`usePathname`), а не состоянием: `useState` с выбранным
 * кейсом здесь не появится — иначе у кейсов не было бы собственных адресов.
 */

interface CasesExperienceProps {
  studies: CaseStudy[];
  /** Подпись под картотекой. */
  railNote: string;
  /** Документ выбранного кейса либо обложка архива — отрисованы сервером. */
  children: ReactNode;
}

/** `/cases` → `null`, `/cases/<slug>` → `<slug>`. Вложенных уровней у раздела нет. */
function activeSlugFrom(pathname: string): string | null {
  if (!pathname.startsWith(`${CASES_PATH}/`)) return null;
  const slug = pathname.slice(CASES_PATH.length + 1).split("/")[0];
  return slug || null;
}

export function CasesExperience({ studies, railNote, children }: CasesExperienceProps) {
  const pathname = usePathname();
  const activeSlug = activeSlugFrom(pathname);

  return (
    <main className={styles.stage}>
      {/* Фотография архива. Декоративна: смысл раздела несут заголовок и текст документа. */}
      <picture className={styles.photo}>
        <source
          type="image/avif"
          srcSet="/cases/cases-background-960.avif 960w, /cases/cases-background-1600.avif 1600w"
          sizes="100vw"
        />
        <source
          type="image/webp"
          srcSet="/cases/cases-background-960.webp 960w, /cases/cases-background-1600.webp 1600w"
          sizes="100vw"
        />
        <img
          src="/cases/cases-background.png"
          alt=""
          aria-hidden="true"
          width={1672}
          height={941}
          fetchPriority="high"
          decoding="async"
        />
      </picture>
      <div className={styles.photoShade} aria-hidden="true" />

      <div className={styles.desk}>
        <CaseSelector studies={studies} activeSlug={activeSlug} note={railNote} />

        {/* Ключ — сам адрес: он же меняется и при клике по папке, и при Back/Forward, поэтому
            перелистывание одинаково работает в обе стороны. */}
        <CaseTransition transitionKey={pathname}>{children}</CaseTransition>
      </div>
    </main>
  );
}
