import Link from "next/link";
import { DepartmentCTA } from "@/components/departments/DepartmentCTA";
import type { Department } from "@/content/types";
import type { PublishedDepartmentMaterial } from "@/server/repositories/contentRelations";
import styles from "./SolutionDocument.module.css";

interface SolutionDocumentProps {
  department: Department;
  /** Единый контакт сайта (`contactHref` в data/homepage-copy.json) — тот же, что у CTA в офисе. */
  contactHref: string;
  /**
   * Связанные продукты и кейсы (SOL-OUT-02). Необязателен: без связей блоки не выводятся, и
   * вызывающему коду не нужно передавать пустой массив, чтобы это выразить.
   */
  relatedMaterials?: readonly PublishedDepartmentMaterial[];
}

/**
 * Подписи блоков перелинковки.
 *
 * Кейсы — единственный блок с числом в заголовке: «Пример внедрения» против «Примеры внедрения».
 * Один реализованный проект нельзя называть множественным числом — это мелкое, но настоящее
 * преувеличение, а весь блок существует ради доказательства.
 */
const PRODUCTS_HEADING = "Подходящие решения";

function casesHeading(count: number): string {
  return count === 1 ? "Пример внедрения" : "Примеры внедрения";
}

/**
 * Один блок перелинковки: заголовок и карточки-ссылки.
 *
 * Пустой список не рисует НИЧЕГО — ни заголовка, ни рамки. Проверка стоит здесь, а не у каждого
 * вызова, чтобы «пустой блок не отображать» нельзя было забыть при добавлении третьего блока.
 *
 * Карточка — обычная ссылка с текстом. Тип материала назван словом («Продукт», «Кейс»), а не цветом
 * или значком: смысл не имеет права держаться на оформлении. Подписи — те же, что в блоке
 * «Материалы по теме» блога (`MATERIAL_TYPE_LABEL` в `BlogExperience.tsx`), а не сочинённые заново.
 *
 * Адрес приходит готовым с сервера (`material.href`) и здесь не собирается: второе место сборки
 * адресов разошлось бы с первым молча.
 */
function MaterialSection({
  heading,
  headingId,
  materials,
  typeLabel,
}: {
  heading: string;
  headingId: string;
  materials: readonly PublishedDepartmentMaterial[];
  typeLabel: string;
}) {
  if (materials.length === 0) return null;

  return (
    <section className={styles.materials} aria-labelledby={headingId}>
      <h2 className={styles.materialsTitle} id={headingId}>
        {heading}
      </h2>
      <ul className={styles.materialsList}>
        {materials.map((material) => (
          <li key={`${material.type}:${material.id}`}>
            <Link className={styles.materialCard} href={material.href}>
              <span className={styles.materialType}>{typeLabel}</span>
              <span className={styles.materialTitle}>{material.title}</span>
              {material.summary ? (
                <span className={styles.materialSummary}>{material.summary}</span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
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
export function SolutionDocument({
  department,
  contactHref,
  relatedMaterials = [],
}: SolutionDocumentProps) {
  const products = relatedMaterials.filter((material) => material.type === "product");
  const cases = relatedMaterials.filter((material) => material.type === "case");

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

      {/*
       * Перелинковка стоит ПОСЛЕ содержания и ДО призыва к действию, и это единственное место, где
       * она уместна. Выше — документ отвечает на вопрос посетителя; блоки предлагают следующий шаг
       * тому, кто уже прочитал ответ. Ниже CTA она осталась бы непрочитанной: страница на этом
       * заканчивается.
       *
       * Продукты идут перед кейсами: сначала «чем это закрывается», затем «где это уже сработало».
       * У трёх отделов кейсов нет вовсе (support, hr, logistics — подтверждённый контентный пробел
       * SOL-OUT-01), и порядок выбран так, чтобы их страницы не обрывались пустым местом.
       */}
      <MaterialSection
        heading={PRODUCTS_HEADING}
        headingId="solution-products-heading"
        materials={products}
        typeLabel="Продукт"
      />
      <MaterialSection
        heading={casesHeading(cases.length)}
        headingId="solution-cases-heading"
        materials={cases}
        typeLabel="Кейс"
      />

      {/* CTA виден с первого кадра. На главной он появляется последним в каскаде — здесь каскада
          нет вовсе, и появиться позже он не может. Подпись и адрес — существующие. */}
      <div className={styles.cta}>
        <DepartmentCTA label={department.ctaLabel} href={contactHref} />
      </div>
    </article>
  );
}
