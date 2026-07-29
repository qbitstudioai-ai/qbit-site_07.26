import Link from "next/link";
import { FaqAccordion } from "./FaqAccordion";
import {
  FAQ_CONTACT_CTA,
  FAQ_CONTACT_PROMPT,
  FAQ_EYEBROW,
  FAQ_HEADING,
  FAQ_INTRO,
  type FaqAnswerParagraph,
  faqItems,
} from "./faqData";
import styles from "./FaqExperience.module.css";

interface FaqExperienceProps {
  /** Существующий рабочий CTA проекта (`homepage-copy.contactHref`). Новый маршрут не заводится. */
  contactHref: string;
}

const twoDigits = (value: number) => String(value).padStart(2, "0");

/**
 * Абзац ответа: строки выводятся как есть, сегменты со ссылкой — как внутренний <Link>. HTML-строк
 * и `dangerouslySetInnerHTML` здесь нет намеренно, весь текст остаётся обычными React-узлами.
 */
function FaqAnswerText({ paragraph }: { paragraph: FaqAnswerParagraph }) {
  return (
    <>
      {paragraph.map((segment, index) =>
        typeof segment === "string" ? (
          segment
        ) : (
          <Link className={styles.answerLink} href={segment.href} key={`${segment.href}-${index}`}>
            {segment.text}
          </Link>
        ),
      )}
    </>
  );
}

/**
 * Раздел FAQ на стеклянной доске офисной сцены.
 *
 * Серверный компонент. Аккордеон — НАТИВНЫЙ `<details>` с общим атрибутом `name`: весь текст
 * вопросов и ответов попадает в SSG-HTML и остаётся в DOM в закрытом состоянии (важно для SEO/GEO и
 * для поиска по странице). Управляемый React-аккордеон здесь дал бы то же поведение ценой доставки
 * контента через клиент и рукописной клавиатурной логики.
 *
 * Единственный клиентский код раздела — `FaqAccordion`: он не рендерит контент, а лишь навешивает
 * поведение на уже существующую разметку (эксклюзивность независимо от поддержки `name` и подскролл
 * к раскрытому вопросу). Без JavaScript страница работает как обычный нативный FAQ.
 *
 * `aria-expanded` НАМЕРЕННО не проставляется вручную: у `<summary>` состояние раскрытия — часть
 * нативной семантики, браузер сам публикует expanded/collapsed в дереве доступности. Статический
 * атрибут в разметке без JS был бы всегда `false` и противоречил бы реальному состоянию.
 */
export function FaqExperience({ contactHref }: FaqExperienceProps) {
  const total = faqItems.length;

  return (
    <main className={styles.stage}>
      <div className={styles.photo} aria-hidden="true">
        <picture>
          <source
            type="image/avif"
            srcSet="/faq/faq-open-space-720.avif 720w, /faq/faq-open-space-1080.avif 1080w, /faq/faq-open-space-1672.avif 1672w"
            sizes="100vw"
          />
          <source
            type="image/webp"
            srcSet="/faq/faq-open-space-720.webp 720w, /faq/faq-open-space-1080.webp 1080w, /faq/faq-open-space-1672.webp 1672w"
            sizes="100vw"
          />
          {/* Ручной <picture>/srcSet — тот же подход, что и в ProductsExperience: фон кадрируется
              через object-fit/object-position, а производные webp/avif уже лежат в public/faq. */}
          <img
            src="/faq/faq-open-space-1672.webp"
            alt=""
            width={1672}
            height={941}
            decoding="async"
            fetchPriority="high"
          />
        </picture>
      </div>

      <div className={styles.board}>
        <section className={styles.boardInner} aria-labelledby="faq-heading">
          <div className={styles.head}>
            <div className={styles.headCopy}>
              <p className={styles.eyebrow}>{FAQ_EYEBROW}</p>
              <h1 className={styles.heading} id="faq-heading">
                {FAQ_HEADING}
              </h1>
              <p className={styles.intro}>{FAQ_INTRO}</p>
            </div>
            <p className={styles.counter} aria-hidden="true">
              {twoDigits(1)}—{twoDigits(total)}
            </p>
          </div>

          {/* Разметка вопросов остаётся серверной: FaqAccordion получает её через children и лишь
              навешивает поведение, поэтому весь текст по-прежнему приходит в SSG-HTML. */}
          <FaqAccordion>
            {faqItems.map((item, index) => (
              <details className={styles.item} key={item.id} name="faq">
                <summary className={styles.summary} aria-controls={`${item.id}-answer`}>
                  {/* Номер декоративный: порядок и так передаётся структурой документа, а «01»
                      перед каждым вопросом только засоряло бы озвучивание. */}
                  <span aria-hidden="true" className={styles.number}>
                    {twoDigits(index + 1)}
                  </span>
                  <span className={styles.question}>{item.question}</span>
                  <span aria-hidden="true" className={styles.marker} />
                </summary>

                <div className={styles.answer} id={`${item.id}-answer`}>
                  {item.answer.map((paragraph, paragraphIndex) => (
                    <p key={`${item.id}-p${paragraphIndex}`}>
                      <FaqAnswerText paragraph={paragraph} />
                    </p>
                  ))}
                </div>
              </details>
            ))}
          </FaqAccordion>

          <div className={styles.foot}>
            <p className={styles.footPrompt}>{FAQ_CONTACT_PROMPT}</p>
            <a className={styles.cta} href={contactHref} rel="noopener noreferrer" target="_blank">
              {FAQ_CONTACT_CTA}
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
