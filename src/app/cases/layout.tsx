import { Header } from "@/components/homepage/Header";
import { getHomepageCopy } from "@/content/homepage-copy";
import { CASES_PATH } from "@/features/cases/casesRoutes";
import { CasesExperience } from "@/features/cases/CasesExperience";
import { getCasesPageCopy, getPublishedCases } from "@/server/content/cases";
import styles from "@/features/cases/CasesExperience.module.css";

/**
 * Общая рама раздела «Кейсы»: шапка сайта, сцена архива и картотека.
 *
 * Здесь лежит ВСЁ, что не должно перестраиваться при смене кейса. App Router размонтирует поддерево
 * страницы, когда меняется значение динамического сегмента, а layout — нет: только благодаря этому
 * переживают переход и перелистывание, и картотека, и уже загруженная фотография (подробное
 * объяснение — в `CasesExperience.tsx`). Страница отдаёт сюда через `children` один лист: досье
 * кейса либо обложку архива.
 *
 * `activeHref` передаётся один раз — поэтому пункт «Кейсы» подсвечен и на `/cases`, и на
 * `/cases/[slug]`, без разбора адреса в самом компоненте шапки.
 *
 * Рендер НА ЗАПРОС. Картотеку рисует именно layout, а её содержимое целиком принадлежит базе:
 * запасных текстов у кейсов нет. Статический пререндер на сборке образа (где базы ещё нет) дал бы
 * в production пустой ящик с делами — см. объяснение в `src/app/cases/page.tsx` и сторожевой тест
 * `src/tests/unit/app/rendering-mode.test.ts`.
 */
export const dynamic = "force-dynamic";

export default function CasesLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const copy = getHomepageCopy();
  const pageCopy = getCasesPageCopy();

  return (
    <div className={styles.shell}>
      <Header
        links={copy.heroLinks}
        phoneLabel={copy.headerPhone}
        phoneHref={copy.headerPhoneHref}
        phoneAccessibleLabel={copy.headerPhoneAccessibleLabel}
        activeHref={CASES_PATH}
      />
      <CasesExperience studies={getPublishedCases()} railNote={pageCopy.railNote}>
        {children}
      </CasesExperience>
    </div>
  );
}
