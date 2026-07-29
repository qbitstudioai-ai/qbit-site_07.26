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
    // Слой зон ПОВЕРХ кадра сцены, а не контейнер кадра (Step 18). Раньше overview рендерил сцену
    // сам — своим <OfficeScenePhoto> внутри собственного .scene. Из-за этого кадр менял ХОЗЯИНА при
    // открытии отдела: эта ветка размонтировалась целиком, а контейнер перехода монтировался заново
    // и удерживать ему было нечего. Измерено: до 863 мс белого экрана на мобильном Fast 3G.
    // Теперь кадр держит один общий сцен-слой в OfficeExperience, живущий через оба состояния, а
    // overview отвечает ровно за своё — за пять интерактивных зон поверх него.
    <nav aria-label="Отделы компании" className={styles.map}>
      <ul id="office-map" className={styles.zoneList}>
        {zones.map((zone) => {
          const department = departments.find((d) => d.id === zone.departmentId);
          // Отдел снят с публикации — зона не рисуется. Падать из-за этого главная не должна.
          if (!department) return null;
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
