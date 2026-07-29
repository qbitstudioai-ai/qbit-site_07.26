"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type CSSProperties,
  type MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import {
  automationLabImage,
  findAdjacentProducts,
  findProductById,
  type ProductId,
  type ProductImage,
  type ProductLocation,
  type ProductsPageCopy,
} from "./products";
import { ProductInformation } from "./ProductInformation";
import styles from "./ProductsExperience.module.css";

type SceneId = "overview" | ProductId;
type TransitionKind = "entry" | "switch" | "return";
const PRODUCT_FOCUS_REQUEST_KEY = "qbit-products-focus-request";

interface ProductsExperienceProps {
  /**
   * Каталог приходит пропсом, а не импортом модуля: продукты редактируются в админ-панели и живут
   * в базе, к которой у клиентского компонента доступа нет и быть не должно.
   */
  products: readonly ProductLocation[];
  /** Общие тексты страницы: заголовок, подписи вкладок, форматы внедрения. */
  pageCopy: ProductsPageCopy;
  initialProductId: ProductId | null;
  taskCtaLabel: string;
  taskCtaHref: string;
}

interface ProductPictureProps {
  image: ProductImage;
  alt: string;
  sizes: string;
  priority?: boolean;
  onReady?: () => void;
}

const sceneHref = (list: readonly ProductLocation[], sceneId: SceneId) =>
  sceneId === "overview"
    ? "/products"
    : `/products/${findProductById(list, sceneId)?.slug ?? sceneId}`;

const sceneProduct = (list: readonly ProductLocation[], sceneId: SceneId) =>
  sceneId === "overview" ? undefined : list.find((product) => product.id === sceneId);

function ProductPicture({ image, alt, sizes, priority = false, onReady }: ProductPictureProps) {
  const didSignalRef = useRef(false);

  const signalReady = useCallback(
    (element: HTMLImageElement) => {
      if (didSignalRef.current) return;
      const done = () => {
        if (didSignalRef.current) return;
        didSignalRef.current = true;
        onReady?.();
      };

      if (typeof element.decode === "function") {
        element.decode().then(done, done);
      } else {
        done();
      }
    },
    [onReady],
  );

  return (
    <picture>
      <source type="image/avif" srcSet={image.avifSrcSet} sizes={sizes} />
      <source type="image/webp" srcSet={image.webpSrcSet} sizes={sizes} />
      <img
        src={image.fallbackSrc}
        alt={alt}
        width={image.width}
        height={image.height}
        decoding="async"
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        onLoad={(event) => signalReady(event.currentTarget)}
        onError={(event) => signalReady(event.currentTarget)}
      />
    </picture>
  );
}

function preloadProduct(product: ProductLocation) {
  const image = new Image();
  image.decoding = "async";
  image.fetchPriority = "low";
  image.sizes = "(max-width: 767px) 100vw, 84vw";
  image.srcset = product.images.detail.webpSrcSet;
  image.src = product.images.detail.fallbackSrc;
}

function ProductScenePhoto({
  product,
  priority = false,
  onReady,
}: {
  product: ProductLocation;
  priority?: boolean;
  onReady?: () => void;
}) {
  return (
    <>
      <div className={styles.photoBackdrop} aria-hidden="true">
        <ProductPicture
          image={product.images.detail}
          alt=""
          sizes="(max-width: 767px) 100vw, 84vw"
        />
      </div>
      <div className={styles.photoSubject}>
        <ProductPicture
          image={product.images.detail}
          alt={product.images.alt}
          sizes="(max-width: 767px) 100vw, 84vw"
          priority={priority}
          onReady={onReady}
        />
      </div>
    </>
  );
}

