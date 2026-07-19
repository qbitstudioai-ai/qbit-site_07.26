import type { HomepageCopy } from "@/content/types";
import styles from "./HeroCopy.module.css";

interface HeroCopyProps {
  copy: HomepageCopy;
  onActivate: () => void;
  isHiddenAfterReveal: boolean;
}

export function HeroCopy({ copy, onActivate, isHiddenAfterReveal }: HeroCopyProps) {
  const sectionClassName = isHiddenAfterReveal
    ? `${styles.hero} ${styles.hiddenAfterReveal}`
    : styles.hero;

  return (
    <section className={sectionClassName}>
      <h1 id="hero-heading" tabIndex={-1} className={styles.headline}>
        {copy.headline}
      </h1>
      <p className={styles.subheadline}>{copy.subheadline}</p>
      <ul className={styles.valuePoints}>
        {copy.valuePoints.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
      <div className={styles.ctaRow}>
        {/* Основной CTA ведёт наружу — в Telegram-контакт (решение пользователя 2026-07-18, см.
            WORKPLAN.md Amendment 9). Раньше это была <button>, открывавшая офис; офис теперь
            открывает только вторичный CTA ниже.

            Именно <a>, а не <button onClick={location.href=...}>: внешний переход — это ссылка по
            смыслу. Её можно скопировать, открыть в новой вкладке средней кнопкой, а скринридер
            объявит "ссылка", а не "кнопка".

            target="_blank" — чтобы посетитель не терял страницу с офисом, уходя в мессенджер.
            rel="noopener noreferrer" обязателен при target="_blank": без noopener открытая
            страница получает доступ к window.opener и может подменить исходную вкладку. */}
        <a
          href={copy.contactHref}
          className={styles.primaryCta}
          target="_blank"
          rel="noopener noreferrer"
        >
          {copy.primaryCta}
        </a>
        <a
          href="#office-map"
          className={styles.secondaryCta}
          onClick={(event) => {
            event.preventDefault();
            onActivate();
          }}
        >
          {copy.secondaryCta}
        </a>
      </div>
    </section>
  );
}
