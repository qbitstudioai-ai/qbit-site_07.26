import Link from "next/link";
import { CaseStamp } from "./CaseStamp";
import type { CaseBlock, CaseStudy } from "./types";
import styles from "./CasesExperience.module.css";

/**
 * Досье проекта — лист внутри папки.
 *
 * Серверный компонент: весь текст кейса попадает в первый ответ сервера и не зависит ни от
 * гидратации, ни от клика. Это условие будущего SEO/GEO, поэтому подгрузки содержимого после
 * монтирования здесь не будет.
 *
 * Компонент получает ОДИН объект `CaseStudy` и ничего не знает ни о количестве кейсов, ни об их
 * источнике. Разделов ровно столько, сколько их в объекте; печать ставится, если у кейса
 * `stampEnabled`. Поэтому кейс, созданный завтра в админ-панели, отрисуется этим же кодом.
 *
 * Отличие от листа блога намеренное: это не статья, а технический отчёт о выполненной работе —
 * служебная шапка с номером дела, тонкие линии, нумерация разделов, плотная типографика и печать
 * в нижнем левом углу.
 */

interface CaseDocumentProps {
  study: CaseStudy;
  /** Надпись архива в служебной шапке. Приходит из текстов раздела, а не из самого кейса. */
  archiveLabel: string;
}

/**
 * Блок содержимого раздела.
 *
 * Отрисовка идёт СТРОГО по порядку блоков из данных: цепочка процесса стоит там, где её поставил
 * автор кейса, таблица «до/после» — там, где ей место по смыслу. Никакой логики «если это раздел
 * «Результат», то показать метрику» здесь нет и быть не может: компонент не знает названий разделов.
 */
function CaseBlockView({ block }: { block: CaseBlock }) {
  if (block.kind === "text") return <p>{block.text}</p>;

  if (block.kind === "chain") {
    // Нумерованный список: у шагов процесса есть порядок, и он несёт смысл. Стрелки между шагами
    // рисует CSS-псевдоэлемент — они оформление, а не текст, и скринридеру не читаются.
    return (
      <ol className={styles.docChain}>
        {/* Ключ — позиция, а не текст шага: в цепочке из админ-панели один и тот же шаг может
            встретиться дважды, и ключ по тексту тогда перестал бы быть уникальным. */}
        {block.steps.map((step, index) => (
          <li key={index} className={styles.docChainStep}>
            {step}
          </li>
        ))}
      </ol>
    );
  }

  /**
   * Измеримое изменение процесса — служебная строка архивного документа, а не рекламная карточка:
   * тонкая рамка, малый кегль, подпись об источнике. `dl` вместо таблицы: строк две, и связь
   * «ДО → значение» здесь именно «термин → значение».
   */
  return (
    <div className={styles.docMetrics}>
      {block.items.map((metric) => (
        <div key={metric.label} className={styles.docMetric}>
          <p className={styles.docMetricLabel}>{metric.label}</p>
          <dl className={styles.docMetricRows}>
            <div className={styles.docMetricRow}>
              <dt>До</dt>
              <dd>{metric.before}</dd>
            </div>
            <div className={styles.docMetricRow}>
              <dt>После</dt>
              <dd>{metric.after}</dd>
            </div>
          </dl>
          {metric.sourceNote ? <p className={styles.docMetricNote}>{metric.sourceNote}</p> : null}
        </div>
      ))}
    </div>
  );
}

export function CaseDocument({ study, archiveLabel }: CaseDocumentProps) {
  const titleId = `${study.slug}-title`;

  return (
    <article className={styles.paper} aria-labelledby={titleId}>
      <div className={styles.paperSheet}>
        {/* Область досье прокручивается внутри себя, когда кейс длиннее экрана (desktop). Поэтому
            она объявлена и сделана фокусируемой: скроллер без доступа с клавиатуры — нарушение
            (axe `scrollable-region-focusable`, serious), а внутри документа нет ни одного
            фокусируемого элемента, которым можно было бы его прокрутить. Тот же приём, что у
            прокручиваемых блоков кода в блоге. На мобильном прокручивает страница, и область
            остаётся просто объявленным разделом. */}
        <div
          className={styles.paperScroll}
          tabIndex={0}
          role="region"
          aria-label={`Досье проекта: ${study.title}`}
        >
          <header className={styles.docHead}>
            <p className={styles.docService}>
              <span className={styles.docServiceStrong}>Дело № {study.fileNumber}</span>
              <span className={styles.docServiceSeparator} aria-hidden="true" />
              <span>{archiveLabel}</span>
            </p>

            <p className={styles.docLabel}>{study.label}</p>
            <h1 id={titleId} className={styles.docTitle}>
              {study.title}
            </h1>
            {/* Вводная строка НЕОБЯЗАТЕЛЬНА: у кейса, который начинается разделом «Краткий итог»,
                её нет — иначе один и тот же текст оказался бы в HTML дважды. */}
            {study.summary ? <p className={styles.docSummary}>{study.summary}</p> : null}
          </header>

          <div className={styles.docBody}>
            {study.sections.map((section, index) => (
              <section key={section.id} className={styles.docSection}>
                <span className={styles.docSectionIndex} aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className={styles.docSectionCopy}>
                  <h2 id={section.id} className={styles.docSectionHeading}>
                    {section.heading}
                  </h2>
                  {section.blocks.map((block, blockIndex) => (
                    <CaseBlockView key={`${section.id}-${blockIndex}`} block={block} />
                  ))}
                </div>
              </section>
            ))}
          </div>

          {/* Спокойная строка в конце дела, а не рекламный блок: обычная ссылка того же кегля, что
              и текст документа, внутри прокручиваемой области — то есть дочитывается вместе с
              последним разделом. Ссылки нет вовсе, если у кейса не заполнено поле `cta`. */}
          {study.cta ? (
            <p className={styles.docCta}>
              <Link href={study.cta.href} className={styles.docCtaLink}>
                {study.cta.label}
              </Link>
            </p>
          ) : null}
        </div>

        {/* Подвал вынесен ИЗ прокручиваемой области: печать всегда стоит в нижнем левом углу
            документа и никогда не наезжает на текст — какой бы длины ни оказался будущий кейс. */}
        <footer className={styles.docFoot}>
          <CaseStamp key={study.slug} caseKey={study.slug} enabled={study.stampEnabled} />
          <p className={styles.docFootMeta}>
            <span>{archiveLabel}</span>
            <span aria-hidden="true">·</span>
            <span>Дело № {study.fileNumber}</span>
          </p>
        </footer>
      </div>
    </article>
  );
}
