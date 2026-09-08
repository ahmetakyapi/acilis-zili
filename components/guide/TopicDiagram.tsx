import styles from "./GuideExperience.module.css";

/** Conceptual diagrams, not market data: ownership, balance, statements,
 * and monetary transmission. The adjacent topic name supplies the meaning. */
export function TopicDiagram({ index }: { index: number }) {
  return <svg className={styles.diagram} viewBox="0 0 150 74" aria-hidden fill="none">
    {index === 0 && <>
      {[0, 1, 2].map((i) => <g key={i} className={styles.sheet} style={{ transform: `translate(${i * 17}px, ${-i * 7}px)` }}><rect x="28" y="25" width="52" height="39" rx="7" fill="var(--panel-fixed)" stroke="var(--primary-faint)" /><path d="M40 37h25M40 44h18M40 51h10" stroke="var(--primary)" strokeOpacity=".55" strokeLinecap="round" /></g>)}
      <circle cx="112" cy="46" r="12" fill="var(--primary-wash)" stroke="var(--primary-faint)" /><path d="M107 46h10m-5-5v10" stroke="var(--primary)" strokeLinecap="round" />
    </>}
    {index === 1 && <>
      <path d="M74 17v46m-18 0h36" stroke="var(--primary-faint)" strokeWidth="2" strokeLinecap="round" />
      <g className={styles.balance}><path d="M30 28l88-10M42 27L29 49h26L42 27Zm65-8L94 43h26l-13-24Z" stroke="var(--primary)" strokeOpacity=".65" strokeLinejoin="round" /><path d="M29 49q13 16 26 0M94 43q13 16 26 0" fill="var(--primary-wash)" stroke="var(--primary-faint)" /></g>
      <circle cx="74" cy="23" r="5" fill="var(--primary)" />
    </>}
    {index === 2 && <>
      <rect x="33" y="9" width="80" height="56" rx="8" stroke="var(--primary-faint)" fill="var(--primary-tint)" />
      <path d="M45 23h54M45 30h30M45 53h56" stroke="var(--primary-faint)" strokeLinecap="round" />
      {[14, 24, 32].map((h, i) => <rect key={i} className={styles.column} x={49 + i * 18} y={54 - h} width="9" height={h} rx="2" fill="var(--primary)" opacity={.3 + i * .25} />)}
    </>}
    {index === 3 && <>
      <g className={styles.transmission}>{[19, 29, 39].map((r) => <circle key={r} cx="75" cy="37" r={r} stroke="var(--primary-faint)" />)}</g>
      <circle cx="75" cy="37" r="16" fill="var(--primary-wash)" /><path d="m65 33 10-6 10 6H65Zm3 3v9m7-9v9m7-9v9m-17 2h20" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /><circle cx="104" cy="37" r="3" fill="var(--primary)" />
    </>}
  </svg>;
}
