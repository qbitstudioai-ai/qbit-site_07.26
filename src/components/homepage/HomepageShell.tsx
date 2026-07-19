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
  const officeZones = getOfficeZones();

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
