import { DepartmentCTA } from "@/components/departments/DepartmentCTA";
import type { Department } from "@/content/types";
import styles from "./SolutionDocument.module.css";

interface SolutionDocumentProps {
  department: Department;
  /** Единый контакт сайта (`contactHref` в data/homepage-copy.json) — тот же, что у CTA в офисе. */
  contactHref: string;
}

/**
 * Страница отдела как ДОКУМЕНТ, а не как сцена.
 *
 * Компонент серверный и намеренно ничего не переиспользует из офиса. `DepartmentExperience`,
 * `PainGainPanel`, `MobilePainGainAccordion` и `CustomerBenefits` сюда не годятся ПО СУЩЕСТВУ, а не
 * из-за стилей:
 *
 * - `PainGainPanel` показывает выгоду ОДНОЙ выбранной боли — остальные четыре живут в состоянии
 *   клиента и в первый серверный HTML не попадают;
 * - `CustomerBenefits` держит результаты и CTA за таймером `RESULT_DELAY_MS = 10_000`, поэтому в
 *   серверном HTML на их месте стоит пустая заглушка;
 * - `MobilePainGainAccordion` — клиентский аккордеон, раскрываемый нажатием.
 *
 * Измерено на production 2026-09-16 по `/?department=sales`: в отрендеренном HTML присутствовали
 * заголовок, `problem` и все пять `pain`, но лишь ОДНА из пяти `gain`, ноль из четырёх
 * `customerBenefits` и ни одного CTA. Остальной текст лежал только внутри RSC-payload, то есть
 * внутри `<script>`. Ради устранения ровно этого и создаётся отдельный документ.
 *
 * Отсюда единственное жёсткое требование к этому файлу: **весь текст отдела обязан попадать в
 * первый серверный HTML**. Ни таймеров, ни состояния, ни постепенного раскрытия здесь быть не
 * должно — ни сейчас, ни при будущих правках. Сторож — unit-тест полноты документа.
 *
 * Никакого собственного текста компонент не содержит. Единственные две подписи — «Как работает» и
 * «Результат для бизнеса» — взяты дословно из уже работающих компонентов офиса
 * (`PainGainPanel.tsx`, `MobilePainGainAccordion.tsx`, `CustomerBenefits.tsx`), а не сочинены
 * заново.
 */
export function SolutionDocument({ department, contactHref }: SolutionDocumentProps) {
  return (
    <article className={styles.document}>
      <header className={styles.intro}>
        {/* Единственный H1 страницы — название отдела. Заголовок офиса (`headline`) стоит ниже
            обычным абзацем: на главной он работает как H2 открытого раздела, и повышать его до H1
            значило бы отдать документу заголовок длиной в три строки. */}
        <h1 className={styles.title}>{department.name}</h1>
        <p className={styles.headline}>{department.headline}</p>
        <p className={styles.problem}>{department.problem}</p>
      </header>

      {/* Каждая пара «боль → выгода» — самостоятельный раздел документа с собственным H2. Боль как
          заголовок, а не как подпись: именно она формулирует вопрос, ради которого страницу
          открывают, и именно её текст совпадает с тем, как задачу называет читатель. */}
      {/* Ключ — позиция в списке, и это здесь правильный выбор, а не небрежность: компонент
          серверный, список не переупорядочивается, не фильтруется и не меняется на клиенте, а
          уникальность самих строк `pain` схемой контента НЕ гарантирована (`departmentSchema`
          требует ровно пять пар, но не их различие). Ключ по тексту сломался бы на двух одинаковых
          формулировках, введённых в админ-панели. */}
      <div className={styles.painPoints}>
        {department.painPoints.map((point, index) => (
          <section className={styles.painPoint} key={index}>
            <h2 className={styles.pain}>{point.pain}</h2>
            <p className={styles.gain}>{point.gain}</p>
            {point.howItWorks ? (
              <div className={styles.howItWorks}>
                <p className={styles.howItWorksLabel}>Как работает</p>
                <p className={styles.howItWorksCopy}>{point.howItWorks}</p>
              </div>
            ) : null}
          </section>
        ))}
      </div>

      <section className={styles.benefits} aria-labelledby="solution-benefits-heading">
        <h2 className={styles.benefitsTitle} id="solution-benefits-heading">
          Результат для бизнеса
        </h2>
        <ul className={styles.benefitsList}>
          {/* Ключ по позиции — по той же причине, что у пар «боль → выгода» выше. */}
          {department.customerBenefits.map((benefit, index) => (
            <li className={styles.benefit} key={index}>
              {benefit}
            </li>
          ))}
        </ul>
      </section>

      {/* CTA виден с первого кадра. На главной он появляется последним в каскаде — здесь каскада
          нет вовсе, и появиться позже он не может. Подпись и адрес — существующие. */}
      <div className={styles.cta}>
        <DepartmentCTA label={department.ctaLabel} href={contactHref} />
      </div>
    </article>
  );
}
