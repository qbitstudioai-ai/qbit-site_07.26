import Image from "next/image";
import styles from "./Header.module.css";

interface HeaderProps {
  tagline: string;
}

export function Header({ tagline }: HeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.brandRow}>
        <Image
          src="/logo.svg"
          alt="QBit-Studio-Ai"
          width={90}
          height={64}
          className={styles.logo}
        />
        <span className={styles.brand}>QBit-Studio-Ai</span>
      </div>
      <p className={styles.tagline}>{tagline}</p>
    </header>
  );
}
