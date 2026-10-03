import type { Dictionary } from "@/lib/i18n";
import type { Band, ScreenResult } from "@/lib/screening";
import styles from "./Screening.module.css";

type T = Dictionary["screening"];

/** Halkanın çevresi — r=52 (görüş kutusu 120). */
const RING = 2 * Math.PI * 52;
const MINI = 2 * Math.PI * 20;

/**
 * Puan halkası. Halkanın rengi PUANDAN değil BANTTAN geliyor: eleme
 * kuralına takılan 45 puanlık hisse ile kuralların çoğunda geride kalan 45
 * puanlık hisse aynı sayıyı taşıyor ama ikisi aynı hüküm değil; "Veri
 * Yetersiz" bant da sayıyı sessiz bir halkayla yazıyor ki 70 puan yeşil bir
 * hüküm gibi okunmasın.
 */
export function ScoreDial({ result, t }: { result: ScreenResult; t: T }) {
  const band: Band | "none" = result.band ?? "none";
  const score = result.score;
  return (
    <div className={styles.dial} data-band={band}>
      <div className={styles.dialRing}>
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <circle className={styles.dialTrack} cx="60" cy="60" r="52" />
          {score !== null && score > 0 && (
            <circle
              className={styles.dialFill}
              cx="60"
              cy="60"
              r="52"
              strokeDasharray={`${(RING * score) / 100} ${RING}`}
            />
          )}
        </svg>
        <div className={styles.dialCenter}>
          <span className={styles.dialScore}>{score ?? "—"}</span>
          <span className={styles.dialOut}>{t.outOf}</span>
        </div>
      </div>
      <div className={styles.dialCopy}>
        <p className={styles.dialLabel}>{t.scoreLabel}</p>
        {result.band && <p className={styles.bandPill}>{t.bands[result.band]}</p>}
        {result.band && <p className={styles.dialHint}>{t.bandHints[result.band]}</p>}
        <p className={styles.dialCoverage}>{t.coverage.replace("{n}", String(result.coverage))}</p>
      </div>
    </div>
  );
}

/** Hızlı bakış kartlarının küçük halkası — aynı renk kuralı. */
export function MiniDial({ score, band }: { score: number | null; band: Band | null }) {
  return (
    <span className={styles.mini} data-band={band ?? "none"} aria-hidden="true">
      <svg viewBox="0 0 48 48">
        <circle className={styles.dialTrack} cx="24" cy="24" r="20" />
        {score !== null && score > 0 && (
          <circle
            className={styles.dialFill}
            cx="24"
            cy="24"
            r="20"
            strokeDasharray={`${(MINI * score) / 100} ${MINI}`}
          />
        )}
      </svg>
      <b>{score ?? "—"}</b>
    </span>
  );
}
