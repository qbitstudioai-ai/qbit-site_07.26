import type { TaskSectionCopy } from "@/content/types";
import { ContactForm } from "@/features/contacts/ContactForm";
import type { ContactChannel } from "@/features/contacts/contactData";
import { TASK_SECTION_ID, type OfficeMachineView } from "@/features/office-machine/reducer";
import styles from "./TaskSectionExperience.module.css";
import { sectionHeadingId } from "@/features/office-machine/focusTargets";

interface TaskSectionExperienceProps {
  copy: TaskSectionCopy;
  machineView: OfficeMachineView;
  contactChannels: readonly ContactChannel[];
  onClose: () => void;
}

// 90%-область раздела «Ваша задача» (Step 12.7) — аналог DepartmentExperience, но вместо болей и
// выгод показывает форму. Классы переходов повторяют DepartmentExperience сознательно: раздел
// открывается, переключается и закрывается теми же действиями машины и должен двигаться так же,
// иначе переключение «отдел ↔ задача» выглядело бы рывком.
export function TaskSectionExperience({
  copy,
  machineView,
  contactChannels,
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
      <h2 id={sectionHeadingId(TASK_SECTION_ID)} tabIndex={-1} className={styles.headline}>
        {copy.headline}
      </h2>
      <p className={styles.intro}>{copy.intro}</p>

      <div className={styles.contactFormPanel}>
        {/* Раздел «Ваша задача» — состояние главной страницы (`/?section=task`), а не отдельный
            адрес. В заявку уходит именно `/`: до этой правки такое обращение приходило в n8n
            помеченным как заявка со страницы контактов. */}
        <ContactForm channels={contactChannels} page="/" />
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.close} onClick={onClose}>
          Закрыть
        </button>
      </div>
    </section>
  );
}
