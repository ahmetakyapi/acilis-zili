import type { CSSProperties } from "react";
import type { Icon } from "@phosphor-icons/react";
import { Archive, Crown, Fire, GameController, Sparkle, Target } from "@phosphor-icons/react/dist/ssr";
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
 *
 * KÜNYE ŞERİDİ (25 Ekim, doğrulama turu — sahibinin 1440 koyu ekranı):
 * sayılar `flex-wrap` ile akıyordu; etiket genişlikleri farklı olduğu için
 * hiçbir sayı ötekinin hizasında değildi, "Saf Bilgi" ikinci satıra
 * kırılıyordu (TR'de altıncı, EN'de beşinci ve altıncı hücre), dağılım
 * 5 piksellik sütunlarla ve 2 piksel aralıklı rakamlarla okunmuyordu.
 * Şimdi iki satır: üstte başlık ve etiketli dağılım (sütun 10 piksel,
 * rakamlar 18 piksel aralıklı), altta ALTI EŞİT HÜCRE (etiket üstte küçük,
 * sayı altta; hücreler ince çizgiyle ayrılı). Uzun iki etiket kısa adıyla
 * basılıyor (`archiveWinsShort`, `pureWinsShort`), tam ad ekran okuyucuda
 * ve `title`da. Dar kapta (< 420 px, telefon) hücreler 3 × 2.
 *
 * YÜKSEKLİK BÜTÇESİ: 1280×800'de kaybetmede sağ kolonun dibi 756, ilk
 * ekran 763 (StockPuzzle.module.css'teki ölçüm). Şerit 86 pikseldi; yeni
 * hâli 84 (1280/1440/1920, TR/EN, açık/koyu): kaybetmede sağ kolonun dibi
 * 754, kazanma 598, üç yanlış 634, başlangıç 544. Hiçbir etiket kesilmiyor,
 * altı sayı tek hatta (aynı `top`). 390'da 3 × 2, şerit 125 → 126.
 *
 * OYUN MASASI (25 Ekim, üçüncü kurulum — sahibinin isteği: "dağılım
 * gerçek bar grafik, istatistik hücreleri ikonlu"). İki bölge:
 *   - Solda başlık ve altı hücre 3 × 2: simge, sayı, ad tek satırda
 *     ("🎮 10 Oynanan"). Simge hücrenin ne olduğunu ad okunmadan söylüyor;
 *     seri ikiyi bulunca simgesi alev ve pirinç (bitiş kartındaki seri
 *     ateşiyle aynı işaret).
 *   - Sağda gerçek çubuk grafik: altı sütun, 40 piksel boy, sayısı
 *     çubuğun üstünde, tahmin numarası altında. Bugünün sonucu yeşil ve
 *     altı çizili; boş sütun (sıfır) yalnız kulvar.
 * Yükseklik bütçesi aynı ölçüde (1280 kaybetme, StockPuzzle.module.css).
 */
/** Hücrelerin simgeleri. */
const FIGURE_ICONS: Record<string, Icon> = {
  played: GameController,
  rate: Target,
  streak: Fire,
  best: Crown,
  archive: Archive,
  pure: Sparkle,
};

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
    { key: "streak", label: labels.streak, text: String(streak), hot: streak >= 2 },
    { key: "best", label: labels.best, text: String(value.best) },
    { key: "archive", label: labels.archiveWins, short: labels.archiveWinsShort, text: String(value.archiveWins) },
    { key: "pure", label: labels.pureWins, short: labels.pureWinsShort, text: String(value.pureWins) },
  ];

  return (
    <section className={cn(styles.record, className)} aria-labelledby="bulmaca-seri" title={labels.statsNote} data-tahta="seri">
      <h2 id="bulmaca-seri" className={styles.title}>{labels.statsTitle}</h2>
      <dl className={styles.stats}>
        {figures.map((figure) => {
          const Glyph = FIGURE_ICONS[figure.key];
          const short = figure.short && figure.short !== figure.label ? figure.short : null;
          return (
            <div key={figure.key} data-extra={figure.short ? "" : undefined} data-hot={figure.hot ? "" : undefined}>
              <dt title={short ? figure.label : undefined}>
                <Glyph aria-hidden size={14} weight={figure.hot ? "fill" : "bold"} className={styles.glyph} />
                {short ? (
                  <span className={styles.label}>
                    <span aria-hidden>{short}</span>
                    <span className="sr-only">{figure.label}</span>
                  </span>
                ) : (
                  <span className={styles.label}>{figure.label}</span>
                )}
              </dt>
              <dd className="numeral">{figure.text}</dd>
            </div>
          );
        })}
      </dl>
      <figure className={styles.dist}>
        <figcaption className="sr-only">{labels.distribution}</figcaption>
        <ol className={cn(played === 0 && styles.idle)}>
          {Array.from({ length: MAX_GUESSES }, (_, i) => {
            const count = value.distribution[i] ?? 0;
            const isToday = todaySlot === i + 1;
            return (
              <li key={i} data-today={isToday ? "" : undefined} title={`${labels.distribution}: ${i + 1} → ${count}`}>
                <span aria-hidden className={styles.col}>
                  <span className={styles.bar} style={{ "--v": count / max } as CSSProperties}>
                    {count > 0 && <span className={cn(styles.count, "numeral")}>{count}</span>}
                  </span>
                </span>
                <span className={cn(styles.key, "numeral")}>{i + 1}</span>
                <span className="sr-only">{count}{isToday ? `, ${labels.distToday}` : ""}</span>
              </li>
            );
          })}
        </ol>
      </figure>
    </section>
  );
}
