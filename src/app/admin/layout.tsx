import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminShell } from "@/features/admin/AdminShell";
import { isAuthenticated } from "@/server/auth/session";

/**
 * Второй, решающий рубеж защиты `/admin/*`.
 *
 * Middleware на Edge проверяет только подпись cookie — базы там нет. Здесь проверка настоящая:
 * существует ли сессия, не истекла ли она, не завершена ли кнопкой «Выйти». Без этого cookie с
 * валидной подписью от уже закрытой сессии продолжал бы открывать панель.
 *
 * `force-dynamic`: страницы админ-панели показывают текущее состояние базы и никогда не должны
 * отдаваться из кэша — ни между запросами, ни между пользователями.
 */

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Админ-панель — QBit-Studio-Ai",
  // Служебный раздел не должен попадать ни в поисковую выдачу, ни в сохранённые копии.
  robots: { index: false, follow: false, noarchive: true },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAuthenticated())) {
    redirect("/login?next=/admin");
  }

  return <AdminShell>{children}</AdminShell>;
}
