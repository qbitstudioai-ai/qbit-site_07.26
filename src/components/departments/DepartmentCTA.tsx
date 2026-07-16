import styles from "./DepartmentCTA.module.css";

interface DepartmentCTAProps {
  label: string;
}

// Видимая, сфокусируемая, но функционально no-op кнопка — нет реального адресата лида/CRM ни в
// этом шаге, ни во всём текущем 9-шаговом milestone (docs/13 Этап 9: /solutions/* не существуют).
export function DepartmentCTA({ label }: DepartmentCTAProps) {
  return (
    <button type="button" className={styles.cta}>
      {label}
    </button>
  );
}
