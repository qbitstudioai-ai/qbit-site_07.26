import Link from "next/link";
import styles from "@/features/admin/admin.module.css";
import { formatRuDate } from "@/features/blog/posts";
import { countPublishedArticles, listAllArticles } from "@/server/repositories/articles";
import { countDocuments } from "@/server/repositories/documents";
import { getLastContentUpdate, listRecentActivity } from "@/server/repositories/revisions";

/**
 * Главная админ-панели: короткая сводка и последние изменения.
 *
 * Без графиков и «виджетов»: единственный вопрос, на который экран обязан отвечать сразу, —
 * «что и когда менялось». Всё остальное решается в разделах.
 */

const QUICK_LINKS = [
  { href: "/admin/departments", label: "Отделы", note: "Тексты пяти отделов на главной" },
  { href: "/admin/products", label: "Продукты и стоимость", note: "10 продуктов и общие тексты" },
  { href: "/admin/blog", label: "Блог", note: "Статьи, черновики, публикация" },
  { href: "/admin/contacts", label: "Контакты", note: "Телефон, почта, мессенджеры" },
  { href: "/admin/documents", label: "Документы", note: "Файлы, предпросмотр, порядок" },
] as const;

function formatMoment(iso: string): string {
  const date = formatRuDate(iso.slice(0, 10));
  const time = iso.slice(11, 16);
  return time ? `${date}, ${time}` : date;
}

export default function AdminDashboardPage() {
  const publishedArticles = countPublishedArticles();
  const totalArticles = listAllArticles().length;
  const documents = countDocuments();
  const lastUpdate = getLastContentUpdate();
  const activity = listRecentActivity(10);

  return (
    <>
      <div className={styles.statGrid}>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{publishedArticles}</span>
          <span className={styles.statLabel}>
            опубликованных статей{" "}
            {totalArticles > publishedArticles ? `(всего ${totalArticles})` : ""}
          </span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{documents.published}</span>
          <span className={styles.statLabel}>
            опубликованных документов{" "}
            {documents.total > documents.published ? `(всего ${documents.total})` : ""}
          </span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue}>
            {lastUpdate ? formatRuDate(lastUpdate.slice(0, 10)) : "—"}
          </span>
          <span className={styles.statLabel}>последнее обновление контента</span>
        </div>
      </div>

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Последние изменения</h2>
        <p className={styles.panelNote}>
          Журнал действий админ-панели. Предыдущие версии текстов сохраняются автоматически.
        </p>

        {activity.length === 0 ? (
          <p className={styles.messageEmpty}>Данные ещё не добавлены</p>
        ) : (
          <ul className={styles.activityList}>
            {activity.map((entry) => (
              <li key={entry.id} className={styles.activityItem}>
                <span>{entry.summary}</span>
                <span className={styles.activityTime}>{formatMoment(entry.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Разделы</h2>
        <div className={styles.grid}>
          {QUICK_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className={styles.recordLink}>
              <strong>{link.label}</strong>
              <span className={styles.recordMeta}>{link.note}</span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
