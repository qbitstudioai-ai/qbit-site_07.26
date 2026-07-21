import type { Department, DepartmentId, TaskSectionCopy } from "@/content/types";
import { type OfficeSectionId } from "@/features/office-machine/reducer";
import { buildOfficeSections } from "@/features/office-machine/sections";
import { photoByDepartmentId } from "./departmentPhotos";
import { RouteMarker } from "@/components/graphics/RouteMarker";
import { OfficePhoto } from "./OfficePhoto";
import styles from "./DepartmentNavigationRail.module.css";

interface DepartmentNavigationRailProps {
  departments: Department[];
  activeSectionId: OfficeSectionId | null;
  /** Копирайт раздела «Ваша задача» — источник подписи его пункта в реестре разделов (Step 18). */
  taskCopy: TaskSectionCopy;
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
  taskCopy,
  onSelectDepartment,
}: DepartmentNavigationRailProps) {
  // Step 18: рельс идёт по РЕЕСТРУ разделов, а не по «пять отделов циклом плюс шестой литералом».
  // Прежняя редакция повторяла разметку активного/неактивного состояния дважды, и любая правка
  // поведения пункта требовала одинаковой правки в двух местах — расхождение между ними было бы
  // видно только глазами.
  const sections = buildOfficeSections(departments, taskCopy);

  return (
    <nav aria-label="Панель отделов" className={styles.rail}>
      <ul className={styles.list}>
        {sections.map((section) => {
          const isActive = section.id === activeSectionId;
          const isDepartment = section.kind === "department";
          // Миниатюра — признак отдела: у разделов иного рода фотографии нет и быть не должно.
          const thumbnail = isDepartment ? (
            <span className={styles.thumbnailWrap}>
              <OfficePhoto
                src={photoByDepartmentId[section.id as DepartmentId]}
                className={styles.thumbnail}
              />
            </span>
          ) : null;

          return (
            // aria-current стоит на <li>, а НЕ на внутреннем <span>: у span нет роли, Chromium
            // сводит его к `generic` и атрибут до дерева доступности не доходит вовсе (проверено
            // снимком AX-дерева, skeptic Phase B Step 14). У <li> роль listitem — настоящая, и
            // атрибут на ней сохраняется.
            //
            // Разделы, не являющиеся отделами, отделены визуально (.taskItem) и по смыслу: это не
            // часть офиса, а прямой путь написать о своей задаче (Step 12.7). Ведут себя как
            // остальные пункты — активный рендерится не кнопкой, а маркером, поэтому
            // Tab-последовательность рельса остаётся «все пункты, кроме текущего».
            <li
              key={section.id}
              className={isDepartment ? styles.item : `${styles.item} ${styles.taskItem}`}
              aria-current={isActive ? "true" : undefined}
            >
              {isActive ? (
                <span className={styles.current}>
                  {thumbnail}
                  <RouteMarker direction="up" className={styles.currentMark} />
                  {/* Текстовый эквивалент статуса — третий канал, которого требует план (форма +
                      aria-current + текст). Он же единственный, что не зависит от того, как браузер
                      обходится с ARIA на элементах без роли: это обычный текст в дереве
                      доступности. Скрыт визуально, потому что зрячему статус уже сообщают маркер,
                      фон и начертание. */}
                  <span className={styles.statusText}>
                    {isDepartment ? "Текущий отдел: " : "Текущий раздел: "}
                  </span>
                  {section.railLabel}
                </span>
              ) : (
                <button
                  type="button"
                  className={styles.railButton}
                  onClick={() => onSelectDepartment(section.id)}
                >
                  {thumbnail}
                  {section.railLabel}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
