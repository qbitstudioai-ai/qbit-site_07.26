import type { Metadata } from "next";
import { Header } from "@/components/homepage/Header";
import { getHomepageCopy } from "@/content/homepage-copy";
import { ContactsExperience } from "@/features/contacts/ContactsExperience";
import styles from "@/features/contacts/ContactsExperience.module.css";
import { CONTACTS_URL, contactsStructuredData } from "@/features/contacts/contactsSeo";
import { SITE_URL } from "@/features/products/productSeo";
import { serializeJsonLd } from "@/lib/jsonLd";
import { buildOpenGraph, buildTwitter, INDEXABLE_ROBOTS } from "@/lib/seo";
import { getContactChannels, getContactsPageCopy } from "@/server/content/contacts";

/**
 * Фоновое обновление: телефон, почта и Telegram правятся в админ-панели, а образ собирается там,
 * где базы нет. Подробное объяснение — в `src/app/page.tsx`.
 */
export const revalidate = 300;

const title = "Контакты QBit-Studio-Ai — обсудить AI-автоматизацию";
const description =
  "Свяжитесь с QBit-Studio-Ai в Telegram, по телефону или email и отправьте заявку на автоматизацию бизнес-процесса.";
// Обложка — та же фотография, что служит фоном раздела; отдельного OG-изображения проект не держит.
const ogImage = `${SITE_URL}/contacts/contacts-meeting-room-1672.webp`;
const ogImageAlt =
  "Переговорная комната QBit-Studio-Ai с деревянным столом и телевизором с логотипом компании";

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: CONTACTS_URL,
  },
  robots: INDEXABLE_ROBOTS,
  openGraph: buildOpenGraph({
    title,
    description,
    url: CONTACTS_URL,
    images: [{ url: ogImage, alt: ogImageAlt }],
  }),
  twitter: buildTwitter({ title, description, images: [ogImage] }),
};

export default function ContactsPage() {
  const copy = getHomepageCopy();
  const channels = getContactChannels();
  const pageCopy = getContactsPageCopy();

  const structuredData = contactsStructuredData({
    channels,
    heading: pageCopy.heading,
    description: pageCopy.intro,
  });

  return (
    <div className={styles.shell}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }}
      />
      <Header
        links={copy.heroLinks}
        phoneLabel={copy.headerPhone}
        phoneHref={copy.headerPhoneHref}
        phoneAccessibleLabel={copy.headerPhoneAccessibleLabel}
        activeHref="/contacts"
      />
      <ContactsExperience channels={channels} copy={pageCopy} />
    </div>
  );
}
