"use client";

import type { DocumentItem } from "./documents";
import { documentFacts } from "./documents";
import { DownloadGlyph } from "./DocumentIcons";
import styles from "./DocumentsExperience.module.css";

export function DocumentMeta({ item }: { item: DocumentItem }) {
  return (
    <div className={styles.meta} data-document-meta>
      <div className={styles.metaText}>
        <h2 className={styles.metaTitle}>{item.title}</h2>
        {item.description ? <p className={styles.metaDescription}>{item.description}</p> : null}
        <p className={styles.metaFacts}>{documentFacts(item, "обновлено ")}</p>
      </div>

      <div className={styles.metaActions}>
        {/* `download` — подсказка браузеру сохранить файл вместо открытия во встроенном
            просмотрщике. Для same-origin файлов (а все файлы каталога отдаются с этого же домена)
            атрибут работает и не мешает второму, менее заметному действию — открыть в новой вкладке. */}
        <a className={styles.download} href={item.fileUrl} download data-document-download>
          <DownloadGlyph className={styles.downloadGlyph} />
          Скачать документ
        </a>
        <a
          className={styles.openFull}
          href={item.fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          data-document-open
        >
          Открыть полностью
        </a>
      </div>
    </div>
  );
}
