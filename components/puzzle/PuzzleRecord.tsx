import { cn, formatPercentPlain } from "@/lib/utils";
import { MAX_GUESSES, currentStreak, emptyStats, type PuzzleStats } from "@/lib/stock-puzzle";
import type { Locale } from "@/lib/i18n/config";
import type { StockPuzzleLabels } from "@/lib/i18n/dictionaries/stock-puzzle";
import styles from "./PuzzleRecord.module.css";

/**
 * "Senin Serin" (25 Ekim; tek ekran için aynı gün şeride indi).
 *
 * Eskiden dört büyük ölçü, altı satırlık dağılım ve iki not taşıyan ayrı
 * bir paneldi (1440'ta ~330 piksel). Oyunun asıl işi tahmin ve ipucu; seri
 * okunması gereken ama bakılıp geçilen bir künye. Şimdi tahtanın altında
 * tek şerit: başlık, dört sayı, altı sütunluk minyatür dağılım (sütun
 * yüksekliği o tahminde kaç kez bilindiği; bugünün sütunu yeşil) ve
 * seriye girmeyen iki sayaç. Not ("yalnız bu tarayıcıda") `title`da ve
 * tahtanın altındaki "Nasıl Oynanır"da.
 *
 * Renk: dağılım büyüklük, markanın yumuşak mavisi; BUGÜNÜN kazandığı
 * sütun yeşil (karolardaki "tutuyor" yeşiliyle aynı anlam: bildin).
 * Veri yalnız bu tarayıcıda (`puzzle-storage.ts`); sunucu çiziminde boş
 * istatistikle çizilir, depo okununca dolar. Sütunlar `scaleY` ile:
 * yükseklik değişimi yerleşimi oynatmıyor, kayma yok.
 */
export function PuzzleRecord({
  stats,
  today,
  todaySlot,
  labels,
  locale,
  className,
}: {
  stats: PuzzleStats | null;
  /** Bugünün gün numarası (`dayNumberOf`). */
  today: number;
  /** Bugün kazanıldıysa kaçıncı tahminde (1-6); değilse null. */
  todaySlot: number | null;
  labels: StockPuzzleLabels;
  locale: Locale;
  className?: string;
}) {
  const value = stats ?? emptyStats();
  const played = value.played;
  const streak = currentStreak(value, today);
  const winRate = played > 0 ? (value.wins / played) * 100 : 0;
  const max = Math.max(1, ...value.distribution);
  const figures = [
    { key: "played", label: labels.played, text: String(played) },
    { key: "rate", label: labels.winRate, text: formatPercentPlain(winRate, locale, 0) },
    { key: "streak", label: labels.streak, text: String(streak) },
    { key: "best", label: labels.best, text: String(value.best) },
    { key: "archive", label: labels.archiveWins, text: String(value.archiveWins) },
    { key: "pure", label: labels.pureWins, text: String(value.pureWins) },
  ];

  return (
    <section className={cn(styles.record, className)} aria-labelledby="bulmaca-seri" title={labels.statsNote} data-tahta="seri">
      <h2 id="bulmaca-seri" className={styles.title}>{labels.statsTitle}</h2>
      <dl className={styles.stats}>
        {figures.map((figure) => (
          <div key={figure.key} data-extra={figure.key === "archive" || figure.key === "pure" ? "" : undefined}>
            <dt>{figure.label}</dt>
            <dd className="numeral">{figure.text}</dd>
          </div>
        ))}
      </dl>
      <figure className={styles.dist}>
        <figcaption className="sr-only">{labels.distribution}</figcaption>
        <ol className={cn(played === 0 && styles.idle)}>
          {Array.from({ length: MAX_GUESSES }, (_, i) => {
            const count = value.distribution[i] ?? 0;
            return (
              <li key={i} data-today={todaySlot === i + 1 ? "" : undefined} title={`${labels.distribution}: ${i + 1} → ${count}`}>
                <span aria-hidden className={styles.col}>
                  <span className={styles.bar} style={{ transform: `scaleY(${count / max})` }} />
                </span>
                <span className={cn(styles.key, "numeral")}>{i + 1}</span>
                <span className="sr-only">{count}</span>
              </li>
            );
          })}
        </ol>
      </figure>
    </section>
  );
}
