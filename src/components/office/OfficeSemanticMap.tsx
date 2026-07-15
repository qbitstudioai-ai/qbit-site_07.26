import type { Department, DepartmentId, OfficeZone } from "@/content/types";
import { DepartmentHotspot } from "./DepartmentHotspot";
import styles from "./OfficeSemanticMap.module.css";

interface OfficeSemanticMapProps {
  departments: Department[];
  officeZones: OfficeZone[];
  onSelectDepartment: (departmentId: DepartmentId) => void;
}

export function OfficeSemanticMap({
  departments,
  officeZones,
  onSelectDepartment,
}: OfficeSemanticMapProps) {
  const zones = officeZones.slice().sort((a, b) => a.y - b.y || a.x - b.x);

  return (
    <nav aria-label="Отделы компании" className={styles.map}>
      <ul id="office-map" className={styles.zoneList}>
        {zones.map((zone) => {
          const department = departments.find((d) => d.id === zone.departmentId);
          if (!department) {
            throw new Error(
              `OfficeSemanticMap: no department found for zone.departmentId="${zone.departmentId}"`,
            );
          }
          return (
            <li key={zone.departmentId} className={styles.zoneItem}>
              <DepartmentHotspot
                zone={zone}
                department={department}
                onSelect={onSelectDepartment}
              />
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
