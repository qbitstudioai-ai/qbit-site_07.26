import type { Department, DepartmentId } from "@/content/types";
import styles from "./DepartmentNavigationRail.module.css";

interface DepartmentNavigationRailProps {
  departments: Department[];
  activeDepartmentId: DepartmentId;
  onSelectDepartment: (departmentId: DepartmentId) => void;
}

// Список содержит все 5 отделов (docs/03-office-map.md "пять миниатюр"), но только 4 не активных
// рендерятся как кликабельные кнопки, диспетчерящие SWITCH_DEPARTMENT (WORKPLAN.md Step 6: "список
// из 4 доступных кнопок для оставшихся отделов"). Активный отдел рендерится как не интерактивный
// маркер (не <button>, не в Tab-последовательности — согласуется с acceptance criterion 5: "4
// элемента rail" в Tab-порядке) с текстовым/иконочным индикатором в дополнение к цвету
// (aria-current="true" + "●", docs/14 "active не только цветом") — решение зафиксировано в
// DECISIONS.md 2026-07-16 "Step 6: состав DepartmentNavigationRail".
export function DepartmentNavigationRail({
  departments,
  activeDepartmentId,
  onSelectDepartment,
}: DepartmentNavigationRailProps) {
  return (
    <nav aria-label="Панель отделов" className={styles.rail}>
      <ul className={styles.list}>
        {departments.map((department) => {
          const isActive = department.id === activeDepartmentId;
          return (
            <li key={department.id} className={styles.item}>
              {isActive ? (
                <span className={styles.current} aria-current="true">
                  <span aria-hidden="true" className={styles.currentMark}>
                    ●
                  </span>
                  {department.overviewLabel}
                </span>
              ) : (
                <button
                  type="button"
                  className={styles.railButton}
                  onClick={() => onSelectDepartment(department.id)}
                >
                  {department.overviewLabel}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
