import styles from "./DepartmentCTA.module.css";

interface DepartmentCTAProps {
  label: string;
  /** Единый контакт сайта (`contactHref` в data/homepage-copy.json), общий с CTA в hero. */
  href: string;
}

// Раньше это была видимая, но функционально no-op кнопка: реального адресата лида не было ни в
// одном шаге milestone. По решению пользователя (2026-07-18, WORKPLAN.md Amendment 10) все CTA
// внутри отделов ведут в тот же Telegram-контакт, что и основной CTA в hero, — то есть кнопка
// перестала быть заглушкой. Те же правила, что и там: <a>, а не <button> (внешний переход — это
// ссылка по смыслу), target="_blank" (посетитель не теряет открытый отдел) и обязательный
// rel="noopener noreferrer" при _blank.
export function DepartmentCTA({ label, href }: DepartmentCTAProps) {
  return (
    <a className={styles.cta} href={href} target="_blank" rel="noopener noreferrer">
      {label}
    </a>
  );
}
