import styles from "./EditorialExperience.module.css";

/** Compact editorial opening: the page's live data or story stays above the fold. */
export function SectionMasthead({ eyebrow, title, description, embedded = false }: {
  eyebrow: string; title: string; description: string; embedded?: boolean;
}) {
  return <header className={`${styles.masthead} page-masthead`} data-embedded={embedded}>
    <div className="page-heading-copy"><p className={`${styles.eyebrow} page-eyebrow`}>{eyebrow}</p><h1>{title}</h1></div>
    <p className={styles.mastheadDescription}>{description}</p>
  </header>;
}
