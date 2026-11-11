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
 *
 * HAK ŞERİDİ (11 Kasım görsel turu, dev-starter `snippets/ui/meter`in
 * bölmeli kipinden uyarlama: lucide/motion yok, yalnız CSS). Altı 8
 * piksellik halka künyede okunmuyordu; sahibinin çizim kuralı da
 * "büyüklük kalın yatay şeritle" (`.claude/rules/arayuz.md`). Şimdi altı
 * bölmeli tek şerit (bölme 12 × 6 piksel, 3 piksel aralık): kullanılmamış
 * hak kulvar (`--line`; `--line-soft` açık temada panelde kayboluyordu), yanlış dolu nötr, doğru `--up`. Doğru tahmin
 * artık mavi değil yeşil: yeşil sitede "bildin" (skor, tutan karolar,
 * kazanılan siluet), mavi yalnız etkileşim. Bileşenin adı ve API'si aynı
 * (oyun ve ana sayfa kartı aynı şeridi basar). Bölme durum DEĞİŞİNCE bir
 * kez soldan dolar (`scaleX` geçişi, `--mark`); ilk boyamada geçiş yok.
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
