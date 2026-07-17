import Image from "next/image";
import styles from "./Header.module.css";

interface HeaderProps {
  tagline: string;
  onReturnHome: () => void;
}

export function Header({ tagline, onReturnHome }: HeaderProps) {
  return (
    <header className={styles.header}>
      {/* Логотип возвращает на начальную страницу (hero) через уже существующий RETURN_TO_HERO —
          не <Link href="/">: "/" и "/?department=hr" — один route, soft-навигация не размонтирует
          OfficeMachine, и useReducer-состояние пережило бы переход (см. WORKPLAN.md Step 7.6).
          alt="" — логотип декоративен: имя кнопке даёт текст бренда рядом, иначе оно удвоилось бы. */}
      <button type="button" className={styles.brandRow} onClick={onReturnHome}>
        <Image src="/logo.svg" alt="" width={90} height={64} className={styles.logo} />
        <span className={styles.brand}>QBit-Studio-Ai</span>
      </button>
      <p className={styles.tagline}>{tagline}</p>
    </header>
  );
}
