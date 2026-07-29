import { breadcrumbNode, organizationNode, SITE_URL, webPageNode } from "@/lib/seo";
import type { ContactChannel } from "./contactData";

/**
 * Канонический адрес страницы контактов — ОДИН источник для metadata страницы и для sitemap, чтобы
 * canonical и запись в карте сайта не могли разойтись (в том числе по завершающему слэшу).
 */
export const CONTACTS_URL = `${SITE_URL}/contacts`;

/**
 * `contactPoint` и `sameAs` СТРОГО из каналов, показанных на странице.
 *
 * Каналы правятся владельцем сайта в админ-панели, поэтому список не зашивается в код: удалённый
 * из интерфейса телефон обязан исчезнуть и из разметки. Ни адреса, ни реквизитов, ни часов работы
 * здесь нет — на странице их тоже нет, а `LocalBusiness` без подтверждённых данных запрещён.
 *
 * `sameAs` — только внешние профили (Telegram). `tel:`/`mailto:` профилями не являются и уходят
 * в `contactPoint`.
 */
export function contactsStructuredData(input: {
  channels: readonly ContactChannel[];
  heading: string;
  description: string;
}) {
  const contactPoint = input.channels
    .filter((channel) => channel.kind === "phone" || channel.kind === "email")
    .map((channel) => ({
      "@type": "ContactPoint",
      contactType: channel.label,
      ...(channel.kind === "phone" ? { telephone: channel.value } : { email: channel.value }),
    }));

  const sameAs = input.channels
    .filter((channel) => channel.external && /^https?:\/\//i.test(channel.href))
    .map((channel) => channel.href);

  return [
    breadcrumbNode([
      { name: "Главная", url: SITE_URL },
      { name: input.heading, url: CONTACTS_URL },
    ]),
    webPageNode({
      url: CONTACTS_URL,
      name: input.heading,
      description: input.description,
      type: "ContactPage",
    }),
    organizationNode({ sameAs, contactPoint }),
  ];
}
