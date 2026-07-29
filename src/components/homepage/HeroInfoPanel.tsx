import type { HeroInfoPanel as HeroInfoPanelCopy, HeroProjectScenario } from "@/content/types";
import styles from "./HeroInfoPanel.module.css";

interface HeroInfoPanelProps {
  copy: HeroInfoPanelCopy;
  contactHref: string;
}

function Scenario({ scenario }: { scenario: HeroProjectScenario }) {
  return (
    <article className={styles.scenario} data-project-scenario>
      <div className={styles.metricBlock}>
        {scenario.metricPrefix ? (
          <span className={styles.metricPrefix}>{scenario.metricPrefix}</span>
        ) : null}
        <p
          className={styles.metric}
          aria-label={[scenario.metricPrefix, scenario.metric, scenario.unit]
            .filter(Boolean)
            .join(" ")}
        >
          <span>{scenario.metric}</span>
          <small>{scenario.unit}</small>
        </p>
        {scenario.qualifier ? <p className={styles.qualifier}>{scenario.qualifier}</p> : null}
      </div>
      <div className={styles.scenarioCopy}>
        <h3>{scenario.title}</h3>
        <p className={styles.description}>{scenario.description}</p>
        {scenario.detail ? <p className={styles.detail}>{scenario.detail}</p> : null}
        <p className={styles.effectLabel}>{scenario.effectLabel}</p>
      </div>
    </article>
  );
}

export function HeroInfoPanel({ copy, contactHref }: HeroInfoPanelProps) {
  return (
    <section className={styles.panel} aria-labelledby="project-scenarios-heading">
      <div className={styles.scenarioPanel} data-project-scenarios>
        <header className={styles.panelHeader}>
          <h2 id="project-scenarios-heading">{copy.title}</h2>
          <p>{copy.subtitle}</p>
        </header>
        <ol className={styles.scenarios}>
          {copy.scenarios.map((scenario) => (
            <li key={scenario.title}>
              <Scenario scenario={scenario} />
            </li>
          ))}
        </ol>
      </div>
      <a
        className={styles.postscript}
        href={contactHref}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={copy.postscript.ariaLabel}
        data-project-postscript
      >
        <span className={styles.postscriptLabel}>{copy.postscript.label}</span>
        <span className={styles.postscriptText}>
          {copy.postscript.text}
          <span className={styles.postscriptArrow} aria-hidden="true">
            {"\u00a0→"}
          </span>
        </span>
      </a>
    </section>
  );
}
