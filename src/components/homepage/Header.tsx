import Image from "next/image";
import styles from "./Header.module.css";

export function Header() {
  return (
    <header className={styles.header}>
      <Image src="/logo.svg" alt="QBit-Studio-Ai" width={90} height={64} className={styles.logo} />
      <span className={styles.brand}>QBit-Studio-Ai</span>
    </header>
  );
}
