import { OfficeExperience } from "@/components/office/OfficeExperience";
import { Header } from "./Header";
import { HeroCopy } from "./HeroCopy";
import styles from "./HomepageShell.module.css";

export function HomepageShell() {
  return (
    <div className={styles.shell}>
      <Header />
      <main className={styles.main}>
        <HeroCopy />
        <OfficeExperience />
      </main>
    </div>
  );
}
