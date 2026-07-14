import type { Department, OfficeZone } from "@/content/types";
import styles from "./DepartmentHotspot.module.css";

interface DepartmentHotspotProps {
  zone: OfficeZone;
  department: Department;
}

export function DepartmentHotspot({ zone, department }: DepartmentHotspotProps) {
  const problemId = `department-problem-${department.id}`;

  return (
    <button
      type="button"
      className={styles.hotspot}
      style={{
        left: `${zone.x}%`,
        top: `${zone.y}%`,
        width: `${zone.width}%`,
        height: `${zone.height}%`,
      }}
      aria-label={department.overviewLabel}
      aria-describedby={problemId}
    >
      <span className={styles.label}>{department.overviewLabel}</span>
      <span id={problemId} className={styles.problem}>
        {department.overviewProblem}
      </span>
    </button>
  );
}
