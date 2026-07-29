const SITE_ORIGIN = "https://allqbit.ru";
export const PRODUCTS_URL = `${SITE_ORIGIN}/products`;
export const BLOG_URL = `${SITE_ORIGIN}/blog`;

interface ProductState {
  slug: string;
  isPublished: boolean;
}

interface ArticleState {
  slug: string;
  status: "draft" | "published";
}

function unique(urls: readonly string[]): string[] {
  return [...new Set(urls)];
}

const productUrl = (slug: string) => `${PRODUCTS_URL}/${slug}`;
const articleUrl = (slug: string) => `${BLOG_URL}/${slug}`;

export function productUpdateIndexNowUrls(previous: ProductState, current: ProductState): string[] {
  const urls: string[] = [];
  if (previous.isPublished && (previous.slug !== current.slug || !current.isPublished)) {
    urls.push(productUrl(previous.slug));
  }
  if (current.isPublished) urls.push(productUrl(current.slug));
  urls.push(PRODUCTS_URL);
  return unique(urls);
}

export function productReorderIndexNowUrls(): string[] {
  return [PRODUCTS_URL];
}

export function articleCreateIndexNowUrls(article: ArticleState): string[] {
  return article.status === "published" ? [articleUrl(article.slug), BLOG_URL] : [];
}

export function articleUpdateIndexNowUrls(previous: ArticleState, current: ArticleState): string[] {
  const urls: string[] = [];
  if (
    previous.status === "published" &&
    (previous.slug !== current.slug || current.status !== "published")
  ) {
    urls.push(articleUrl(previous.slug));
  }
  if (current.status === "published") urls.push(articleUrl(current.slug));
  urls.push(BLOG_URL);
  return unique(urls);
}

export function articleDeleteIndexNowUrls(article: ArticleState): string[] {
  return article.status === "published" ? [articleUrl(article.slug), BLOG_URL] : [BLOG_URL];
}
