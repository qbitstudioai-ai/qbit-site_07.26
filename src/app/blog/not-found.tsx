import type { Metadata } from "next";
import Link from "next/link";
import styles from "./not-found.module.css";

/**
 * 404 раздела «Блог».
 *
 * Зачем сегментная страница, а не общая. `notFound()` из `blog/[[...slug]]/page.tsx` поднимается до
 * ближайшего `not-found.tsx`. Своего у раздела не было, а корневого в проекте нет вовсе — поэтому
 * Next.js отрисовывал встроенную заглушку ВНУТРИ layout блога. Снимок production 2026-07-29
 * зафиксировал результат: ответ 404 приходил корректный, но в документе не оказывалось ни одного
 * `<h1>`, а `<title>` был общим — «QBit-Studio-Ai». Посетитель по битой ссылке видел страницу без
 * заголовка и без выхода обратно в раздел.
 *
 * HTTP-статус остаётся 404: его выставляет сам механизм `notFound()`, а файл отвечает только за
 * содержимое. Специально ничего для статуса делать не нужно — и нельзя, иначе «мягкая 404».
 */

export const metadata: Metadata = {
  title: "Статья не найдена — QBit-Studio-Ai",
  description: "Такой статьи в блоге QBit-Studio-Ai нет. Возможно, адрес изменился.",
  // Страница ошибки не должна попадать ни в выдачу, ни в сохранённую копию. `INDEXABLE_ROBOTS`
  // здесь неприменим намеренно — это единственный публичный сегмент, закрытый от индексации.
  robots: { index: false, follow: false, noarchive: true },
};

export default function BlogNotFound() {
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
          decoding="async"
        />
      </picture>
      <div className={styles.photoShade} aria-hidden="true" />

      <article className={styles.card}>
        <p className={styles.eyebrow}>Ошибка 404</p>
        <h1>Статья не найдена</h1>
        <p>
          Такой статьи в блоге нет: адрес мог измениться, а материал — быть снят с публикации.
          Остальные статьи на месте — откройте список и выберите нужную.
        </p>
        <Link className={styles.backLink} href="/blog">
          Вернуться в блог <span aria-hidden="true">→</span>
        </Link>
      </article>
    </main>
  );
}
