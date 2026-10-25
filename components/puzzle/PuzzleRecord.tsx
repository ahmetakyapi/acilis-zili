import { Panel, PanelHeader } from "@/components/ui/primitives";
import { cn, formatPercentPlain } from "@/lib/utils";
import { MAX_GUESSES, currentStreak, emptyStats, type PuzzleStats } from "@/lib/stock-puzzle";
import type { Locale } from "@/lib/i18n/config";
import type { StockPuzzleLabels } from "@/lib/i18n/dictionaries/stock-puzzle";
import styles from "./PuzzleRecord.module.css";

/**
 * "Senin Serin" (25 Ekim) — dört ölçü ve tahmin dağılımı, BOŞKEN DE
 * görsel: hiç oynanmamışken altı soluk kulvar ve sıfırlar duruyor, okur
 * neyin dolacağını görüyor (eskiden yalnız bir cümleydi).
 *
 * Renk: dağılım çubukları ve kazanma oranı büyüklük, markanın yumuşak
 * mavisi (renk kararı); BUGÜNÜN kazandığı satır yeşil (kartlardaki
 * "tutuyor" yeşiliyle aynı anlam: bildin). Seri en iyi seriye oranla
 * kulvarda.
 *
 * Veri yalnız bu tarayıcıda (`puzzle-storage.ts`); sunucu çiziminde boş
 * istatistikle çizilir, depo okununca dolar — kulvarlar yerinde olduğu
 * için kayma yok.
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
    { key: "played", label: labels.played, text: String(played), share: null },
    { key: "rate", label: labels.winRate, text: formatPercentPlain(winRate, locale, 0), share: winRate / 100 },
    { key: "streak", label: labels.streak, text: String(streak), share: value.best > 0 ? streak / value.best : 0 },
    { key: "best", label: labels.best, text: String(value.best), share: null },
  ];

  return (
    <Panel className={className}>
      <PanelHeader title={labels.statsTitle} />
      <div className="px-4 pb-5 sm:px-5">
        <dl className={styles.stats}>
          {figures.map((figure) => (
            <div key={figure.key}>
              <dt>{figure.label}</dt>
              <dd className="numeral">{figure.text}</dd>
              {figure.share !== null && (
                <span aria-hidden className={styles.lane}>
                  <span className={styles.fill} style={{ transform: `scaleX(${Math.min(1, figure.share)})` }} />
                </span>
              )}
            </div>
          ))}
        </dl>
        <h3 className={styles.distHead}>{labels.distribution}</h3>
        <ol className={cn(styles.dist, played === 0 && styles.idle)}>
          {Array.from({ length: MAX_GUESSES }, (_, i) => {
            const count = value.distribution[i] ?? 0;
            const mine = todaySlot === i + 1;
            return (
              <li key={i} data-today={mine ? "" : undefined}>
                <span className={cn(styles.key, "numeral")}>{i + 1}</span>
                <span className={styles.distLane}>
                  <span className={styles.bar} style={{ transform: `scaleX(${count / max})` }} />
                </span>
                <span className={cn(styles.count, "numeral")}>{count}</span>
              </li>
            );
          })}
        </ol>
        <ul className={styles.extras}>
          <li>
            <span className={cn(styles.extraValue, "numeral")}>{value.archiveWins}</span>
            {labels.archiveWins}
          </li>
          <li>
            <span className={cn(styles.extraValue, "numeral")}>{value.pureWins}</span>
            {labels.pureWins}
          </li>
        </ul>
        {played === 0 && <p className={styles.note}>{labels.statsEmpty}</p>}
        <p className={styles.note}>{labels.statsNote}</p>
      </div>
    </Panel>
  );
}
