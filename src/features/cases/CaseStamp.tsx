"use client";

import { useEffect, useState } from "react";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import styles from "./CasesExperience.module.css";

/**
 * Печать на документе кейса.
 *
 * Поведение: документ открывается, человек начинает читать, и примерно через две секунды печать
 * ставится ударом — это фирменный момент раздела, а не украшение. Само движение целиком в CSS
 * (`caseStampStrike`), здесь только один таймер, решающий КОГДА.
 *
 * Печать декоративна: `alt=""` и `aria-hidden` на обёртке. В дереве заголовков её нет, скринридеру
 * она ничего не сообщает — статус проекта передан текстом в шапке документа.
 *
 * Про очистку таймера. Компонент вызывается с `key={study.slug}`, поэтому при смене кейса React
 * размонтирует прежний экземпляр — функция очистки эффекта снимает его таймер. Дополнительная
 * защита — зависимость от `caseKey`: даже если React переиспользует экземпляр, ожидание начнётся
 * заново, и печать прошлого кейса на новом документе не появится. Одновременно живёт максимум один
 * таймер и максимум одна печать.
 */

/** Задержка до удара. Требование этапа — «примерно через 2 секунды после открытия кейса». */
const STAMP_DELAY_MS = 2000;

interface CaseStampProps {
  /** Ключ текущего кейса. Смена значения перезапускает ожидание. */
  caseKey: string;
  /** Значение `stampEnabled` кейса. `false` — документ остаётся без печати. */
  enabled: boolean;
}

export function CaseStamp({ caseKey, enabled }: CaseStampProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [waitedKey, setWaitedKey] = useState(caseKey);
  const [hasWaited, setHasWaited] = useState(false);

  // Сброс ожидания, если React переиспользовал экземпляр под другой кейс. Приём из документации
  // React («adjusting state when props change»); в эффекте то же самое дало бы каскад отрисовок.
  if (waitedKey !== caseKey) {
    setWaitedKey(caseKey);
    setHasWaited(false);
  }

  // prefers-reduced-motion: сложного движения нет вовсе, а ждать две секунды человеку, попросившему
  // меньше движения, незачем — печать просто находится на документе (сами кадры анимации обнуляет
  // globals.css). Значение выводится, а не хранится: тогда смена системной настройки на лету не
  // требует ни таймера, ни лишнего состояния.
  const isStruck = enabled && (prefersReducedMotion || hasWaited);

  useEffect(() => {
    if (!enabled || prefersReducedMotion) return;

    const timer = window.setTimeout(() => setHasWaited(true), STAMP_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [caseKey, enabled, prefersReducedMotion]);

  if (!enabled) return null;

  return (
    <span
      className={`${styles.stamp} ${isStruck ? styles.stampStruck : ""}`}
      data-case-stamp={isStruck ? "struck" : "pending"}
      aria-hidden="true"
    >
      <picture>
        <source type="image/avif" srcSet="/cases/case-stamp-512.avif" />
        <source type="image/webp" srcSet="/cases/case-stamp-512.webp" />
        <img src="/cases/case-stamp-512.png" alt="" width={512} height={512} decoding="async" />
      </picture>
    </span>
  );
}
