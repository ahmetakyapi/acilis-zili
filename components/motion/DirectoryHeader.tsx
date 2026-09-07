import type { ReactNode } from "react";
import styles from "./DirectoryExperience.module.css";

/** Server-rendered editorial header; all figures and graphics come from its page. */
export function DirectoryHeader({ eyebrow, title, description, children, visual }: {
  eyebrow: string; title: string; description?: string; children?: ReactNode; visual?: ReactNode;
}) {
  return <header className={styles.hero} data-has-visual={!!visual}>
    <div className={styles.heroCopy}>
      <p className={styles.eyebrow}>{eyebrow}</p>
      <h1>{title}</h1>
      {description && <p className={styles.description}>{description}</p>}
      {children}
    </div>
    {visual && <div className={styles.heroVisual}>{visual}</div>}
  </header>;
}
