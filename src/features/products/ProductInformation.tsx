"use client";

import Link from "next/link";
import {
  type CSSProperties,
  type KeyboardEvent,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { ProductLocation, ProductsPageCopy } from "./products";
import styles from "./ProductsExperience.module.css";

/** Порядок вкладок фиксирован кодом, подписи — редактируемый текст из админ-панели. */
const TAB_IDS = ["overview", "examples", "prices", "benefit"] as const;

type TabId = (typeof TAB_IDS)[number];

function useMobileContentFlow() {
  return useSyncExternalStore(
    (onStoreChange) => {
      const query = window.matchMedia("(max-width: 767px)");
      query.addEventListener("change", onStoreChange);
      return () => query.removeEventListener("change", onStoreChange);
    },
    () => window.matchMedia("(max-width: 767px)").matches,
    () => false,
  );
}

export function ImplementationFormats({
  formats,
}: {
  formats: ProductsPageCopy["implementationFormats"];
}) {
  return (
    <aside className={styles.formats} aria-label="Форматы внедрения">
      <details>
        <summary>{formats.title}</summary>
        <div className={styles.formatsBody}>
          {formats.items.map((item) => (
            <p key={item}>{item}</p>
          ))}
          <p>{formats.note}</p>
        </div>
      </details>
    </aside>
  );
}

export function ProductInformation({
  product,
  pageCopy,
  taskCtaHref,
}: {
  product: ProductLocation;
  pageCopy: ProductsPageCopy;
  taskCtaHref: string;
}) {
  const tabs = TAB_IDS.map((id) => ({ id, label: pageCopy.tabs[id] }));
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const isMobile = useMobileContentFlow();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const instanceId = useId();

  const selectByIndex = (index: number) => {
    const normalizedIndex = (index + tabs.length) % tabs.length;
    const next = tabs[normalizedIndex];
    setActiveTab(next.id);
    tabRefs.current[normalizedIndex]?.focus();
  };

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      selectByIndex(index + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      selectByIndex(index - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      selectByIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      selectByIndex(tabs.length - 1);
    }
  };

  const panelStyle = {
    "--product-panel-width": `${product.layout.panelMaxWidth}px`,
    "--product-object-position": product.layout.objectPosition,
  } as CSSProperties;

  return (
    <div
      className={styles.productContent}
      data-product-panel
      data-panel-position={product.layout.panelPosition}
      data-panel-vertical={product.layout.panelVertical}
      data-focus-point={product.layout.focusPoint}
      data-free-area={product.layout.freeArea}
      style={panelStyle}
    >
      <article className={styles.productArticle} data-product-article>
        <nav className={styles.breadcrumbs} aria-label="Хлебные крошки">
          <Link href="/">Главная</Link>
          <span aria-hidden="true">/</span>
          <Link href="/products" prefetch={false}>
            Продукты и стоимость
          </Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{product.fullTitle}</span>
        </nav>

        <div className={styles.contentTabs} role="tablist" aria-label="Информация о продукте">
          {tabs.map((tab, index) => (
            <button
              key={tab.id}
              ref={(element) => {
                tabRefs.current[index] = element;
              }}
              id={`${instanceId}-${tab.id}-tab`}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`${instanceId}-${tab.id}-panel`}
              tabIndex={activeTab === tab.id ? 0 : -1}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
            >
              <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
              {tab.label}
            </button>
          ))}
        </div>

        <div
          id={`${instanceId}-overview-panel`}
          role={isMobile ? undefined : "tabpanel"}
          aria-labelledby={isMobile ? undefined : `${instanceId}-overview-tab`}
          data-active={isMobile || activeTab === "overview"}
          className={styles.tabPanel}
        >
          <header className={styles.productHeader}>
            <p className={styles.productEyebrow}>
              Продукт {String(product.order).padStart(2, "0")}
            </p>
            <h1>{product.fullTitle}</h1>
            <p>{product.content.summary}</p>
            <div className={styles.overviewPrice} data-overview-price>
              <span>{product.content.prices[0].label}</span>
              <strong>{product.content.prices[0].value}</strong>
            </div>
            <button
              type="button"
              className={styles.priceShortcut}
              data-price-shortcut
              onClick={() => {
                if (isMobile) {
                  document
                    .getElementById(`${instanceId}-prices-panel`)
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  return;
                }
                setActiveTab("prices");
              }}
            >
              Все варианты стоимости <span aria-hidden="true">→</span>
            </button>
          </header>
          {/*
            Заголовок панели «Обзор» стоит ПОСЛЕ <header> с <h1>, а не перед ним.
            Он показывается только без JavaScript (`html.js .fallbackPanelTitle { display: none }`),
            когда вкладки скрыты и все панели идут стопкой: там ему нужна собственная подпись, как
            у остальных панелей. Но пока он стоял первым, документ начинался с <h2> и лишь потом
            доходил до <h1> продукта — порядок заголовков был нарушен на всех десяти карточках
            (зафиксировано снимком production 2026-07-29). С JavaScript элемент невидим, поэтому
            перенос ничего не меняет визуально.
          */}
          <h2 className={styles.fallbackPanelTitle}>{pageCopy.tabs.overview}</h2>
          <section>
            <h2>{pageCopy.sectionHeadings.applies}</h2>
            <p>{product.content.applies}</p>
          </section>
        </div>

        <section
          id={`${instanceId}-examples-panel`}
          role={isMobile ? undefined : "tabpanel"}
          aria-labelledby={isMobile ? undefined : `${instanceId}-examples-tab`}
          data-active={isMobile || activeTab === "examples"}
          className={styles.tabPanel}
        >
          <h2>{pageCopy.sectionHeadings.examples}</h2>
          <ol className={styles.examples}>
            {product.content.examples.map((example, index) => (
              <li key={example}>
                <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                <p>{example}</p>
              </li>
            ))}
          </ol>
        </section>

        <section
          id={`${instanceId}-prices-panel`}
          role={isMobile ? undefined : "tabpanel"}
          aria-labelledby={isMobile ? undefined : `${instanceId}-prices-tab`}
          data-active={isMobile || activeTab === "prices"}
          className={styles.tabPanel}
        >
          <h2>{pageCopy.sectionHeadings.prices}</h2>
          <dl className={styles.prices}>
            {product.content.prices.map((price) => (
              <div key={price.label}>
                <dt>{price.label}</dt>
                <dd>{price.value}</dd>
              </div>
            ))}
          </dl>
          {product.content.priceNote ? (
            <p className={styles.priceNote}>{product.content.priceNote}</p>
          ) : null}
          <ImplementationFormats formats={pageCopy.implementationFormats} />
        </section>

        <section
          id={`${instanceId}-benefit-panel`}
          role={isMobile ? undefined : "tabpanel"}
          aria-labelledby={isMobile ? undefined : `${instanceId}-benefit-tab`}
          data-active={isMobile || activeTab === "benefit"}
          className={styles.tabPanel}
        >
          <h2>{pageCopy.sectionHeadings.benefit}</h2>
          <p className={styles.benefit}>{product.content.benefit}</p>
          <a
            className={styles.contentAction}
            href={taskCtaHref}
            target="_blank"
            rel="noopener noreferrer"
          >
            Ваша задача
          </a>
        </section>
      </article>
    </div>
  );
}
