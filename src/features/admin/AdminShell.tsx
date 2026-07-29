"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import styles from "./admin.module.css";

/**
 * Каркас админ-панели: боковая навигация, верхняя панель, выход.
 *
 * Клиентский компонент, потому что должен знать текущий адрес (подсветка активного раздела) и
 * открывать/закрывать меню на узком экране. Содержимое разделов приходит из серверных страниц —
 * данные внутрь каркаса не попадают.
 */

interface AdminSection {
  href: string;
  label: string;
  /** «Главная» совпадает точно: иначе она подсвечивалась бы на каждом вложенном разделе. */
  exact?: boolean;
}

const SECTIONS: readonly AdminSection[] = [
  { href: "/admin", label: "Главная", exact: true },
  { href: "/admin/departments", label: "Отделы" },
  { href: "/admin/products", label: "Продукты и стоимость" },
  { href: "/admin/blog", label: "Блог" },
  { href: "/admin/contacts", label: "Контакты" },
  { href: "/admin/documents", label: "Документы" },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  const current = SECTIONS.find((section) => isActive(section.href, section.exact));

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch("/api/admin/logout", { method: "POST" });
    } finally {
      // Сессия удаляется на сервере; `refresh()` обязателен, чтобы страница не осталась в кэше
      // роутера уже после выхода.
      router.replace("/login");
      router.refresh();
    }
  };

  return (
    <div className={styles.shell}>
      <aside className={`${styles.sidebar} ${isMenuOpen ? styles.sidebarOpen : ""}`}>
        <div>
          <span className={styles.brand}>QBit-Studio-Ai</span>
          <span className={styles.brandNote}>Управление содержимым сайта</span>
        </div>

        <nav className={styles.nav} aria-label="Разделы админ-панели">
          {SECTIONS.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className={styles.navLink}
              aria-current={isActive(section.href, section.exact) ? "page" : undefined}
              onClick={() => setIsMenuOpen(false)}
            >
              {section.label}
            </Link>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <a className={styles.navLink} href="/" target="_blank" rel="noopener noreferrer">
            Открыть сайт ↗
          </a>
          <button
            type="button"
            className={styles.navLink}
            onClick={handleLogout}
            disabled={isLoggingOut}
          >
            {isLoggingOut ? "Выходим…" : "Выйти"}
          </button>
        </div>
      </aside>

      <div className={styles.main}>
        <header className={styles.topbar}>
          <button
            type="button"
            className={`${styles.button} ${styles.menuButton}`}
            aria-expanded={isMenuOpen}
            onClick={() => setIsMenuOpen((open) => !open)}
          >
            {isMenuOpen ? "Закрыть меню" : "Меню"}
          </button>
          <h1 className={styles.topbarTitle}>{current?.label ?? "Админ-панель"}</h1>
        </header>

        <nav className={styles.breadcrumbs} aria-label="Хлебные крошки">
          <Link href="/admin">Админ-панель</Link>
          {current && current.href !== "/admin" ? (
            <>
              <span aria-hidden="true">/</span>
              <span aria-current="page">{current.label}</span>
            </>
          ) : null}
        </nav>

        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
