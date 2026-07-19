import type { TaskSectionCopy } from "@/content/types";
import { TASK_SECTION_ID, type OfficeMachineView } from "@/features/office-machine/reducer";
import { TaskForm } from "./TaskForm";
import styles from "./TaskSectionExperience.module.css";

interface TaskSectionExperienceProps {
  copy: TaskSectionCopy;
  machineView: OfficeMachineView;
  contactHref: string;
  onClose: () => void;
}

// 90%-область раздела «Ваша задача» (Step 12.7) — аналог DepartmentExperience, но вместо болей и
// выгод показывает форму. Классы переходов повторяют DepartmentExperience сознательно: раздел
// открывается, переключается и закрывается теми же действиями машины и должен двигаться так же,
// иначе переключение «отдел ↔ задача» выглядело бы рывком.
export function TaskSectionExperience({
  copy,
  machineView,
  contactHref,
  onClose,
}: TaskSectionExperienceProps) {
  const transitionClassName =
    machineView === "department-opening"
      ? styles.opening
      : machineView === "department-switching"
        ? styles.switching
        : machineView === "department-closing"
          ? styles.closing
          : styles.active;

  return (
    <section className={`${styles.experience} ${transitionClassName}`} aria-label={copy.headline}>
      {/* id по той же схеме, что у отделов (`department-heading-<id>`): OfficeMachine переносит на
          него фокус при открытии и переключении раздела. Разъехавшаяся схема id молча сломала бы
          перенос фокуса — заголовок просто не нашёлся бы. */}
      <h2 id={`department-heading-${TASK_SECTION_ID}`} tabIndex={-1} className={styles.headline}>
        {copy.headline}
      </h2>
      <p className={styles.intro}>{copy.intro}</p>

      <TaskForm copy={copy} contactHref={contactHref} />

      <div className={styles.actions}>
        <button type="button" className={styles.close} onClick={onClose}>
          Закрыть
        </button>
      </div>
    </section>
  );
}
