import styles from "./Answers.module.css";

export type SessionBandSegment = {
  key: "pre" | "regular" | "after";
  name: string;
  /** Okura yazılan aralık — "17:30–00:00". */
  time: string;
  /** Seansın süresi (dakika): bandın eni bununla orantılı. */
  minutes: number;
};

/**
 * Günün üç seansı, süreleriyle orantılı tek şerit.
 *
 * `components/today/SessionRail` KULLANILMADI: o ray ana sayfanın gün
 * akışı deposuna (`day-flow-store`) bağlı bir istemci bileşeni; olay
 * rozetleri ve "şimdi" imi orada anlamlı. Buradaki soru yalnız "hangi
 * seans ne kadar sürüyor"; sunucuda basılan, durumsuz bir şerit yetiyor.
 * Dil aynı: asıl seans dolu mavi, kenar seanslar yumuşak dolgu.
 *
 * Şerit dekoratif değil ama bilgisi hemen altındaki tabloda sözle duruyor;
 * ekran okuyucuya tek cümle (`label`) okunur, parçalar gizlenir.
 */
export function SessionBand({ label, segments }: { label: string; segments: SessionBandSegment[] }) {
  return (
    <div
      role="img"
      aria-label={label}
      className={styles.band}
      style={{ gridTemplateColumns: segments.map((s) => `minmax(0,${s.minutes}fr)`).join(" ") }}
    >
      {segments.map((segment) => (
        <div key={segment.key} className={styles.seg} data-key={segment.key} aria-hidden>
          <span className={styles.segBar} />
          <span className={styles.segName}>{segment.name}</span>
          <span className={`numeral ${styles.segTime}`}>{segment.time}</span>
        </div>
      ))}
    </div>
  );
}
