import type { Department } from "@/content/types";
import { TASK_SECTION_ID, type OfficeSectionId } from "@/features/office-machine/reducer";
import { photoByDepartmentId } from "./departmentPhotos";
import { RouteMarker } from "@/components/graphics/RouteMarker";
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
// элемента rail" в Tab-порядке) — решение зафиксировано в DECISIONS.md 2026-07-16 "Step 6: состав
// DepartmentNavigationRail".
//
// Статус активного пункта передаётся ТРЕМЯ каналами, и порядок здесь по надёжности, а не по виду:
//   1. скрытый ТЕКСТ «Текущий отдел: …» — несущий канал для скринридера. Проверяемый: виден в
//      ariaSnapshot (сторож — accessibility-scan.spec.ts). Не удалять: без него статус для AT
//      исчезает совсем;
//   2. ФОРМА — треугольный маркер логотипа (Step 14) плюс фон и начертание: канал для зрячего,
//      закрывает docs/14 "active не только цветом";
//   3. aria-current на <li> — корректная разметка, но НИЧЕГО на неё не опирается: Chromium не
//      выводит это свойство в дерево доступности даже на элементе с ролью listitem (проверено
//      снимком AX-дерева, skeptic Phase B Step 14). Реальные AT его, вероятно, объявляют, но
//      полагаться на непроверяемое нельзя — отсюда пункт 1.
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
            // aria-current стоит на <li>, а НЕ на внутреннем <span>: у span нет роли, Chromium
            // сводит его к `generic` и атрибут до дерева доступности не доходит вовсе (проверено
            // снимком AX-дерева, skeptic Phase B Step 14). У <li> роль listitem — настоящая, и
            // атрибут на ней сохраняется.
            <li
              key={department.id}
              className={styles.item}
              aria-current={isActive ? "true" : undefined}
            >
              {isActive ? (
                <span className={styles.current}>
                  <span className={styles.thumbnailWrap}>
                    <OfficePhoto
                      src={photoByDepartmentId[department.id]}
                      className={styles.thumbnail}
                    />
                  </span>
                  <RouteMarker direction="up" className={styles.currentMark} />
                  {/* Текстовый эквивалент статуса — третий канал, которого требует план (форма +
                      aria-current + текст). Он же единственный, что не зависит от того, как браузер
                      обходится с ARIA на элементах без роли: это обычный текст в дереве
                      доступности. Скрыт визуально, потому что зрячему статус уже сообщают маркер,
                      фон и начертание. */}
                  <span className={styles.statusText}>Текущий отдел: </span>
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
        <li
          className={`${styles.item} ${styles.taskItem}`}
          aria-current={isTaskActive ? "true" : undefined}
        >
          {isTaskActive ? (
            <span className={styles.current}>
              <RouteMarker direction="up" className={styles.currentMark} />
              <span className={styles.statusText}>Текущий раздел: </span>
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
