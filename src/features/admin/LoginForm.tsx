"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import styles from "./login.module.css";

/**
 * Форма входа в админ-панель.
 *
 * Пароль существует только в состоянии этой формы и в теле одного POST-запроса: он не попадает ни
 * в адресную строку (форма отправляется методом POST через fetch), ни в `localStorage`, ни в лог.
 * Признак «вошёл» тоже не хранится на клиенте — его выдаёт сервер cookie-сессией.
 *
 * Регистрации и восстановления пароля нет: администратор один, его учётные данные задаются
 * переменными окружения.
 */

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSending) return;

    setIsSending(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, password }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        setError(payload.error ?? "Неверный логин или пароль");
        setPassword("");
        return;
      }

      setPassword("");
      router.replace(next);
      // Без обновления серверных данных layout `/admin` продолжил бы считать посетителя гостем.
      router.refresh();
    } catch {
      setError("Не удалось связаться с сервером. Проверьте соединение и попробуйте ещё раз.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="admin-login">
          Логин
        </label>
        <input
          id="admin-login"
          className={styles.input}
          type="text"
          name="login"
          value={login}
          autoComplete="username"
          autoFocus
          required
          onChange={(event) => setLogin(event.target.value)}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="admin-password">
          Пароль
        </label>
        <input
          id="admin-password"
          className={styles.input}
          type="password"
          name="password"
          value={password}
          autoComplete="current-password"
          required
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>

      <div className={styles.status} role="alert">
        {error ? <p className={styles.error}>{error}</p> : null}
      </div>

      <button className={styles.submit} type="submit" disabled={isSending}>
        {isSending ? "Проверяем…" : "Войти"}
      </button>
    </form>
  );
}
