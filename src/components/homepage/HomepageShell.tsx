import { getDepartments } from "@/content/departments";
import { getHomepageCopy } from "@/content/homepage-copy";
import { getOfficeZones } from "@/content/office-zones";
import type { DepartmentId } from "@/content/types";
import { OfficeMachine } from "@/features/office-machine/OfficeMachine";
import styles from "./HomepageShell.module.css";

interface HomepageShellProps {
  initialRevealed: boolean;
  initialDepartmentId: DepartmentId | null;
}

export function HomepageShell({ initialRevealed, initialDepartmentId }: HomepageShellProps) {
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
        initialDepartmentId={initialDepartmentId}
      />
    </div>
  );
}
