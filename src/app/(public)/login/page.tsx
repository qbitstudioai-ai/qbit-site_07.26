import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/features/admin/LoginForm";
import { isAuthenticated } from "@/server/auth/session";
import styles from "../PublicPages.module.css";

export const metadata: Metadata = {
  title: "Вход — QBit-Studio-Ai",
  description: "Вход в панель управления содержимым сайта.",
  robots: {
    index: false,
    follow: false,
    // Страница входа не должна оставаться и в сохранённой копии поисковой системы.
    noarchive: true,
  },
};

/** Страница не кэшируется: её содержимое зависит от того, есть ли у посетителя сессия. */
export const dynamic = "force-dynamic";

interface LoginPageProps {
  searchParams: Promise<{ next?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { next } = await searchParams;

  // Только внутренний путь: параметр `next` приходит из адресной строки, и внешний адрес здесь
  // превратил бы страницу входа в инструмент перенаправления на чужой сайт.
  const target = next && next.startsWith("/admin") ? next : "/admin";

  if (await isAuthenticated()) {
    redirect(target);
  }

  return (
    <article className={styles.content}>
      <h1 className={styles.title}>Вход</h1>
      <p className={styles.lead}>
        Панель управления содержимым сайта: тексты отделов, продукты, статьи, контакты и документы.
      </p>

      <LoginForm next={target} />

      <Link className={styles.backLink} href="/">
        ← На главную
      </Link>
    </article>
  );
}
