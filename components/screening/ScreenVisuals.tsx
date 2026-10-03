import type { Dictionary } from "@/lib/i18n";
import type { Band, CheckId, ScreenResult } from "@/lib/screening";
import styles from "./Screening.module.css";

type T = Dictionary["screening"];

const MINI = 2 * Math.PI * 20;
/** Kapakta adıyla yazılan bayrak sayısı; fazlası "+N Daha". */
const FLAG_LIMIT = 5;

/**
 * KAPAK ÖNCE BAYRAKLARI GÖSTERİYOR (3 Ekim). İlk sürümde kapağın sağı
 * 148 piksellik bir puan halkasıydı ve "98 · Güçlü Aday" bir alım sinyali
 * gibi okunuyordu — MU dibinin %546 üstündeyken. Ekranın gerçekten değerli
 * işi kırmızı bayrak (kalan kural, dikkat) göstermek; puan bir araştırma
 * önceliği, o yüzden altta küçük bir satır.
 *
 * Bayrak sırası motorun eksi sırası: önce kalanlar, sonra dikkatler. Eleme
 * kuralına takılan kontrol adıyla en başta.
 */
export function FlagSummary({
  result,
  names,
  statusOf,
  t,
}: {
  result: ScreenResult;
  /** Kontrolün adı (sözlükten) — bileşen sözlüğü bilmeden çizsin. */
  names: Record<CheckId, string>;
  /** Kontrolün durum etiketi ("Baz Etkisi" dahil) — rapordaki tablonun aynısı. */
  statusOf: (id: CheckId) => string;
  t: T;
}) {
  const byId = new Map(result.checks.map((check) => [check.id, check]));
  const flags = result.cons.map((id) => byId.get(id)!);
  const fails = flags.filter((check) => check.status === "fail").length;
  const warns = flags.length - fails;
  const shown = flags.slice(0, FLAG_LIMIT);
  return (
    <div className={styles.flags}>
      <p className={styles.dialLabel}>{t.flagsTitle}</p>
      <div className={styles.flagCounts}>
        <span data-status={fails ? "fail" : "na"}>
          <b>{fails}</b>
          {t.failLabel}
        </span>
        <span data-status={warns ? "warn" : "na"}>
          <b>{warns}</b>
          {t.warnLabel}
        </span>
      </div>
      {shown.length ? (
        <ul className={styles.flagList}>
          {shown.map((check) => (
            <li key={check.id} data-status={check.status}>
              <span className={styles.flagName}>{names[check.id]}</span>
              <span className={styles.flagState}>{statusOf(check.id)}</span>
            </li>
          ))}
          {flags.length > FLAG_LIMIT && (
            <li className={styles.flagMore}>{t.moreFlags.replace("{n}", String(flags.length - FLAG_LIMIT))}</li>
          )}
        </ul>
      ) : (
        <p className={styles.flagEmpty}>{t.noFlags}</p>
      )}
      <ScoreLine result={result} t={t} />
    </div>
  );
}

/** Puan: küçük halka, bant ve tek cümlelik ipucu. */
function ScoreLine({ result, t }: { result: ScreenResult; t: T }) {
  return (
    <div className={styles.scoreLine}>
      <MiniDial score={result.score} band={result.band} />
      <div className={styles.scoreCopy}>
        <p className={styles.scoreHead}>
          <span>{t.scoreLabel}</span>
          {result.band && (
            <span className={styles.bandPill} data-band={result.band}>
              {t.bands[result.band]}
            </span>
          )}
        </p>
        {result.band && <p className={styles.dialHint}>{t.bandHints[result.band]}</p>}
        <p className={styles.dialCoverage}>{t.coverage.replace("{n}", String(result.coverage))}</p>
      </div>
    </div>
  );
}

/** Küçük puan halkası. Rengi PUANDAN değil BANTTAN: eleme kuralına takılan
    45 puanlık hisse ile kuralların çoğunda geride kalan 45 puanlık hisse aynı
    sayıyı taşıyor ama aynı hüküm değil; "Veri Yetersiz" sessiz renkte. */
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
