import { getDepartmentById } from "@/content/departments";
import { getOfficeZones } from "@/content/office-zones";
import { DepartmentHotspot } from "./DepartmentHotspot";
import styles from "./OfficeSemanticMap.module.css";

export function OfficeSemanticMap() {
  const zones = getOfficeZones()
    .slice()
    .sort((a, b) => a.y - b.y || a.x - b.x);

  return (
    <nav aria-label="Отделы компании" className={styles.map}>
      <ul id="office-map" className={styles.zoneList}>
        {zones.map((zone) => {
          const department = getDepartmentById(zone.departmentId);
          if (!department) {
            throw new Error(
              `OfficeSemanticMap: no department found for zone.departmentId="${zone.departmentId}"`,
            );
          }
          return (
            <li key={zone.departmentId} className={styles.zoneItem}>
              <DepartmentHotspot zone={zone} department={department} />
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
