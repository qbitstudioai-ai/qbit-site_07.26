import Image from "next/image";
import styles from "./Header.module.css";

export function Header() {
  return (
    <header className={styles.header}>
      <Image src="/logo.svg" alt="Allqbit" width={45} height={32} className={styles.logo} />
      <span className={styles.brand}>Allqbit</span>
    </header>
  );
}
