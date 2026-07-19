import type { Department } from "@/content/types";
import { TASK_SECTION_ID, type OfficeSectionId } from "@/features/office-machine/reducer";
import { photoByDepartmentId } from "./departmentPhotos";
import { OfficePhoto } from "./OfficePhoto";
import styles from "./DepartmentNavigationRail.module.css";

interface DepartmentNavigationRailProps {
  departments: Department[];
  activeSectionId: OfficeSectionId | null;
  /** Подпись шестого пункта — раздела «Ваша задача» (Step 12.7). */
  taskRailLabel: string;
  onSelectDepartment: (sectionId: OfficeSectionId) => void;
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
  activeSectionId,
  taskRailLabel,
  onSelectDepartment,
}: DepartmentNavigationRailProps) {
  const isTaskActive = activeSectionId === TASK_SECTION_ID;
  return (
    <nav aria-label="Панель отделов" className={styles.rail}>
      <ul className={styles.list}>
        {departments.map((department) => {
          const isActive = department.id === activeSectionId;
          return (
            <li key={department.id} className={styles.item}>
              {isActive ? (
                <span className={styles.current} aria-current="true">
                  <span className={styles.thumbnailWrap}>
                    <OfficePhoto
                      src={photoByDepartmentId[department.id]}
                      className={styles.thumbnail}
                    />
                  </span>
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
                  <span className={styles.thumbnailWrap}>
                    <OfficePhoto
                      src={photoByDepartmentId[department.id]}
                      className={styles.thumbnail}
                    />
                  </span>
                  {department.overviewLabel}
                </button>
              )}
            </li>
          );
        })}
        {/* Step 12.7: шестой пункт — «Ваша задача». Отделён от пяти отделов и визуально
            (см. .taskItem), и по смыслу: это не отдел офиса, а прямой путь написать о своей задаче.
            Ведёт себя как остальные пункты — активный рендерится не кнопкой, а маркером, поэтому
            Tab-последовательность рельса остаётся «все пункты, кроме текущего». */}
        <li className={`${styles.item} ${styles.taskItem}`}>
          {isTaskActive ? (
            <span className={styles.current} aria-current="true">
              <span aria-hidden="true" className={styles.currentMark}>
                ●
              </span>
              {taskRailLabel}
            </span>
          ) : (
            <button
              type="button"
              className={styles.railButton}
              onClick={() => onSelectDepartment(TASK_SECTION_ID)}
            >
              {taskRailLabel}
            </button>
          )}
        </li>
      </ul>
    </nav>
  );
}
