import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getHomepageCopy } from "@/content/homepage-copy";
import { ProductsExperience } from "@/features/products/ProductsExperience";
import { automationLabImage, findProductById } from "@/features/products/products";
import { productStructuredData, productUrl, SITE_URL } from "@/features/products/productSeo";
import { serializeJsonLd } from "@/lib/jsonLd";
import {
  breadcrumbNode,
  buildOpenGraph,
  buildTwitter,
  INDEXABLE_ROBOTS,
  organizationNode,
  webPageNode,
} from "@/lib/seo";
import { getProductBySlug, getProducts, getProductsPageCopy } from "@/server/content/products";

interface ProductsPageProps {
  params: Promise<{ slug?: string[] }>;
}

/**
 * `dynamicParams = true`: адрес продукта редактируется в админ-панели, и новый slug появляется уже
 * после сборки. При `false` такая страница отдавала бы 404 до следующего деплоя.
 */
export const dynamicParams = true;

export function generateStaticParams() {
  const products = getProducts();
  return [
    { slug: [] },
    ...products.map((product) => ({ slug: [product.slug] })),
    // Прежние адреса вида /products/product-01 остаются рабочими: страница ниже переадресует их на
    // текущий slug. Раньше это делал `redirects()` в next.config.ts — но там список адресов
    // фиксировался на сборке и «протухал» после первой же правки адреса в админ-панели.
    ...products.map((product) => ({ slug: [product.id] })),
  ];
}

export async function generateMetadata({ params }: ProductsPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = slug?.length === 1 ? getProductBySlug(slug[0]) : undefined;
  const copy = getProductsPageCopy();

  if (!product) {
    const url = `${SITE_URL}/products`;
    const image = { url: `${SITE_URL}${automationLabImage.fallbackSrc}` };
    return {
      title: copy.seoTitle,
      description: copy.seoDescription,
      alternates: { canonical: url },
      robots: INDEXABLE_ROBOTS,
      openGraph: buildOpenGraph({
        title: copy.seoTitle,
        description: copy.seoDescription,
        url,
        images: [image],
      }),
      twitter: buildTwitter({
        title: copy.seoTitle,
        description: copy.seoDescription,
        images: [image.url],
      }),
    };
  }

  const canonical = productUrl(product);
  const image = { url: `${SITE_URL}${product.images.detail.fallbackSrc}`, alt: product.images.alt };
  return {
    title: product.seo.title,
    description: product.seo.description,
    alternates: { canonical },
    robots: INDEXABLE_ROBOTS,
    openGraph: buildOpenGraph({
      title: product.seo.title,
      description: product.seo.description,
      url: canonical,
      images: [image],
    }),
    twitter: buildTwitter({
      title: product.seo.title,
      description: product.seo.description,
      images: [image.url],
    }),
  };
}

export default async function ProductsPage({ params }: ProductsPageProps) {
  const { slug } = await params;

  if (slug && slug.length > 1) {
    notFound();
  }

  const products = getProducts();
  const requested = slug?.[0];
  const product = getProductBySlug(requested);

  if (requested && !product) {
    // Старый адрес по системному идентификатору — постоянная переадресация на текущий slug.
    const byId = findProductById(products, requested);
    if (byId) permanentRedirect(`/products/${byId.slug}`);
    notFound();
  }

  const copy = getHomepageCopy();
  const pageCopy = getProductsPageCopy();
  const structuredData = product
    ? productStructuredData(product)
    : [
        breadcrumbNode([
          { name: "Главная", url: SITE_URL },
          { name: pageCopy.headline, url: `${SITE_URL}/products` },
        ]),
        webPageNode({
          url: `${SITE_URL}/products`,
          name: pageCopy.seoTitle,
          description: pageCopy.seoDescription,
          type: "CollectionPage",
        }),
        {
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "Продукты и стоимость",
          itemListElement: products.map((item, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: item.fullTitle,
            url: productUrl(item),
          })),
        },
        organizationNode(),
      ];

  return (
    <>
      {!product ? (
        <link
          rel="preload"
          as="image"
          href="/products/automation-lab-main-1600.avif"
          type="image/avif"
          fetchPriority="high"
        />
      ) : null}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }}
      />
      <ProductsExperience
        products={products}
        pageCopy={pageCopy}
        initialProductId={product?.id ?? null}
        taskCtaLabel={copy.taskSection.overviewCtaLabel}
        taskCtaHref={copy.contactHref}
      />
    </>
  );
}
