"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Fragment,
  type MouseEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { findAdjacentBlogPosts, findBlogPost, findRelatedBlogPosts, type BlogPost } from "./posts";
import type { BlogPageCopy } from "@/server/content/articles";
import type { BlogContentBlock, BlogSection } from "./markdown";
import styles from "./BlogExperience.module.css";

type TransitionPhase = "idle" | "leaving" | "entering";

interface BlogExperienceProps {
  /**
   * Список статей приходит пропсом, а не импортом: материалы создаются в админ-панели и хранятся в
   * базе, доступа к которой у клиентского компонента нет.
   */
  posts: BlogPost[];
  /** Общие тексты раздела: надзаголовок, название, описание для поисковых систем. */
  pageCopy: BlogPageCopy;
  initialSlug: string | null;
  ctaLabel: string;
  ctaHref: string;
  ctaText: string;
}

function articleHref(post: BlogPost) {
  return `/blog/${post.slug}`;
}

function renderInline(markdown: string, keyPrefix: string): ReactNode[] {
  const pattern = /(\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`)/gu;
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let tokenIndex = 0;

  while ((match = pattern.exec(markdown))) {
    if (match.index > lastIndex) {
      nodes.push(markdown.slice(lastIndex, match.index));
    }

    const key = `${keyPrefix}-${tokenIndex}`;
    if (match[2] && match[3]) {
      const isExternal = /^https?:\/\//u.test(match[3]);
      nodes.push(
        isExternal ? (
          <a key={key} href={match[3]} target="_blank" rel="noopener noreferrer">
            {match[2]}
          </a>
        ) : (
          <Link key={key} href={match[3]}>
            {match[2]}
          </Link>
        ),
      );
    } else if (match[4]) {
      nodes.push(<strong key={key}>{match[4]}</strong>);
    } else if (match[5]) {
      nodes.push(<em key={key}>{match[5]}</em>);
    } else if (match[6]) {
      nodes.push(<code key={key}>{match[6]}</code>);
    }

    lastIndex = pattern.lastIndex;
    tokenIndex += 1;
  }

  if (lastIndex < markdown.length) {
    nodes.push(markdown.slice(lastIndex));
  }

  return nodes;
}

function ContentBlock({
  block,
  sectionId,
  index,
}: {
  block: BlogContentBlock;
  sectionId: string;
  index: number;
}) {
  const keyPrefix = `${sectionId}-${index}`;

  if (block.type === "paragraph") {
    return <p>{renderInline(block.markdown, keyPrefix)}</p>;
  }

  if (block.type === "code") {
    return (
      <div
        className={styles.codeScroller}
        data-code-scroller
        tabIndex={0}
        role="region"
        aria-label={
          block.language === "mermaid"
            ? "Прокручиваемая схема процесса"
            : "Прокручиваемый блок кода"
        }
      >
        <pre aria-label={block.language === "mermaid" ? "Текстовая схема процесса" : undefined}>
          <code>{block.value}</code>
        </pre>
      </div>
    );
  }

  const List = block.type === "ordered-list" ? "ol" : "ul";
  return (
    <List>
      {block.items.map((item, itemIndex) => (
        <li key={`${keyPrefix}-${itemIndex}`}>{renderInline(item, `${keyPrefix}-${itemIndex}`)}</li>
      ))}
    </List>
  );
}

function ArticleSection({ section }: { section: BlogSection }) {
  const isSources = section.heading === "Источники";
  return (
    <section
      className={isSources ? styles.sourcesSection : undefined}
      data-article-section={section.id}
    >
      <h2 id={section.id}>{section.heading}</h2>
      {section.blocks.map((block, index) => (
        <ContentBlock
          key={`${section.id}-${block.type}-${index}`}
          block={block}
          sectionId={section.id}
          index={index}
        />
      ))}
    </section>
  );
}

export function BlogExperience({
  posts,
  pageCopy,
  initialSlug,
  ctaLabel,
  ctaHref,
  ctaText,
}: BlogExperienceProps) {
  const router = useRouter();
  const prefersReducedMotion = usePrefersReducedMotion();
  const [displayedSlug, setDisplayedSlug] = useState<string | null>(initialSlug);
  const [phase, setPhase] = useState<TransitionPhase>("idle");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const articleScrollerRef = useRef<HTMLDivElement>(null);
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const post = findBlogPost(posts, displayedSlug ?? undefined);
  const adjacent = useMemo(
    () => (post ? findAdjacentBlogPosts(posts, post) : undefined),
    [posts, post],
  );
  const relatedPosts = useMemo(
    () => (post ? findRelatedBlogPosts(posts, post) : []),
    [posts, post],
  );

  useEffect(() => {
    if (initialSlug === displayedSlug) return;

    const syncTimer = window.setTimeout(() => {
      setDisplayedSlug(initialSlug);
      setPhase("entering");
      articleScrollerRef.current?.scrollTo({ top: 0 });
      transitionTimerRef.current = setTimeout(
        () => setPhase("idle"),
        prefersReducedMotion ? 40 : 320,
      );
    }, 0);

    return () => window.clearTimeout(syncTimer);
  }, [displayedSlug, initialSlug, prefersReducedMotion]);

  useEffect(
    () => () => {
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    if (!isMenuOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setIsMenuOpen(false);
      mobileMenuButtonRef.current?.focus();
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isMenuOpen]);

  const navigateToPost = (event: MouseEvent<HTMLAnchorElement>, target: BlogPost) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    if (target.slug === displayedSlug) {
      setIsMenuOpen(false);
      return;
    }

    event.preventDefault();
    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    setPhase("leaving");
    setIsMenuOpen(false);

    transitionTimerRef.current = setTimeout(
      () => {
        router.push(articleHref(target), { scroll: false });
        setDisplayedSlug(target.slug);
        setPhase("entering");
        articleScrollerRef.current?.scrollTo({ top: 0 });
        transitionTimerRef.current = setTimeout(
          () => setPhase("idle"),
          prefersReducedMotion ? 40 : 300,
        );
      },
      prefersReducedMotion ? 20 : 180,
    );
  };

  return (
    <main className={styles.scene}>
      <picture className={styles.background}>
        <source
          type="image/avif"
          srcSet="/blog/workspace-notebook-960.avif 960w, /blog/workspace-notebook-1672.avif 1672w"
          sizes="100vw"
        />
        <source
          type="image/webp"
          srcSet="/blog/workspace-notebook-960.webp 960w, /blog/workspace-notebook-1672.webp 1672w"
          sizes="100vw"
        />
        <img
          src="/blog/workspace-notebook-1672.webp"
          alt=""
          width="1672"
          height="941"
          fetchPriority="high"
          decoding="async"
        />
      </picture>
      <div className={styles.photoShade} aria-hidden="true" />

      <button
        ref={mobileMenuButtonRef}
        type="button"
        className={styles.mobileMenuButton}
        aria-expanded={isMenuOpen}
        aria-controls="blog-article-navigation"
        onClick={() => setIsMenuOpen((current) => !current)}
      >
        <span>Все статьи</span>
        <span aria-hidden="true">{isMenuOpen ? "×" : String(posts.length).padStart(2, "0")}</span>
      </button>

      {isMenuOpen ? (
        <button
          type="button"
          className={styles.mobileScrim}
          aria-label="Закрыть список статей"
          onClick={() => setIsMenuOpen(false)}
        />
      ) : null}

      <aside
        id="blog-article-navigation"
        className={`${styles.rail} ${isMenuOpen ? styles.railOpen : ""}`}
      >
        <Link className={styles.backLink} href="/">
          <span aria-hidden="true">←</span> На главную
        </Link>
        <div className={styles.railHeading}>
          <p>{pageCopy.eyebrow}</p>
          <div className={styles.railTitle}>{pageCopy.railTitle}</div>
          <span>{String(posts.length).padStart(2, "0")} материалов</span>
        </div>
        <nav className={styles.postNavigation} aria-label="Статьи блога">
          <ol>
            {posts.map((candidate) => {
              const isCurrent = candidate.slug === displayedSlug;
              return (
                <li key={candidate.id}>
                  <Link
                    href={articleHref(candidate)}
                    aria-current={isCurrent ? "page" : undefined}
                    className={isCurrent ? styles.currentPost : undefined}
                    onClick={(event) => navigateToPost(event, candidate)}
                  >
                    <span className={styles.postNumber}>
                      {String(candidate.id).padStart(2, "0")}
                    </span>
                    <span className={styles.postLinkCopy}>
                      <span className={styles.postTitle}>{candidate.title}</span>
                      <span className={styles.postMeta}>
                        {candidate.category} · {candidate.readingTime}
                      </span>
                    </span>
                    <span className={styles.postArrow} aria-hidden="true">
                      →
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </nav>
        <div className={styles.railProgress} aria-hidden="true">
          <span
            style={{ height: `${post && posts.length > 0 ? (post.id / posts.length) * 100 : 0}%` }}
          />
        </div>
      </aside>

      <div ref={articleScrollerRef} className={styles.articleScroller} data-blog-scroller>
        <article
          className={`${styles.paper} ${
            phase === "leaving"
              ? styles.paperLeaving
              : phase === "entering"
                ? styles.paperEntering
                : ""
          }`}
        >
          {post ? (
            <>
              <nav className={styles.breadcrumbs} aria-label="Хлебные крошки">
                <Link href="/">Главная</Link>
                <span aria-hidden="true">/</span>
                <Link href="/blog">Блог</Link>
                <span aria-hidden="true">/</span>
                <span aria-current="page">{post.title}</span>
              </nav>

              <header className={styles.articleHeader}>
                <div className={styles.articleEyebrow}>
                  <span>{post.category}</span>
                  <span>{post.tags.slice(0, 2).join(" · ")}</span>
                </div>
                <h1>{post.title}</h1>
                <p className={styles.excerpt}>
                  {renderInline(post.excerpt, `${post.slug}-excerpt`)}
                </p>
                <dl className={styles.meta}>
                  <div>
                    <dt>Опубликовано</dt>
                    <dd>
                      <time dateTime={post.publishedAt}>{post.publishedLabel}</time>
                      {post.modifiedAt > post.publishedAt ? (
                        <small className={styles.modifiedDate}>
                          Обновлено:{" "}
                          <time dateTime={post.modifiedAt}>{post.modifiedLabel.toLowerCase()}</time>
                        </small>
                      ) : null}
                    </dd>
                  </div>
                  <div>
                    <dt>Чтение</dt>
                    <dd>{post.readingTime}</dd>
                  </div>
                  <div>
                    <dt>Автор</dt>
                    <dd>{post.author}</dd>
                  </div>
                </dl>
              </header>

              <nav className={styles.toc} aria-label="Оглавление">
                <strong>На этой странице</strong>
                <ol>
                  {post.sections.map((section) => (
                    <li key={section.id}>
                      <a href={`#${section.id}`}>{section.heading}</a>
                    </li>
                  ))}
                </ol>
              </nav>

              <div className={styles.articleBody}>
                {post.sections.map((section) => (
                  <ArticleSection key={section.id} section={section} />
                ))}
              </div>

              <aside className={styles.relatedPosts} aria-labelledby="related-posts-heading">
                <p>Продолжить чтение</p>
                <h2 id="related-posts-heading">Связанные статьи</h2>
                <div>
                  {relatedPosts.map((related) => (
                    <Link
                      key={related.slug}
                      href={articleHref(related)}
                      onClick={(event) => navigateToPost(event, related)}
                    >
                      <span>{related.category}</span>
                      <strong>{related.title}</strong>
                      <small>{related.readingTime}</small>
                    </Link>
                  ))}
                </div>
              </aside>

              <footer className={styles.articleCta} aria-labelledby="blog-cta-heading">
                <div>
                  <p>Ваша задача</p>
                  <h2 id="blog-cta-heading">{ctaLabel}</h2>
                  <span>{ctaText}</span>
                </div>
                <a href={ctaHref} target="_blank" rel="noopener noreferrer">
                  {ctaLabel}
                </a>
              </footer>

              <nav className={styles.articlePagination} aria-label="Соседние статьи">
                {adjacent?.previous ? (
                  <Link
                    href={articleHref(adjacent.previous)}
                    onClick={(event) => navigateToPost(event, adjacent.previous!)}
                  >
                    <span>← Предыдущая</span>
                    <strong>{adjacent.previous.title}</strong>
                  </Link>
                ) : (
                  <span />
                )}
                {adjacent?.next ? (
                  <Link
                    href={articleHref(adjacent.next)}
                    onClick={(event) => navigateToPost(event, adjacent.next!)}
                  >
                    <span>Следующая →</span>
                    <strong>{adjacent.next.title}</strong>
                  </Link>
                ) : null}
              </nav>
            </>
          ) : (
            <>
              <nav className={styles.breadcrumbs} aria-label="Хлебные крошки">
                <Link href="/">Главная</Link>
                <span aria-hidden="true">/</span>
                <span aria-current="page">Блог</span>
              </nav>
              <header className={`${styles.articleHeader} ${styles.indexHeader}`}>
                <div className={styles.articleEyebrow}>
                  <span>{pageCopy.eyebrow}</span>
                  <span>{posts.length} статей</span>
                </div>
                <h1>{pageCopy.headline}</h1>
              </header>
              <div className={styles.indexList}>
                {posts.map((candidate) => (
                  <Fragment key={candidate.slug}>
                    <Link
                      href={articleHref(candidate)}
                      onClick={(event) => navigateToPost(event, candidate)}
                    >
                      <span className={styles.indexNumber}>
                        {String(candidate.id).padStart(2, "0")}
                      </span>
                      <span className={styles.indexCopy}>
                        <small>
                          {candidate.category} · {candidate.publishedLabel} ·{" "}
                          {candidate.readingTime}
                        </small>
                        <strong>{candidate.title}</strong>
                        <span>
                          {renderInline(candidate.excerpt, `${candidate.slug}-index-excerpt`)}
                        </span>
                      </span>
                      <span className={styles.indexArrow} aria-hidden="true">
                        →
                      </span>
                    </Link>
                  </Fragment>
                ))}
              </div>
            </>
          )}
        </article>
      </div>
    </main>
  );
}
