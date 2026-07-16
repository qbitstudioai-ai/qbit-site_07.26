import type { Department } from "@/content/types";
import styles from "./DepartmentCopy.module.css";

interface DepartmentCopyProps {
  department: Department;
}

export function DepartmentCopy({ department }: DepartmentCopyProps) {
  // Максимум 3 симптома в основном UI (docs/12-content-data-model.md); данные уже содержат ровно 3
  // на отдел (см. data/departments.json), .slice(0, 3) — защита инварианта, а не обрезка реальных
  // данных.
  const symptoms = department.symptoms.slice(0, 3);

  return (
    <div className={styles.copy}>
      <h2 id={`department-heading-${department.id}`} tabIndex={-1} className={styles.heading}>
        {department.headline}
      </h2>
      <p className={styles.problem}>{department.problem}</p>
      {symptoms.length > 0 && (
        <ul className={styles.symptoms}>
          {symptoms.map((symptom) => (
            <li key={symptom}>{symptom}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
