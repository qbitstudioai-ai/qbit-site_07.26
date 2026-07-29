import { getDepartments } from "@/content/departments";
import { getHomepageCopy } from "@/content/homepage-copy";
import { getOfficeZones } from "@/content/office-zones";
import type { OfficeSectionId } from "@/features/office-machine/reducer";
import { OfficeMachine } from "@/features/office-machine/OfficeMachine";
import styles from "./HomepageShell.module.css";

interface HomepageShellProps {
  initialRevealed: boolean;
  initialSectionId: OfficeSectionId | null;
}

export function HomepageShell({ initialRevealed, initialSectionId }: HomepageShellProps) {
  const copy = getHomepageCopy();
  const departments = getDepartments();

  /**
   * Зоны офиса согласуются с отделами ЗДЕСЬ, в одной точке.
   *
   * Карта офиса описана пятью зонами в `data/office-zones.json`, а отделы приходят из базы, где у
   * каждого есть флаг публикации. Стоило снять с публикации один отдел — и зона оставалась без
   * данных: `OfficeExperience` и `OfficeSemanticMap` на такую зону бросали исключение, то есть
   * ГЛАВНАЯ СТРАНИЦА падала с 500 у каждого посетителя после штатного нажатия галочки в
   * админ-панели (найдено code review 2026-07-27).
   *
   * Скрытый отдел означает «не показывать его в офисе», а не «уронить сайт»: зона без отдела
   * просто не отрисовывается. Пока опубликованы все пять отделов — на вид ничего не меняется.
   */
  const publishedIds = new Set(departments.map((department) => department.id));
  const officeZones = getOfficeZones().filter((zone) => publishedIds.has(zone.departmentId));

  return (
    <div className={styles.shell}>
      <OfficeMachine
        copy={copy}
        departments={departments}
        officeZones={officeZones}
        initialRevealed={initialRevealed}
        initialSectionId={initialSectionId}
      />
    </div>
  );
}
