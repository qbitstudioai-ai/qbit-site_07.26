import type { Metadata } from "next";
import { Header } from "@/components/homepage/Header";
import { getHomepageCopy } from "@/content/homepage-copy";
import { FaqExperience } from "@/features/faq/FaqExperience";
import styles from "@/features/faq/FaqExperience.module.css";
import { FAQ_URL, faqStructuredData } from "@/features/faq/faqSeo";
import { SITE_URL } from "@/features/products/productSeo";
import { serializeJsonLd } from "@/lib/jsonLd";
import { buildOpenGraph, buildTwitter, INDEXABLE_ROBOTS } from "@/lib/seo";

const title = "FAQ об AI-автоматизации бизнеса — QBit-Studio-Ai";
const description =
  "Ответы QBit-Studio-Ai на вопросы об AI-автоматизации: выбор процессов, интеграции, пилот, сроки, стоимость, безопасность, размещение и поддержка.";
// Обложка — та же фотография, что служит фоном раздела; отдельного OG-изображения проект не держит.
const ogImage = `${SITE_URL}/faq/faq-open-space-1672.webp`;
const ogImageAlt = "Переговорная в открытом офисе QBit-Studio-Ai со стеклянной доской";

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: FAQ_URL,
  },
  robots: INDEXABLE_ROBOTS,
  openGraph: buildOpenGraph({
    title,
    description,
    url: FAQ_URL,
    images: [{ url: ogImage, alt: ogImageAlt }],
  }),
  twitter: buildTwitter({ title, description, images: [ogImage] }),
};

export default function FaqPage() {
  const copy = getHomepageCopy();

  return (
    <div className={styles.shell}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(faqStructuredData()) }}
      />
      <Header
        links={copy.heroLinks}
        phoneLabel={copy.headerPhone}
        phoneHref={copy.headerPhoneHref}
        phoneAccessibleLabel={copy.headerPhoneAccessibleLabel}
      />
      <FaqExperience contactHref={copy.contactHref} />
    </div>
  );
}
