import styles from "./CasesExperience.module.css";

/**
 * Обложка архива — лист, лежащий в папке, пока конкретное дело не выбрано (страница `/cases`).
 *
 * Серверный компонент и собственное содержимое: корень раздела НЕ повторяет ни один кейс. Если бы
 * `/cases` показывал первое дело, у двух адресов было бы одинаковое содержимое — и при открытии
 * раздела для индексирования пришлось бы разбираться с дублем и canonical.
 */

interface CasesCoverSheetProps {
  eyebrow: string;
  headline: string;
  /**
   * Вводный текст — абзацы, а не одна строка.
   *
   * Их два и они разного назначения: первый говорит, что лежит в разделе, второй ограничивает
   * применимость цифр. Склеивать их в один абзац нельзя — оговорка растворилась бы в описании.
   */
  intro: readonly string[];
  /** Число опубликованных дел. Считается источником данных, а не разметкой. */
  total: number;
}

export function CasesCoverSheet({ eyebrow, headline, intro, total }: CasesCoverSheetProps) {
  return (
    <article className={styles.paper} aria-labelledby="cases-cover-title">
      <div className={styles.paperSheet}>
        {/* Прокручиваемая область досье — та же, что у кейса, и по той же причине фокусируемая:
            см. пояснение в `CaseDocument.tsx`. */}
        <div
          className={styles.paperScroll}
          tabIndex={0}
          role="region"
          aria-label={`Опись архива: ${headline}`}
        >
          <header className={styles.docHead}>
            <p className={styles.docService}>
              <span className={styles.docServiceStrong}>Опись</span>
              <span className={styles.docServiceSeparator} aria-hidden="true" />
              <span>{eyebrow}</span>
            </p>

            <p className={styles.docLabel}>АРХИВ</p>
            <h1 id="cases-cover-title" className={styles.docTitle}>
              {headline}
            </h1>
            {intro.map((paragraph) => (
              <p key={paragraph} className={styles.docSummary}>
                {paragraph}
              </p>
            ))}
          </header>

          <div className={styles.docBody}>
            <section className={styles.docSection}>
              <span className={styles.docSectionIndex} aria-hidden="true">
                {String(total).padStart(2, "0")}
              </span>
              <div className={styles.docSectionCopy}>
                <h2 className={styles.docSectionHeading}>Дел в архиве</h2>
                <p>
                  Каждое дело открывается по своему адресу и содержит задачу, решение и результат.
                </p>
              </div>
            </section>
          </div>
        </div>

        <footer className={styles.docFoot}>
          <p className={styles.docFootMeta}>
            <span>{eyebrow}</span>
            <span aria-hidden="true">·</span>
            <span>Опись дел</span>
          </p>
        </footer>
      </div>
    </article>
  );
}
