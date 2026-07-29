"use client";

import { Fragment } from "react";
import { parseBlogMarkdown } from "@/features/blog/markdown";
import styles from "./admin.module.css";

/**
 * Предпросмотр статьи в админ-панели.
 *
 * Разбор — тот же `parseBlogMarkdown`, что использует публичная страница, поэтому предпросмотр
 * показывает именно ту структуру, которая попадёт на сайт, а не приблизительную.
 *
 * Разметка собирается из React-элементов: строка Markdown НИКОГДА не подставляется как HTML.
 * Отсюда следует главное — вставить `<script>` или обработчик события через текст статьи
 * невозможно ни здесь, ни на публичной странице: произвольный HTML просто не интерпретируется.
 */

/** Инлайн-разметка: ссылки, жирный, курсив, код. Всё остальное остаётся обычным текстом. */
function renderInline(markdown: string, keyPrefix: string) {
  const pattern = /(\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`)/gu;
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let tokenIndex = 0;

  while ((match = pattern.exec(markdown))) {
    if (match.index > lastIndex) nodes.push(markdown.slice(lastIndex, match.index));

    const key = `${keyPrefix}-${tokenIndex}`;
    if (match[2] && match[3]) {
      nodes.push(
        <a key={key} href={match[3]} target="_blank" rel="noopener noreferrer">
          {match[2]}
        </a>,
      );
    } else if (match[4]) {
      nodes.push(<strong key={key}>{match[4]}</strong>);
    } else if (match[5]) {
      nodes.push(<em key={key}>{match[5]}</em>);
    } else if (match[6]) {
      nodes.push(<code key={key}>{match[6]}</code>);
    }

    lastIndex = match.index + match[0].length;
    tokenIndex += 1;
  }

  if (lastIndex < markdown.length) nodes.push(markdown.slice(lastIndex));
  return nodes;
}

export function MarkdownPreview({ markdown }: { markdown: string }) {
  const sections = parseBlogMarkdown(markdown);

  if (sections.length === 0) {
    return (
      <p className={styles.messageEmpty}>Текст пока пуст — предпросмотр появится после ввода</p>
    );
  }

  return (
    <div>
      {sections.map((section, sectionIndex) => (
        <section key={section.id}>
          <h3 className={styles.panelTitle}>{section.heading}</h3>
          {section.blocks.map((block, blockIndex) => {
            const key = `${sectionIndex}-${blockIndex}`;

            if (block.type === "paragraph") {
              return <p key={key}>{renderInline(block.markdown, key)}</p>;
            }
            if (block.type === "unordered-list") {
              return (
                <ul key={key} style={{ paddingLeft: 20 }}>
                  {block.items.map((item, itemIndex) => (
                    <li key={itemIndex}>{renderInline(item, `${key}-${itemIndex}`)}</li>
                  ))}
                </ul>
              );
            }
            if (block.type === "ordered-list") {
              return (
                <ol key={key} style={{ paddingLeft: 20 }}>
                  {block.items.map((item, itemIndex) => (
                    <li key={itemIndex}>{renderInline(item, `${key}-${itemIndex}`)}</li>
                  ))}
                </ol>
              );
            }

            return (
              <Fragment key={key}>
                <pre className={styles.previewBox} style={{ display: "block", overflowX: "auto" }}>
                  <code>{block.value}</code>
                </pre>
              </Fragment>
            );
          })}
        </section>
      ))}
    </div>
  );
}
