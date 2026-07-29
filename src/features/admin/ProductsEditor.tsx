"use client";

import { useCallback, useMemo, useState } from "react";
import type { ProductLocation, ProductPrice, ProductsPageCopy } from "@/features/products/products";
import styles from "./admin.module.css";
import { CheckboxField, Field, ListEditor, SaveBar, TextAreaField, TextField } from "./formKit";
import { readApiError, useEditableForm } from "./useEditableForm";

/**
 * Раздел «Продукты и стоимость».
 *
 * Три подраздела, как и в требованиях: общие тексты страницы, список продуктов и форма одного
 * продукта. Кнопки «удалить продукт» нет намеренно — все десять связаны с фотографиями
 * лаборатории и зонами на них; чтобы убрать продукт с сайта, есть переключатель «Показывать на
 * сайте».
 */

export interface ProductRecord extends ProductLocation {
  isPublished: boolean;
  updatedAt: string;
}

type Tab = "page" | "products";

export function ProductsEditor({
  products,
  pageCopy,
}: {
  products: ProductRecord[];
  pageCopy: ProductsPageCopy;
}) {
  const [tab, setTab] = useState<Tab>("products");
  const [records, setRecords] = useState(products);
  const [activeId, setActiveId] = useState(products[0]?.id);
  const [reorderState, setReorderState] = useState<"idle" | "saving" | "error">("idle");

  const active = records.find((product) => product.id === activeId) ?? records[0];

  const moveProduct = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= records.length) return;

    const next = [...records];
    [next[index], next[target]] = [next[target], next[index]];
    setRecords(next);
    setReorderState("saving");

    const response = await fetch("/api/admin/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: next.map((product) => product.id) }),
    });

    if (!response.ok) {
      // Порядок откатывается: показывать список, которого нет на сайте, хуже, чем показать ошибку.
      setRecords(records);
      setReorderState("error");
      return;
    }

    setReorderState("idle");
  };

  return (
    <>
      <div className={styles.actions} style={{ marginBottom: 16 }}>
        <button
          type="button"
          className={tab === "products" ? styles.buttonPrimary : styles.button}
          onClick={() => setTab("products")}
        >
          Продукты ({records.length})
        </button>
        <button
          type="button"
          className={tab === "page" ? styles.buttonPrimary : styles.button}
          onClick={() => setTab("page")}
        >
          Общие тексты страницы
        </button>
      </div>

      {tab === "page" ? <PageCopyForm pageCopy={pageCopy} /> : null}

      {tab === "products" ? (
        <div className={styles.splitLayout}>
          <nav className={styles.panel} aria-label="Список продуктов">
            <h2 className={styles.panelTitle}>Продукты</h2>
            <p className={styles.panelNote}>
              Порядок стрелками сохраняется сразу и меняет очерёдность на сайте.
            </p>
            {reorderState === "error" ? (
              <p className={styles.messageError} role="alert">
                Не удалось сохранить порядок
              </p>
            ) : null}

            <div className={styles.recordList}>
              {records.map((product, index) => (
                <div key={product.id} className={styles.listItem}>
                  <button
                    type="button"
                    className={`${styles.recordLink} ${
                      product.id === active?.id ? styles.recordLinkActive : ""
                    }`}
                    onClick={() => setActiveId(product.id)}
                  >
                    {product.menuTitle}
                    <span className={styles.recordMeta}>
                      {product.slug}
                      {product.isPublished ? "" : " · скрыт"}
                    </span>
                  </button>
                  <div className={styles.listItemControls}>
                    <button
                      type="button"
                      className={`${styles.button} ${styles.buttonSmall}`}
                      onClick={() => void moveProduct(index, -1)}
                      disabled={index === 0 || reorderState === "saving"}
                      aria-label={`Переместить «${product.menuTitle}» вверх`}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className={`${styles.button} ${styles.buttonSmall}`}
                      onClick={() => void moveProduct(index, 1)}
                      disabled={index === records.length - 1 || reorderState === "saving"}
                      aria-label={`Переместить «${product.menuTitle}» вниз`}
                    >
                      ↓
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </nav>

          {active ? (
            <ProductForm
              key={active.id}
              product={active}
              onSaved={(saved) =>
                setRecords((current) =>
                  current.map((item) => (item.id === saved.id ? { ...item, ...saved } : item)),
                )
              }
            />
          ) : (
            <p className={styles.messageEmpty}>Данные ещё не добавлены</p>
          )}
        </div>
      ) : null}
    </>
  );
}

/** Общие тексты страницы «Продукт и стоимость». */
function PageCopyForm({ pageCopy }: { pageCopy: ProductsPageCopy }) {
  const save = useCallback(async (value: ProductsPageCopy) => {
    const response = await fetch("/api/admin/pages/products", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: value }),
    });
    if (!response.ok) throw await readApiError(response);
    return value;
  }, []);

  const form = useEditableForm(pageCopy, save);
  const { value, setValue } = form;

  const update = <K extends keyof ProductsPageCopy>(key: K, next: ProductsPageCopy[K]) =>
    setValue((current) => ({ ...current, [key]: next }));

  return (
    <div>
      <SaveBar form={form} publicHref="/products" />

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Заголовок страницы</h2>
        <div className={styles.fieldRow}>
          <TextField
            label="Надзаголовок"
            required
            value={value.eyebrow}
            onChange={(next) => update("eyebrow", next)}
          />
          <TextField
            label="Заголовок"
            required
            value={value.headline}
            onChange={(next) => update("headline", next)}
          />
        </div>
        <div className={styles.fieldRow}>
          <TextField
            label="Подпись кнопки «Подробнее»"
            value={value.moreLabel}
            onChange={(next) => update("moreLabel", next)}
          />
          <TextField
            label="Подпись колонки со стоимостью"
            value={value.priceColumnLabel}
            onChange={(next) => update("priceColumnLabel", next)}
          />
        </div>
      </section>

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Подписи вкладок и разделов</h2>
        <p className={styles.panelNote}>
          Порядок вкладок задан раскладкой карточки продукта, меняются только подписи.
        </p>

        <div className={styles.fieldRow}>
          <TextField
            label="Вкладка «Обзор»"
            value={value.tabs.overview}
            onChange={(next) => update("tabs", { ...value.tabs, overview: next })}
          />
          <TextField
            label="Вкладка «Примеры»"
            value={value.tabs.examples}
            onChange={(next) => update("tabs", { ...value.tabs, examples: next })}
          />
          <TextField
            label="Вкладка «Стоимость»"
            value={value.tabs.prices}
            onChange={(next) => update("tabs", { ...value.tabs, prices: next })}
          />
          <TextField
            label="Вкладка «Выгода»"
            value={value.tabs.benefit}
            onChange={(next) => update("tabs", { ...value.tabs, benefit: next })}
          />
        </div>

        <div className={styles.fieldRow}>
          <TextField
            label="Заголовок «Где применяется»"
            value={value.sectionHeadings.applies}
            onChange={(next) =>
              update("sectionHeadings", { ...value.sectionHeadings, applies: next })
            }
          />
          <TextField
            label="Заголовок «Примеры применения»"
            value={value.sectionHeadings.examples}
            onChange={(next) =>
              update("sectionHeadings", { ...value.sectionHeadings, examples: next })
            }
          />
          <TextField
            label="Заголовок «Стоимость»"
            value={value.sectionHeadings.prices}
            onChange={(next) =>
              update("sectionHeadings", { ...value.sectionHeadings, prices: next })
            }
          />
          <TextField
            label="Заголовок «Выгода»"
            value={value.sectionHeadings.benefit}
            onChange={(next) =>
              update("sectionHeadings", { ...value.sectionHeadings, benefit: next })
            }
          />
        </div>
      </section>

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Форматы внедрения</h2>
        <p className={styles.panelNote}>Блок «P.S.» под таблицей стоимости.</p>

        <TextField
          label="Заголовок блока"
          value={value.implementationFormats.title}
          onChange={(next) =>
            update("implementationFormats", { ...value.implementationFormats, title: next })
          }
        />

        <ListEditor<string>
          label="Форматы"
          items={value.implementationFormats.items}
          createItem={() => ""}
          addLabel="Добавить формат"
          onChange={(items) =>
            update("implementationFormats", { ...value.implementationFormats, items })
          }
          renderItem={(item, replace) => (
            <Field label="Описание формата">
              {(props) => (
                <textarea
                  {...props}
                  className={styles.textarea}
                  rows={2}
                  value={item}
                  onChange={(event) => replace(event.target.value)}
                />
              )}
            </Field>
          )}
        />

        <TextAreaField
          label="Примечание"
          rows={3}
          value={value.implementationFormats.note}
          onChange={(next) =>
            update("implementationFormats", { ...value.implementationFormats, note: next })
          }
        />
      </section>

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Для поисковых систем</h2>
        <TextField
          label="SEO title страницы"
          value={value.seoTitle}
          onChange={(next) => update("seoTitle", next)}
        />
        <TextAreaField
          label="SEO description страницы"
          rows={3}
          value={value.seoDescription}
          onChange={(next) => update("seoDescription", next)}
        />
      </section>

      <SaveBar form={form} publicHref="/products" />
    </div>
  );
}

