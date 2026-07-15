import { getDepartments } from "@/content/departments";
import { getHomepageCopy } from "@/content/homepage-copy";
import { getOfficeZones } from "@/content/office-zones";
import { OfficeMachine } from "@/features/office-machine/OfficeMachine";
import { Header } from "./Header";
import styles from "./HomepageShell.module.css";

interface HomepageShellProps {
  initialRevealed: boolean;
}

export function HomepageShell({ initialRevealed }: HomepageShellProps) {
  const copy = getHomepageCopy();
  const departments = getDepartments();
  const officeZones = getOfficeZones();

  return (
    <div className={styles.shell}>
      <Header />
      <main className={styles.main}>
        <OfficeMachine
          copy={copy}
          departments={departments}
          officeZones={officeZones}
          initialRevealed={initialRevealed}
        />
      </main>
    </div>
  );
}
