import { Header } from "@/components/homepage/Header";
import { getHomepageCopy } from "@/content/homepage-copy";
import styles from "./PublicPages.module.css";

export default function PublicPagesLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const copy = getHomepageCopy();

  return (
    <div className={styles.shell}>
      <Header
        links={copy.heroLinks}
        phoneLabel={copy.headerPhone}
        phoneHref={copy.headerPhoneHref}
        phoneAccessibleLabel={copy.headerPhoneAccessibleLabel}
      />
      <main className={styles.main}>{children}</main>
    </div>
  );
}
