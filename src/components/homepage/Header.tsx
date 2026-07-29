"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { HeroLink } from "@/content/types";
import styles from "./Header.module.css";

interface HeaderProps {
  links: HeroLink[];
  phoneLabel: string;
  phoneHref: string;
  phoneAccessibleLabel: string;
  onReturnHome?: () => void;
  inactiveLinkLabels?: readonly string[];
  /**
   * Адрес текущей страницы. Пункт меню с этим href получает `aria-current="page"` и постоянно
   * видимое подчёркивание. Передаётся страницей явно, а не выводится из `usePathname()`: так
   * состояние появляется ровно там, где оно предусмотрено, и разметка остальных страниц не меняется.
   */
  activeHref?: string;
}

export function Header({
  links,
  phoneLabel,
  phoneHref,
  phoneAccessibleLabel,
  onReturnHome,
  inactiveLinkLabels = [],
  activeHref,
}: HeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const navigationRef = useRef<HTMLElement>(null);

  const closeMenu = () => {
    setIsMenuOpen(false);
    menuButtonRef.current?.focus();
  };

  useEffect(() => {
    if (!isMenuOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
        menuButtonRef.current?.focus();
        return;
      }

      // Мобильный аудит 2026-07-28, MOB-03: удержание фокуса внутри раскрытого меню.
      //
      // Раскрытый список — накладка поверх страницы, но страница под ней остаётся в поряде обхода:
      // Tab с последнего пункта уходил на содержимое, закрытое подложкой, и пользователь на
      // клавиатуре терял и меню, и понимание, где он находится. Ловушка замкнута на кнопке меню и
      // пунктах: кнопка стоит в DOM ПЕРЕД <nav>, поэтому естественный порядок «кнопка → пункты»
      // не меняется — дописаны только два перехода на краях цикла.
      if (event.key !== "Tab") return;

      const menuButton = menuButtonRef.current;
      const navigation = navigationRef.current;
      if (!menuButton || !navigation) return;

      // Пункты без href (`aria-disabled`) в цикл не входят: они не фокусируются и в нём не нужны.
      const items = [...navigation.querySelectorAll<HTMLElement>("a[href]")];
      const first = menuButton;
      const last = items.at(-1) ?? menuButton;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
        return;
      }

      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMenuOpen]);

  const brandContent = (
    <>
      <Image src="/logo.svg" alt="" width={90} height={64} className={styles.logo} />
      <span className={styles.brand}>QBit-Studio-Ai</span>
    </>
  );

  return (
    <header className={styles.header}>
      {onReturnHome ? (
        // На homepage логотип — действие текущей state machine: обычный Link на тот же App Router
        // route не размонтирует useReducer и не сбросит overview/department state.
        <button
          type="button"
          className={styles.brandRow}
          onClick={onReturnHome}
          aria-label="QBit-Studio-Ai"
        >
          {brandContent}
        </button>
      ) : (
        <Link className={styles.brandRow} href="/" aria-label="QBit-Studio-Ai">
          {brandContent}
        </Link>
      )}

      <a
        className={styles.action}
        href={phoneHref}
        aria-label={phoneAccessibleLabel}
        data-header-phone
      >
        {phoneLabel}
      </a>

      <button
        ref={menuButtonRef}
        type="button"
        className={styles.menuButton}
        aria-label={isMenuOpen ? "Закрыть меню" : "Открыть меню"}
        aria-expanded={isMenuOpen}
        aria-controls="site-navigation"
        onClick={() => setIsMenuOpen((isOpen) => !isOpen)}
      >
        <span aria-hidden="true" />
        <span aria-hidden="true" />
        <span aria-hidden="true" />
      </button>

      {/* Подложка раскрытого меню (MOB-03): принимает нажатие мимо пунктов и закрывает меню, а
          заодно не даёт случайному касанию уйти в страницу под ней.

          Скрыта от дерева доступности (`aria-hidden` + `tabIndex={-1}`) намеренно. Она НЕ добавляет
          возможностей: закрыть меню с клавиатуры можно по Escape, а указателем — той же кнопкой
          меню. Объявленная же подложка стала бы вторым элементом с подписью «Закрыть меню» — два
          одинаково названных контрола рядом скринридер прочитает как выбор без разницы, и unit-тест
          заголовка справедливо перестал их различать. `tabIndex={-1}` здесь обязателен вместе с
          `aria-hidden`: скрытый, но фокусируемый элемент — это нарушение (axe `aria-hidden-focus`). */}
      {isMenuOpen ? (
        <button
          type="button"
          className={styles.backdrop}
          aria-hidden="true"
          tabIndex={-1}
          data-menu-backdrop
          onClick={closeMenu}
        />
      ) : null}

      <nav
        ref={navigationRef}
        id="site-navigation"
        className={`${styles.navigation} ${isMenuOpen ? styles.navigationOpen : ""}`}
        aria-label="Основная навигация"
      >
        {links.map((link) =>
          inactiveLinkLabels.includes(link.label) ? (
            <span key={link.label} aria-disabled="true">
              {link.label}
            </span>
          ) : link.href === "#" ? (
            <a
              key={link.label}
              href={link.href}
              onClick={(event) => {
                // Пока destination не существует, пункт не должен закрывать mobile disclosure:
                // иначе focus останется на ссылке, которую display:none сразу уберёт из экрана.
                event.preventDefault();
              }}
            >
              {link.label}
            </a>
          ) : (
            <Link
              key={link.label}
              href={link.href}
              aria-current={link.href === activeHref ? "page" : undefined}
              prefetch={link.href === "/products" ? false : undefined}
              onClick={(event) => {
                setIsMenuOpen(false);

                if (link.href === "/" && onReturnHome) {
                  event.preventDefault();
                  onReturnHome();
                }
              }}
            >
              {link.label}
            </Link>
          ),
        )}
      </nav>
    </header>
  );
}
