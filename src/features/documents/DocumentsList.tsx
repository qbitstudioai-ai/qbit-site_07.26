"use client";

import type { DocumentCategoryOption, DocumentItem } from "./documents";
import { documentFacts } from "./documents";
import { DocumentGlyph } from "./DocumentIcons";
import styles from "./DocumentsExperience.module.css";

interface DocumentsListProps {
  items: readonly DocumentItem[];
  activeId: string | null;
  onSelect: (item: DocumentItem) => void;
  categories: readonly DocumentCategoryOption[];
  activeCategory: string;
  onCategoryChange: (categoryId: string) => void;
}

export function DocumentsList({
  items,
  activeId,
  onSelect,
  categories,
  activeCategory,
  onCategoryChange,
}: DocumentsListProps) {
  return (
    <div className={styles.catalog}>
      {categories.length > 0 ? (
        <div
          className={styles.categories}
          role="group"
          aria-label="Категории документов"
          data-document-categories
        >
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              className={styles.category}
              aria-pressed={category.id === activeCategory}
              onClick={() => onCategoryChange(category.id)}
            >
              {category.label}
            </button>
          ))}
        </div>
      ) : null}

      {items.length === 0 ? (
        <p className={styles.listEmpty}>В этой категории пока нет документов</p>
      ) : (
        <ul className={styles.list} data-documents-list>
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className={styles.listItem}
                data-document-item={item.id}
                // Предпросмотр меняется только по клику — aria-current отражает именно выбор,
                // а не наведение.
                aria-current={item.id === activeId ? "true" : undefined}
                onClick={() => onSelect(item)}
              >
                <DocumentGlyph className={styles.listItemGlyph} />
                <span className={styles.listItemTitle}>{item.title}</span>
                <span className={styles.listItemFacts}>{documentFacts(item)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
