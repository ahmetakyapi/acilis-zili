import styles from "./EditorialExperience.module.css";

/** Compact editorial opening: the page's live data or story stays above the fold. */
export function SectionMasthead({ eyebrow, title, description }: {
  eyebrow: string; title: string; description: string;
}) {
  return <header className={styles.masthead}>
    <div><p className={styles.eyebrow}>{eyebrow}</p><h1>{title}</h1></div>
    <p className={styles.mastheadDescription}>{description}</p>
  </header>;
}
