import Link from "next/link";
import { casePath, CASES_PATH } from "./casesRoutes";
import type { CaseStudy } from "./types";
import styles from "./CasesExperience.module.css";

/**
 * Картотека кейсов — стопка небольших папок слева.
 *
 * Серверный компонент и НАСТОЯЩИЕ ссылки. Это не оформительское решение: у каждого кейса свой
 * адрес, поэтому папку можно открыть в новой вкладке, скопировать, вернуться к ней Back'ом и найти
 * в поиске, когда раздел откроют для индексирования. Никакого `useState` с активным кейсом здесь
 * нет и не должно появиться — активность определяется адресом.
 *
 * Список не знает, сколько в нём элементов и откуда они: он получает готовый массив `CaseStudy`.
 * Новый кейс из будущей админ-панели получит свою папку со всеми состояниями автоматически.
 */

interface CaseSelectorProps {
  studies: CaseStudy[];
  /** Slug открытого кейса либо `null` на обложке архива. */
  activeSlug: string | null;
  /** Подпись под заголовком картотеки. */
  note: string;
}

export function CaseSelector({ studies, activeSlug, note }: CaseSelectorProps) {
  return (
    <nav className={styles.cabinet} aria-label="Кейсы">
      {/* Служебная надстрочная подпись ящика. Декоративна: она не сообщает ничего сверх того, что
          уже сказано названием списка и подписью под ним, — поэтому скрыта от скринридера, чтобы не
          добавлять шума перед самим перечнем дел. */}
      <p className={styles.cabinetEyebrow} aria-hidden="true">
        Опись дел
      </p>

      <p className={styles.cabinetHead}>
        <Link
          href={CASES_PATH}
          className={styles.cabinetHeadLink}
          aria-current={activeSlug === null ? "page" : undefined}
        >
          Архив
        </Link>
        <span className={styles.cabinetCount}>{String(studies.length).padStart(2, "0")}</span>
      </p>

      <ol className={styles.folders}>
        {studies.map((study) => {
          const isCurrent = study.slug === activeSlug;

          return (
            <li key={study.id} className={styles.folderItem}>
              <Link
                href={casePath(study)}
                className={`${styles.folder} ${isCurrent ? styles.folderCurrent : ""}`}
                aria-current={isCurrent ? "page" : undefined}
                data-case-folder={study.slug}
              >
                {/* Выступ папки. Декоративен: номер дела повторён текстом ниже. */}
                <span className={styles.folderTab} aria-hidden="true" />
                <span className={styles.folderBody}>
                  <span className={styles.folderCaption}>{study.folderCaption}</span>
                  <span className={styles.folderTitle}>{study.shortTitle}</span>
                </span>
                {/* Поле номера дела. Декоративно: номер уже прочитан в названии папки, и повторять
                    его скринридеру незачем. */}
                <span className={styles.folderNumber} aria-hidden="true">
                  <span className={styles.folderNumberLabel}>Дело</span>
                  {study.fileNumber}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>

      <p className={styles.cabinetNote}>{note}</p>
    </nav>
  );
}
