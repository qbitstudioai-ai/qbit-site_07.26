"use client";

import { useEffect, useReducer, type CSSProperties } from "react";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { DepartmentCTA } from "./DepartmentCTA";
import styles from "./CustomerBenefits.module.css";

interface CustomerBenefitsProps {
  benefits: string[];
  ctaLabel: string;
  contactHref: string;
}

const RESULT_DELAY_MS = 10_000;
const CTA_DELAY_MS = 760;

type RevealStage = "waiting" | "result" | "complete";
type RevealAction = { type: "show-result" } | { type: "show-cta" } | { type: "show-all" };

function revealReducer(stage: RevealStage, action: RevealAction): RevealStage {
  if (action.type === "show-result") return "result";
  return "complete";
}

export function CustomerBenefits({ benefits, ctaLabel, contactHref }: CustomerBenefitsProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [stage, dispatch] = useReducer(
    revealReducer,
    prefersReducedMotion ? "complete" : "waiting",
  );

  useEffect(() => {
    if (prefersReducedMotion) {
      dispatch({ type: "show-all" });
      return;
    }

    const resultTimer = window.setTimeout(() => dispatch({ type: "show-result" }), RESULT_DELAY_MS);
    const ctaTimer = window.setTimeout(
      () => dispatch({ type: "show-cta" }),
      RESULT_DELAY_MS + CTA_DELAY_MS,
    );

    return () => {
      window.clearTimeout(resultTimer);
      window.clearTimeout(ctaTimer);
    };
  }, [prefersReducedMotion]);

  const isResultVisible = stage !== "waiting";
  const isCtaVisible = stage === "complete";
  const visibleBenefits = benefits.slice(0, 4);

  return (
    <section
      className={styles.slot}
      aria-label={isResultVisible ? "Результат для бизнеса" : undefined}
      data-customer-benefits
      data-reveal-stage={stage}
    >
      {isResultVisible ? (
        <div className={styles.result}>
          <div className={styles.primaryResult}>
            <h3 className={styles.eyebrow}>Результат для бизнеса</h3>
            <p className={styles.primary}>{visibleBenefits[0]}</p>
          </div>
          {visibleBenefits.length > 1 ? (
            <ul className={styles.highlights}>
              {visibleBenefits.slice(1).map((benefit, index) => (
                <li key={benefit} style={{ "--highlight-index": index } as CSSProperties}>
                  {benefit}
                </li>
              ))}
            </ul>
          ) : (
            <div className={styles.highlights} aria-hidden="true" />
          )}
          <div className={isCtaVisible ? styles.ctaVisible : styles.ctaPending}>
            {isCtaVisible ? <DepartmentCTA label={ctaLabel} href={contactHref} /> : null}
          </div>
        </div>
      ) : (
        <div className={styles.placeholder} aria-hidden="true" />
      )}
    </section>
  );
}
