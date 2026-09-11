import styles from "./PremiumMotion.module.css";

/** Brand geometry only: these arcs never represent a financial series. */
export function HeroAccent() {
  return <div className={styles.heroAccent} aria-hidden="true">
    <svg viewBox="0 0 600 360" fill="none" preserveAspectRatio="xMaxYMin slice">
      <g className={styles.accentContours}>
        <ellipse cx="510" cy="-24" rx="170" ry="156" />
        <ellipse cx="510" cy="-24" rx="240" ry="218" />
        <ellipse cx="510" cy="-24" rx="310" ry="280" />
        <path className={styles.accentTrace} pathLength="1" d="M200 -24C200 131 339 256 510 256" />
      </g>
    </svg>
  </div>;
}
