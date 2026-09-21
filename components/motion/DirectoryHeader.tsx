import { HeroAccent } from "./HeroAccent";
import type { ReactNode } from "react";
import styles from "./DirectoryExperience.module.css";

/** Server-rendered editorial header; all figures and graphics come from its page. */
export function DirectoryHeader({ eyebrow, title, description, children, visual, className = "" }: {
  eyebrow: string; title: string; description?: string; children?: ReactNode; visual?: ReactNode; className?: string;
}) {
  return <header className={`${styles.hero} page-frame ${className}`} data-has-visual={!!visual}>
    <HeroAccent />
    <div className={`${styles.heroCopy} page-heading-copy`}>
      <p className={`${styles.eyebrow} page-eyebrow`}>{eyebrow}</p>
      <h1>{title}</h1>
      {description && <p className={styles.description}>{description}</p>}
      {children}
    </div>
    {visual && <div className={styles.heroVisual}>{visual}</div>}
  </header>;
}
