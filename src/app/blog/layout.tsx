import { Header } from "@/components/homepage/Header";
import { getHomepageCopy } from "@/content/homepage-copy";
import styles from "./BlogLayout.module.css";

export default function BlogLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const copy = getHomepageCopy();

  return (
    <div className={styles.shell}>
      <Header
        links={copy.heroLinks}
        phoneLabel={copy.headerPhone}
        phoneHref={copy.headerPhoneHref}
        phoneAccessibleLabel={copy.headerPhoneAccessibleLabel}
        inactiveLinkLabels={["Контакты"]}
      />
      <div className={styles.main}>{children}</div>
    </div>
  );
}
