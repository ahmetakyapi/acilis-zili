import { FoldToggle } from "@/components/ui/FoldToggle";
import type { Dictionary } from "@/lib/i18n";
import type { Band, CheckId, ScreenResult } from "@/lib/screening";
import styles from "./Screening.module.css";

type T = Dictionary["screening"];

const MINI = 2 * Math.PI * 20;
/** Kapakta adıyla yazılan bayrak sayısı; fazlası "+N Daha". */
const FLAG_LIMIT = 5;
/** Telefonda açık gelen bayrak satırı; gerisi katlı (25 Ekim, gerekçe FlagSummary). */
const PHONE_FLAGS = 2;

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
  fold,
}: {
  result: ScreenResult;
  /** Telefondaki katlamanın etiketleri ("{n} Bayrak Daha" / "Daha Az Göster"). */
  fold: { more: string; less: string };
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
      {/* TELEFONDA İLK İKİ SATIR AÇIK (25 Ekim UX turu). 390'da beş satırlık
          liste 589→880 arası 291 piksel tutuyordu ve Uyum Puanı y=902'ye,
          Şirket Analizi 1.118'e düşüyordu. Sayılar ("1 Kural Kaldı · 4
          Dikkat") yine en başta — kapağın "önce bayraklar" kararı (yukarıda)
          korunuyor; adıyla ilk iki bayrak açık, gerisi sitenin JS'siz
          katlamasıyla (FoldToggle, yalnız 640 altı) bir dokunuşta. Satırlar
          sunucuda yine çiziliyor, bilgi kaybı yok. Puan satırı telefonda
          sayıların hemen altına çıkıyor (CSS `order`, Screening.module.css). */}
      {shown.length ? (
        <div className={styles.flagFold}>
          <FoldToggle
            id="screen-flags-fold"
            phone
            hiddenCount={Math.max(0, shown.length - PHONE_FLAGS)}
            more={fold.more.replace("{n}", String(Math.max(0, shown.length - PHONE_FLAGS)))}
            less={fold.less}
          >
            <ul className={styles.flagList}>
              {shown.map((check, index) => (
                <li key={check.id} data-status={check.status} data-fold={index >= PHONE_FLAGS ? "" : undefined}>
                  <span className={styles.flagName}>{names[check.id]}</span>
                  <span className={styles.flagState}>{statusOf(check.id)}</span>
                </li>
              ))}
              {flags.length > FLAG_LIMIT && (
                <li className={styles.flagMore} data-fold="">{t.moreFlags.replace("{n}", String(flags.length - FLAG_LIMIT))}</li>
              )}
            </ul>
          </FoldToggle>
        </div>
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
          /* Halka kendini çiziyor (14 Ekim): dolgu statik dasharray'di ve
             siteninki olan `.ring-fill` sözleşmesinin (globals.css
             `ring-draw`, MotionExperience `ring` dalı, reduced-motion
             kapatması) dışında kalan tek halkaydı. Son kare piksel piksel
             aynı. */
          <circle
            className={`ring-fill ${styles.dialFill}`}
            style={{ "--ring-circumference": MINI } as React.CSSProperties}
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
