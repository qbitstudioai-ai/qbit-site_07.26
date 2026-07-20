import type { Department, DepartmentId, OfficeZone } from "@/content/types";
import styles from "./DepartmentHotspot.module.css";
import { hotspotId } from "@/features/office-machine/focusTargets";

interface DepartmentHotspotProps {
  zone: OfficeZone;
  department: Department;
  onSelect: (departmentId: DepartmentId) => void;
}

export function DepartmentHotspot({ zone, department, onSelect }: DepartmentHotspotProps) {
  const problemId = `department-problem-${department.id}`;

  return (
    <button
      type="button"
      id={hotspotId(department.id)}
      className={styles.hotspot}
      style={{
        left: `${zone.x}%`,
        top: `${zone.y}%`,
        width: `${zone.width}%`,
        height: `${zone.height}%`,
      }}
      aria-label={department.overviewLabel}
      aria-describedby={problemId}
      onClick={() => onSelect(department.id)}
    >
      <span className={styles.label}>{department.overviewLabel}</span>
      <span id={problemId} className={styles.problem}>
        {department.overviewProblem}
      </span>
    </button>
  );
}
