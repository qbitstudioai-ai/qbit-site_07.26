import { describe, expect, it } from "vitest";
import {
  breadcrumbNode,
  buildOpenGraph,
  buildTwitter,
  CONTENT_LANGUAGE,
  DEFAULT_OG_IMAGE,
  INDEXABLE_ROBOTS,
  OG_LOCALE,
  ORGANIZATION_ID,
  organizationNode,
  SITE_NAME,
  SITE_URL,
  webPageNode,
  webSiteNode,
  withBrand,
} from "@/lib/seo";

/**
 * Аудит SEO/GEO 2026-07-28.
 *
 * Проверяется то, что ломается молча: адрес сайта, общие поля Open Graph (метаданные Next.js
 * сливаются ПОВЕРХНОСТНО, поэтому `siteName`/`locale` теряются при первой же ручной сборке
 * `openGraph` мимо helper'а) и заявления в разметке о том, чего на сайте нет.
 */

describe("константы адреса сайта", () => {
  it("основной домен — https://allqbit.ru, без завершающего слэша и без localhost", () => {
    expect(SITE_URL).toBe("https://allqbit.ru");
    expect(SITE_URL).not.toMatch(/\/$/);
    expect(SITE_URL).not.toMatch(/localhost|127\.0\.0\.1/);
  });

  it("идентификаторы графа построены от того же домена", () => {
    expect(ORGANIZATION_ID).toBe(`${SITE_URL}/#organization`);
  });
});

describe("правила индексирования публичных страниц", () => {
  it("разрешают индексирование и не урезают сниппет", () => {
    expect(INDEXABLE_ROBOTS).toMatchObject({
      index: true,
      follow: true,
      googleBot: { "max-image-preview": "large", "max-snippet": -1 },
    });
  });
});

describe("корневой layout", () => {
  /**
   * Регрессия аудита 2026-07-28. Правила индексирования пробовали задать один раз — в корневом
   * layout. На собранном сайте они доставались и странице 404, к которой Next.js добавляет
   * собственный `noindex`: в `<head>` оказывались `noindex` и `index, follow` одновременно.
   *
   * Ни `robots`, ни `alternates` в корневом layout быть не должно — иначе значение неизбежно
   * протечёт на 404 и служебные страницы.
   */
  it("не задаёт robots и canonical, которые протекли бы на 404", async () => {
    const { metadata } = await import("@/app/layout");

    expect(metadata.robots).toBeUndefined();
    expect(metadata.alternates).toBeUndefined();
    expect(metadata.metadataBase?.toString()).toBe(`${SITE_URL}/`);
  });
});

describe("withBrand", () => {
  it("добавляет бренд к заголовку, где его нет", () => {
    expect(withBrand("Документы")).toBe(`Документы — ${SITE_NAME}`);
  });

  it("НЕ повторяет бренд, если он уже внутри заголовка", () => {
    // Регрессия: раздел блога отдавал title «Блог QBit-Studio-Ai — QBit-Studio-Ai».
    expect(withBrand(`Блог ${SITE_NAME}`)).toBe(`Блог ${SITE_NAME}`);
  });
});

describe("buildOpenGraph", () => {
  const input = {
    title: "Заголовок страницы",
    description: "Описание страницы.",
    url: `${SITE_URL}/products`,
  };

  it("всегда проставляет общие поля site_name и locale", () => {
    const og = buildOpenGraph(input);

    expect(og).toMatchObject({ siteName: SITE_NAME, locale: OG_LOCALE, type: "website" });
  });

  it("подставляет техническую обложку, когда своей у страницы нет", () => {
    expect(buildOpenGraph(input).images).toEqual([DEFAULT_OG_IMAGE]);
  });

  it("сохраняет обложку страницы, если она передана", () => {
    const images = [{ url: `${SITE_URL}/dox/dox-1600.webp`, alt: "Архив" }];

    expect(buildOpenGraph({ ...input, images }).images).toEqual(images);
  });

  it("для статьи отдаёт type=article и даты публикации", () => {
    const og = buildOpenGraph({
      ...input,
      type: "article",
      publishedTime: "2026-07-25",
      modifiedTime: "2026-07-26",
    });

    expect(og).toMatchObject({
      type: "article",
      publishedTime: "2026-07-25",
      modifiedTime: "2026-07-26",
    });
  });

  it("все адреса обложек абсолютные и без localhost", () => {
    for (const image of buildOpenGraph(input).images as { url: string }[]) {
      expect(image.url).toMatch(/^https:\/\/allqbit\.ru\//);
    }
  });
});

describe("buildTwitter", () => {
  it("ставит карточку с крупной картинкой и запасное изображение", () => {
    const twitter = buildTwitter({ title: "Т", description: "О" });

    expect(twitter).toMatchObject({
      card: "summary_large_image",
      images: [DEFAULT_OG_IMAGE.url],
    });
  });
});

describe("узлы schema.org", () => {
  it("Organization описывает только проверяемые факты", () => {
    const organization = organizationNode();

    expect(organization["@id"]).toBe(ORGANIZATION_ID);
    expect(organization.name).toBe(SITE_NAME);
    // Ни рейтингов, ни числа клиентов, ни наград, ни выдуманных профилей.
    expect(organization).not.toHaveProperty("aggregateRating");
    expect(organization).not.toHaveProperty("review");
    expect(organization).not.toHaveProperty("award");
    expect(organization).not.toHaveProperty("sameAs");
    expect(organization).not.toHaveProperty("contactPoint");
  });

  it("Organization принимает sameAs и contactPoint только явной передачей", () => {
    const organization = organizationNode({
      sameAs: ["https://t.me/qbit_studioai"],
      contactPoint: [{ "@type": "ContactPoint", telephone: "+7 937 534-65-75" }],
    });

    expect(organization.sameAs).toEqual(["https://t.me/qbit_studioai"]);
    expect(organization.contactPoint).toHaveLength(1);
  });

  it("WebSite не заявляет поиск, которого на сайте нет", () => {
    const website = webSiteNode();

    expect(website.inLanguage).toBe(CONTENT_LANGUAGE);
    // SearchAction без реального поиска — заявление о несуществующей возможности.
    expect(website).not.toHaveProperty("potentialAction");
  });

  it("WebPage связан с сайтом и организацией общими идентификаторами", () => {
    const page = webPageNode({
      url: `${SITE_URL}/contacts`,
      name: "Обсудим вашу задачу",
      description: "Описание.",
      type: "ContactPage",
    });

    expect(page["@type"]).toBe("ContactPage");
    expect(page["@id"]).toBe(`${SITE_URL}/contacts#webpage`);
    expect(page.isPartOf).toEqual({ "@id": `${SITE_URL}/#website` });
  });

  it("BreadcrumbList нумеруется с единицы и хранит абсолютные адреса", () => {
    const breadcrumbs = breadcrumbNode([
      { name: "Главная", url: SITE_URL },
      { name: "Блог", url: `${SITE_URL}/blog` },
    ]);

    expect(breadcrumbs.itemListElement.map((item) => item.position)).toEqual([1, 2]);
    for (const item of breadcrumbs.itemListElement) {
      expect(item.item).toMatch(/^https:\/\/allqbit\.ru/);
    }
  });
});
