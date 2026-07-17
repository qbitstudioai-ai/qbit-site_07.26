import type { Department } from "@/content/types";
import styles from "./DepartmentCopy.module.css";

interface DepartmentCopyProps {
  department: Department;
}

export function DepartmentCopy({ department }: DepartmentCopyProps) {
  return (
    <div className={styles.copy}>
      <h2 id={`department-heading-${department.id}`} tabIndex={-1} className={styles.heading}>
        {department.headline}
      </h2>
      <p className={styles.problem}>{department.problem}</p>
    </div>
  );
}
