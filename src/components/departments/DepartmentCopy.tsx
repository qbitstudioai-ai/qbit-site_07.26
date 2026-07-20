import type { Department } from "@/content/types";
import styles from "./DepartmentCopy.module.css";

interface DepartmentCopyProps {
  department: Department;
  /**
   * Класс места использования — сейчас это ступень каскада появления (Step 15.5). Кладётся на тот же
   * корневой элемент, а не на обёртку вокруг него: у `.copy` есть `flex-shrink: 0` и
   * `max-width: 60%`, и лишний flex-элемент между ним и `.experience` сломал бы и то, и другое.
   */
  className?: string;
}

export function DepartmentCopy({ department, className }: DepartmentCopyProps) {
  return (
    <div className={className ? `${styles.copy} ${className}` : styles.copy}>
      <h2 id={`department-heading-${department.id}`} tabIndex={-1} className={styles.heading}>
        {department.headline}
      </h2>
      <p className={styles.problem}>{department.problem}</p>
    </div>
  );
}