export function ProductsExperience({
  products,
  pageCopy,
  initialProductId,
  taskCtaLabel,
  taskCtaHref,
}: ProductsExperienceProps) {
  const router = useRouter();
  const prefersReducedMotion = usePrefersReducedMotion();
  const initialScene: SceneId = initialProductId ?? "overview";
  const [currentScene, setCurrentScene] = useState<SceneId>(initialScene);
  const [incomingScene, setIncomingScene] = useState<SceneId | null>(null);
  const [transitionKind, setTransitionKind] = useState<TransitionKind | null>(null);
  const [incomingReady, setIncomingReady] = useState(false);
  const [minimumElapsed, setMinimumElapsed] = useState(false);
  const [revealIncoming, setRevealIncoming] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductLocation | null>(
    initialProductId ? (sceneProduct(products, initialProductId) ?? null) : null,
  );
  const [mobilePreviewProduct, setMobilePreviewProduct] = useState<ProductLocation>(products[0]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const minimumTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const commitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mobileProductsButtonRef = useRef<HTMLButtonElement>(null);
  const focusOnCommitRef = useRef(false);
  const returnFocusProductRef = useRef<ProductId | null>(null);

  const beginTransition = useCallback(
    (
      targetScene: SceneId,
      kind: TransitionKind,
      product: ProductLocation | null,
      updateUrl: boolean,
    ) => {
      if (targetScene === currentScene || targetScene === incomingScene) return;

      if (minimumTimerRef.current) clearTimeout(minimumTimerRef.current);
      if (commitTimerRef.current) clearTimeout(commitTimerRef.current);

      setIncomingScene(targetScene);
      setTransitionKind(kind);
      setSelectedProduct(product);
      setIncomingReady(false);
      setMinimumElapsed(prefersReducedMotion);
      setRevealIncoming(false);
      setIsMobileMenuOpen(false);

      if (!prefersReducedMotion) {
        minimumTimerRef.current = setTimeout(
          () => setMinimumElapsed(true),
          kind === "entry" ? 520 : 190,
        );
      }

      if (updateUrl) {
        router.push(sceneHref(products, targetScene), { scroll: false });
      }
    },
    [currentScene, incomingScene, prefersReducedMotion, products, router],
  );

  useEffect(() => {
    if (!incomingScene || !incomingReady || !minimumElapsed || revealIncoming) return;

    const revealTimer = setTimeout(() => setRevealIncoming(true), 0);
    commitTimerRef.current = setTimeout(
      () => {
        setCurrentScene(incomingScene);
        setIncomingScene(null);
        setTransitionKind(null);
        setRevealIncoming(false);
        setIncomingReady(false);
        setMinimumElapsed(false);
      },
      prefersReducedMotion ? 0 : 330,
    );

    return () => clearTimeout(revealTimer);
  }, [incomingReady, incomingScene, minimumElapsed, prefersReducedMotion, revealIncoming]);

  useEffect(
    () => () => {
      if (minimumTimerRef.current) clearTimeout(minimumTimerRef.current);
      if (commitTimerRef.current) clearTimeout(commitTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    if (!isMobileMenuOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setIsMobileMenuOpen(false);
      mobileProductsButtonRef.current?.focus();
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isMobileMenuOpen]);

  useEffect(() => {
    const storedFocusRequest = window.sessionStorage.getItem(PRODUCT_FOCUS_REQUEST_KEY);
    const focusRequestMatchesScene =
      currentScene === "overview"
        ? storedFocusRequest?.startsWith("hotspot:")
        : storedFocusRequest === `product:${currentScene}`;

    if (storedFocusRequest && !focusRequestMatchesScene) return;
    if (!focusOnCommitRef.current && !focusRequestMatchesScene) return;
    focusOnCommitRef.current = false;

    const frame = requestAnimationFrame(() => {
      if (currentScene === "overview") {
        const productId =
          returnFocusProductRef.current ??
          (storedFocusRequest?.startsWith("hotspot:")
            ? (storedFocusRequest.slice("hotspot:".length) as ProductId)
            : "product-01");
        document.querySelector<HTMLElement>(`[data-product-hotspot="${productId}"]`)?.focus();
        returnFocusProductRef.current = null;
        window.sessionStorage.removeItem(PRODUCT_FOCUS_REQUEST_KEY);
        return;
      }

      if (window.matchMedia("(max-width: 767px)").matches) {
        mobileProductsButtonRef.current?.focus();
        window.sessionStorage.removeItem(PRODUCT_FOCUS_REQUEST_KEY);
        return;
      }

      document.querySelector<HTMLElement>(`[data-product-link="${currentScene}"]`)?.focus();
      window.sessionStorage.removeItem(PRODUCT_FOCUS_REQUEST_KEY);
    });

    return () => cancelAnimationFrame(frame);
  }, [currentScene]);

  // App Router обновляет initialProductId и при Back/Forward. Если это не наша уже идущая
  // навигация, запускаем тот же визуальный переход, но не создаём новую запись history.
  useEffect(() => {
    const requestedScene: SceneId = initialProductId ?? "overview";
    if (requestedScene === currentScene || requestedScene === incomingScene) return;

    const requestedProduct = sceneProduct(products, requestedScene) ?? null;
    const kind: TransitionKind =
      requestedScene === "overview" ? "return" : currentScene === "overview" ? "entry" : "switch";
    const timer = setTimeout(
      () => beginTransition(requestedScene, kind, requestedProduct, false),
      0,
    );
    return () => clearTimeout(timer);
  }, [beginTransition, currentScene, incomingScene, initialProductId, products]);

  useEffect(() => {
    const product = sceneProduct(products, currentScene);
    if (!product) return;

    const preloadAdjacent = () => {
      for (const adjacentProduct of findAdjacentProducts(products, product.id)) {
        preloadProduct(adjacentProduct);
      }
    };

    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(preloadAdjacent, { timeout: 900 });
      return () => window.cancelIdleCallback(id);
    }

    const id = setTimeout(preloadAdjacent, 100);
    return () => clearTimeout(id);
  }, [currentScene, products]);

  const activeProduct = sceneProduct(products, currentScene);
  const incomingProduct = incomingScene ? sceneProduct(products, incomingScene) : undefined;
  const isOverview = currentScene === "overview";
  const isTransitioning = incomingScene !== null;

  const zoomStyle = useMemo(() => {
    if (!selectedProduct) return undefined;
    const { x, y, width, height } = selectedProduct.hotspot;
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const scale = Math.min(3.1, Math.max(1.85, 57 / Math.max(width, height)));

    return {
      "--zoom-x": `${centerX}%`,
      "--zoom-y": `${centerY}%`,
      "--zoom-scale": scale,
    } as CSSProperties;
  }, [selectedProduct]);

  const navigateToProduct = (event: MouseEvent<HTMLAnchorElement>, product: ProductLocation) => {
    event.preventDefault();
    focusOnCommitRef.current = event.detail === 0;
    if (event.detail === 0) {
      window.sessionStorage.setItem(PRODUCT_FOCUS_REQUEST_KEY, `product:${product.id}`);
    }
    preloadProduct(product);
    beginTransition(product.id, isOverview ? "entry" : "switch", product, true);
  };

  const handleHotspotClick = (event: MouseEvent<HTMLAnchorElement>, product: ProductLocation) => {
    if (event.detail > 0 && window.matchMedia("(max-width: 767px)").matches) {
      event.preventDefault();
      preloadProduct(product);
      setMobilePreviewProduct(product);
      return;
    }

    navigateToProduct(event, product);
  };

  const handleMobileProductSelect = (
    event: MouseEvent<HTMLAnchorElement>,
    product: ProductLocation,
  ) => {
    event.preventDefault();
    preloadProduct(product);
    setMobilePreviewProduct(product);
  };

  const navigateToOverview = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    focusOnCommitRef.current = event.detail === 0;
    returnFocusProductRef.current = activeProduct?.id ?? null;
    if (event.detail === 0 && activeProduct) {
      window.sessionStorage.setItem(PRODUCT_FOCUS_REQUEST_KEY, `hotspot:${activeProduct.id}`);
    }
    beginTransition("overview", "return", null, true);
  };

  return (
    <main
      className={styles.experience}
      data-products-view={isOverview ? "overview" : "product"}
      data-transition={transitionKind ?? "idle"}
      aria-label="Лаборатория автоматизации"
    >
      {isOverview ? (
        <div className={styles.overviewControls} data-products-controls>
          <Link href="/" className={styles.backHome}>
            <span aria-hidden="true">←</span>
            На главную
          </Link>
          <div className={styles.productsIntro}>
            <p className={styles.productsIntroEyebrow}>{pageCopy.eyebrow}</p>
            <h1>{pageCopy.headline}</h1>
            <p className={styles.productsIntroDescription}>
              10 решений QBit-Studio-Ai для автоматизации продаж, клиентской поддержки, HR, работы с
              документами и внутренних бизнес-процессов.
            </p>
          </div>
          <a
            className={styles.primaryAction}
            href={taskCtaHref}
            target="_blank"
            rel="noopener noreferrer"
          >
            {taskCtaLabel}
          </a>
        </div>
      ) : (
        <div className={styles.mobileToolbar}>
          <button
            ref={mobileProductsButtonRef}
            type="button"
            className={styles.mobileProductsButton}
            aria-expanded={isMobileMenuOpen}
            aria-controls="products-navigation"
            onClick={() => setIsMobileMenuOpen((open) => !open)}
          >
            <span aria-hidden="true">☰</span>
            Продукты
          </button>
          <p aria-live="polite">{activeProduct?.menuTitle}</p>
        </div>
      )}

      <div className={styles.location}>
        {!isOverview ? (
          <>
            <button
              type="button"
              className={`${styles.mobileMenuBackdrop} ${
                isMobileMenuOpen ? styles.mobileMenuBackdropVisible : ""
              }`}
              aria-label="Закрыть список продуктов"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <aside
              id="products-navigation"
              className={`${styles.sidebar} ${isMobileMenuOpen ? styles.sidebarOpen : ""}`}
              aria-label="Навигация по продуктам"
            >
              <Link
                className={styles.backToLab}
                href="/products"
                prefetch={false}
                onClick={navigateToOverview}
              >
                <span aria-hidden="true">←</span>
                Назад в лабораторию
              </Link>
              <nav className={styles.productNav} aria-label="Все продукты">
                {products.map((product) => (
                  <Link
                    key={product.id}
                    href={`/products/${product.slug}`}
                    data-product-link={product.id}
                    className={product.id === activeProduct?.id ? styles.activeProduct : undefined}
                    aria-current={product.id === activeProduct?.id ? "page" : undefined}
                    onMouseEnter={() => preloadProduct(product)}
                    onFocus={() => preloadProduct(product)}
                    onClick={(event) => navigateToProduct(event, product)}
                  >
                    <span aria-hidden="true">{String(product.order).padStart(2, "0")}</span>
                    {product.menuTitle}
                  </Link>
                ))}
              </nav>
              <a
                className={styles.sidebarAction}
                href={taskCtaHref}
                target="_blank"
                rel="noopener noreferrer"
              >
                Ваша задача
              </a>
            </aside>
          </>
        ) : null}

        <div className={styles.sceneViewport}>
          {currentScene === "overview" ? (
            <div className={styles.overviewBackdrop} aria-hidden="true">
              <ProductPicture
                image={automationLabImage}
                alt=""
                sizes="(max-width: 767px) 100vw, 96vw"
                priority
              />
            </div>
          ) : null}
          <div
            className={`${styles.overviewFrame} ${
              isOverview && transitionKind === "entry" ? styles.overviewFrameZooming : ""
            }`}
            data-lab-frame
            style={zoomStyle}
            aria-hidden={!isOverview}
          >
            {currentScene === "overview" ? (
              <div className={`${styles.sceneLayer} ${styles.overviewLayer}`}>
                <ProductPicture
                  image={automationLabImage}
                  alt="Лаборатория автоматизации: рабочие места, чертежи, архивы и проектная доска"
                  sizes="(max-width: 767px) 100vw, 96vw"
                  priority
                />
              </div>
            ) : null}

            {isOverview ? (
              <nav
                className={`${styles.hotspots} ${isTransitioning ? styles.hotspotsLeaving : ""}`}
                aria-label="Продукты на фотографии лаборатории"
              >
                {products.map((product) => (
                  <Link
                    key={product.id}
                    href={`/products/${product.slug}`}
                    data-product-hotspot={product.id}
                    data-mobile-active={mobilePreviewProduct.id === product.id ? "true" : "false"}
                    className={styles.hotspot}
                    style={
                      {
                        left: `${product.hotspot.x}%`,
                        top: `${product.hotspot.y}%`,
                        width: `${product.hotspot.width}%`,
                        height: `${product.hotspot.height}%`,
                        "--marker-x": `${product.hotspot.marker.x}%`,
                        "--marker-y": `${product.hotspot.marker.y}%`,
                        "--marker-shift-x":
                          product.hotspot.marker.align === "start"
                            ? "0%"
                            : product.hotspot.marker.align === "end"
                              ? "-100%"
                              : "-50%",
                      } as CSSProperties
                    }
                    aria-label={`Открыть ${product.fullTitle}, ${product.content.prices[0].label.toLowerCase()} ${product.content.prices[0].value}`}
                    onMouseEnter={() => preloadProduct(product)}
                    onFocus={() => preloadProduct(product)}
                    onClick={(event) => handleHotspotClick(event, product)}
                  >
                    <span
                      className={`${styles.corner} ${styles.cornerTopLeft}`}
                      aria-hidden="true"
                    />
                    <span
                      className={`${styles.corner} ${styles.cornerTopRight}`}
                      aria-hidden="true"
                    />
                    <span
                      className={`${styles.corner} ${styles.cornerBottomLeft}`}
                      aria-hidden="true"
                    />
                    <span
                      className={`${styles.corner} ${styles.cornerBottomRight}`}
                      aria-hidden="true"
                    />
                    <span className={styles.markerPosition} aria-hidden="true">
                      <span className={styles.marker} data-hotspot-label>
                        <span className={styles.markerTitle}>
                          <span>{product.menuTitle}</span>
                          <span className={styles.markerChevron}>›</span>
                        </span>
                        <span className={styles.markerDetails} data-hotspot-price>
                          <span>
                            Стоимость <b>{product.content.prices[0].value}</b>
                          </span>
                          <span>{pageCopy.moreLabel}</span>
                        </span>
                      </span>
                    </span>
                  </Link>
                ))}
              </nav>
            ) : null}
          </div>

          {isOverview ? (
            <aside
              className={styles.mobilePricePreview}
              data-mobile-price-preview
              aria-label={`Стоимость ${mobilePreviewProduct.fullTitle}`}
              aria-live="polite"
            >
              <strong>{mobilePreviewProduct.fullTitle}</strong>
              <span className={styles.mobilePreviewPrices}>
                <span data-mobile-preview-price>
                  <span>{pageCopy.priceColumnLabel}</span>
                  <b>{mobilePreviewProduct.content.prices[0].value}</b>
                </span>
              </span>
              <Link
                href={`/products/${mobilePreviewProduct.slug}`}
                onClick={(event) => navigateToProduct(event, mobilePreviewProduct)}
              >
                Подробнее →
              </Link>
            </aside>
          ) : null}

          {activeProduct ? (
            <div
              key={activeProduct.id}
              className={`${styles.sceneLayer} ${styles.productLayer} ${
                transitionKind === "switch" || transitionKind === "return"
                  ? styles.productLayerLeaving
                  : ""
              }`}
              style={
                {
                  "--product-object-position": activeProduct.layout.objectPosition,
                } as CSSProperties
              }
            >
              <ProductScenePhoto product={activeProduct} priority />
            </div>
          ) : null}

          {incomingScene ? (
            <div
              key={`incoming-${incomingScene}`}
              className={`${styles.sceneLayer} ${
                incomingScene === "overview" ? styles.overviewIncoming : styles.productLayer
              } ${styles.incomingLayer} ${revealIncoming ? styles.incomingLayerVisible : ""}`}
              style={
                incomingProduct
                  ? ({
                      "--product-object-position": incomingProduct.layout.objectPosition,
                    } as CSSProperties)
                  : undefined
              }
            >
              {incomingProduct ? (
                <ProductScenePhoto
                  product={incomingProduct}
                  priority
                  onReady={() => setIncomingReady(true)}
                />
              ) : (
                <ProductPicture
                  image={automationLabImage}
                  alt="Лаборатория автоматизации: рабочие места, чертежи, архивы и проектная доска"
                  sizes="96vw"
                  priority
                  onReady={() => setIncomingReady(true)}
                />
              )}
            </div>
          ) : null}

          {activeProduct ? (
            <div className={styles.locationIndex} aria-hidden="true">
              <span>{String(activeProduct.order).padStart(2, "0")}</span>
              <i />
              <span>10</span>
            </div>
          ) : null}
        </div>

        {activeProduct && !isTransitioning ? (
          <ProductInformation
            key={activeProduct.id}
            product={activeProduct}
            pageCopy={pageCopy}
            taskCtaHref={taskCtaHref}
          />
        ) : null}
      </div>

      {isOverview ? (
        <nav className={styles.mobileProductDock} aria-label="Список продуктов">
          {products.map((product) => (
            <Link
              key={product.id}
              href={`/products/${product.slug}`}
              aria-current={mobilePreviewProduct.id === product.id ? "true" : undefined}
              onClick={(event) => handleMobileProductSelect(event, product)}
            >
              <span>{String(product.order).padStart(2, "0")}</span>
              {product.menuTitle}
            </Link>
          ))}
        </nav>
      ) : null}
    </main>
  );
}
