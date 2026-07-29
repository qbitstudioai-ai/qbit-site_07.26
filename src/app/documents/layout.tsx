import { Header } from "@/components/homepage/Header";
import { getHomepageCopy } from "@/content/homepage-copy";
import styles from "./DocumentsLayout.module.css";

export default function DocumentsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const copy = getHomepageCopy();

  return (
    <div className={styles.shell}>
      <Header
        links={copy.heroLinks}
        phoneLabel={copy.headerPhone}
        phoneHref={copy.headerPhoneHref}
        phoneAccessibleLabel={copy.headerPhoneAccessibleLabel}
        activeHref="/documents"
      />
      <div className={styles.main}>{children}</div>
    </div>
  );
}
