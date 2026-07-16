import styles from "./OutcomePanel.module.css";

interface OutcomePanelProps {
  outcomes: string[];
}

export function OutcomePanel({ outcomes }: OutcomePanelProps) {
  return (
    <ul className={styles.outcomes}>
      {outcomes.map((outcome) => (
        <li key={outcome}>{outcome}</li>
      ))}
    </ul>
  );
}