interface ProductFormValue {
  id: string;
  slug: string;
  menuTitle: string;
  fullTitle: string;
  imageAlt: string;
  summary: string;
  applies: string;
  examples: string[];
  prices: ProductPrice[];
  priceNote: string;
  benefit: string;
  sortOrder: number;
  isPublished: boolean;
}

function toFormValue(product: ProductRecord): ProductFormValue {
  return {
    id: product.id,
    slug: product.slug,
    menuTitle: product.menuTitle,
    fullTitle: product.fullTitle,
    imageAlt: product.images.alt,
    summary: product.content.summary,
    applies: product.content.applies,
    examples: [...product.content.examples],
    prices: product.content.prices.map((price) => ({ ...price })),
    priceNote: product.content.priceNote ?? "",
    benefit: product.content.benefit,
    sortOrder: product.order,
    isPublished: product.isPublished,
  };
}

function ProductForm({
  product,
  onSaved,
}: {
  product: ProductRecord;
  onSaved: (product: ProductRecord) => void;
}) {
  const initial = useMemo(() => toFormValue(product), [product]);

  const save = useCallback(
    async (value: ProductFormValue) => {
      const response = await fetch(`/api/admin/products/${value.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: value.slug,
          menuTitle: value.menuTitle,
          fullTitle: value.fullTitle,
          imageAlt: value.imageAlt,
          content: {
            summary: value.summary,
            applies: value.applies,
            examples: value.examples,
            prices: value.prices,
            priceNote: value.priceNote || undefined,
            benefit: value.benefit,
          },
          sortOrder: value.sortOrder,
          isPublished: value.isPublished,
        }),
      });

      if (!response.ok) throw await readApiError(response);

      const payload = (await response.json()) as { product: ProductRecord };
      onSaved(payload.product);
      return toFormValue(payload.product);
    },
    [onSaved],
  );

  const form = useEditableForm(initial, save);
  const { value, setValue, fieldErrors } = form;

  const update = <K extends keyof ProductFormValue>(key: K, next: ProductFormValue[K]) =>
    setValue((current) => ({ ...current, [key]: next }));

  return (
    <div>
      <SaveBar form={form} publicHref={`/products/${product.slug}`} />

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Название и адрес</h2>
        <p className={styles.panelNote}>
          Системный идентификатор — <code>{value.id}</code>. К нему привязана фотография продукта,
          поэтому он не меняется.
        </p>

        <div className={styles.fieldRow}>
          <TextField
            label="Короткое название (меню)"
            required
            value={value.menuTitle}
            error={fieldErrors.menuTitle}
            onChange={(next) => update("menuTitle", next)}
          />
          <TextField
            label="Адрес страницы (slug)"
            required
            hint="Строчные латинские буквы, цифры и дефис. Меняет публичную ссылку продукта."
            value={value.slug}
            error={fieldErrors.slug}
            onChange={(next) => update("slug", next)}
          />
        </div>

        <TextField
          label="Полное название"
          required
          value={value.fullTitle}
          error={fieldErrors.fullTitle}
          onChange={(next) => update("fullTitle", next)}
        />

        <TextField
          label="Описание фотографии"
          required
          hint="Альтернативный текст изображения — его читают скринридеры и поисковые системы."
          value={value.imageAlt}
          error={fieldErrors.imageAlt}
          onChange={(next) => update("imageAlt", next)}
        />
      </section>

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Описание</h2>
        <TextAreaField
          label="Что это за продукт"
          required
          rows={4}
          value={value.summary}
          error={fieldErrors["content.summary"]}
          onChange={(next) => update("summary", next)}
        />
        <TextAreaField
          label="Где применяется"
          required
          rows={2}
          value={value.applies}
          error={fieldErrors["content.applies"]}
          onChange={(next) => update("applies", next)}
        />
        <TextAreaField
          label="Выгода для клиента"
          required
          rows={3}
          value={value.benefit}
          error={fieldErrors["content.benefit"]}
          onChange={(next) => update("benefit", next)}
        />
      </section>

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Примеры применения</h2>
        <ListEditor<string>
          label="Примеры"
          items={value.examples}
          createItem={() => ""}
          addLabel="Добавить пример"
          onChange={(items) => update("examples", items)}
          renderItem={(item, replace) => (
            <Field label="Пример" required>
              {(props) => (
                <textarea
                  {...props}
                  className={styles.textarea}
                  rows={2}
                  value={item}
                  onChange={(event) => replace(event.target.value)}
                />
              )}
            </Field>
          )}
        />
      </section>

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Стоимость</h2>
        <p className={styles.panelNote}>
          Первый тариф показывается в карточке продукта и попадает в описание для поисковых систем.
          «Сумма» — число в рублях для микроразметки; «стоимость» — то, что видит посетитель.
        </p>

        <ListEditor<ProductPrice>
          label="Тарифы"
          items={value.prices}
          createItem={() => ({ label: "", value: "", amount: 0 })}
          addLabel="Добавить тариф"
          onChange={(items) => update("prices", items)}
          renderItem={(item, replace) => (
            <div className={styles.fieldRow}>
              <Field label="Название тарифа" required>
                {(props) => (
                  <input
                    {...props}
                    value={item.label}
                    onChange={(event) => replace({ ...item, label: event.target.value })}
                  />
                )}
              </Field>
              <Field label="Стоимость (текст)" required>
                {(props) => (
                  <input
                    {...props}
                    value={item.value}
                    onChange={(event) => replace({ ...item, value: event.target.value })}
                  />
                )}
              </Field>
              <Field label="Сумма, ₽ (число)" required>
                {(props) => (
                  <input
                    {...props}
                    type="number"
                    min={0}
                    value={item.amount}
                    onChange={(event) =>
                      replace({ ...item, amount: Number(event.target.value) || 0 })
                    }
                  />
                )}
              </Field>
            </div>
          )}
        />

        <TextAreaField
          label="Примечание к стоимости"
          rows={2}
          value={value.priceNote}
          onChange={(next) => update("priceNote", next)}
        />
      </section>

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Отображение</h2>
        <CheckboxField
          label="Показывать на сайте"
          checked={value.isPublished}
          onChange={(checked) => update("isPublished", checked)}
        />
        <TextField
          label="Порядок отображения"
          type="number"
          hint="Меньшее число — выше в списке. Обычно порядок удобнее менять стрелками слева."
          value={String(value.sortOrder)}
          onChange={(next) => update("sortOrder", Number(next) || 0)}
        />
      </section>

      <SaveBar form={form} publicHref={`/products/${product.slug}`} />
    </div>
  );
}
