import { MAX_GUESSES } from "@/lib/stock-puzzle";
import { cn } from "@/lib/utils";
import styles from "./GuessDots.module.css";

/**
 * Altı tahmin hakkı, altı nokta (25 Ekim) — oyunda tahminler panelinin
 * başlığında, ana sayfada girişin künyesinde. "{n}/6" sayısı hakkın kaçının
 * yandığını söylüyor ama kaçının KALDIĞINI göstermiyordu; nokta dizisi
 * ikisini aynı anda okutuyor (Wordle'ın boş satırları gibi).
 *
 * Renk anlamdan: kullanılmamış hak içi boş halka (`--line-strong`), yanlış
 * tahmin dolu nötr nokta (`--text-muted`), doğru tahmin mavi
 * (`--primary`: bulmacada mavi yalnız etkileşim ve doğru cevap —
 * StockPuzzle.module.css başı). Yön renkleri (up/down) yok; tahmin bir
 * fiyat hareketi değil.
 *
 * Tek parça bir görsel: ekran okuyucuya yalnız `label` ("2/6 Tahmin");
 * noktalar `aria-hidden`.
 */
export function GuessDots({
  results,
  label,
  className,
}: {
  /** Yapılan tahminler sırayla: doğru mu. */
  results: readonly boolean[];
  label: string;
  className?: string;
}) {
  return (
    <span role="img" aria-label={label} className={cn(styles.dots, className)}>
      {Array.from({ length: MAX_GUESSES }, (_, i) => {
        const result = results[i];
        return (
          <span
            key={i}
            aria-hidden
            data-state={result === undefined ? "open" : result ? "hit" : "miss"}
            className={styles.dot}
          />
        );
      })}
    </span>
  );
}
