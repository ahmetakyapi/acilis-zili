import { spreadPosition } from "@/lib/theme-view";
import { formatPercent } from "@/lib/utils";
import styles from "./Themes.module.css";

/**
 * Tema ekranlarının küçük veri görselleri — hepsi sunucu bileşeni.
 *
 * Hareket istemci JS'i istemiyor: şerit çentikleri `data-motion-draw`
 * kancasıyla `MotionExperience`e bırakılıyor.
 *
 * 10 Kasım 2026: `LogoGroup` (yığın / mozaik / küme) KALKTI. Dizinin galeri
 * kartları panoya, detay kapağının logo kümesi günün okumasına, "diğer
 * temalar" yığını aralıklı logo sırasına döndü; üçü de logoları kendi
 * satırında düz bir sırayla basıyor. `SpreadStrip` ana sayfanın temalar
 * bandında yaşıyor (tema ekranları `ThemeStrip` kullanıyor); `HeatLegend`
 * detay haritasının anahtarı.
 */

export type LogoMember = { symbol: string; logoUrl: string | null };

export type SpreadPoint = { symbol: string; change: number };

/**
 * Dağılım şeridi — temanın her üyesi, günlük hareketi kadar sağda ya da
 * solda bir çentik; kalın çentik medyan.
 *
 * Medyan tek sayı olarak "tema bugün ne yaptı" diyor ama yayılımı
 * söylemiyor: %0,3'lük bir medyanın altında on altı üyenin hepsi sıfıra
 * yakın da olabilir, yarısı +%4 yarısı −%4 de. Şerit ikisini ayırıyor.
 *
 * Yön rengi son kapanışta DA işaretten (15 Ekim, sahibinin isteği —
 * önceki kural "yeşil/kırmızı 'bugün' der" diye nötrlüyordu ve açılış
 * öncesi bütün panel gri kalıyordu). Dönemi kartın künyesi söylüyor;
 * yalnız `basis` yokken (yedek, sayı da yok) nötr.
 *
 * ÖLÇEK DIŞI ÇENTİK UÇTA, KÜNYE "≤ / ≥" (28 Eylül denetimi). Ortak ölçek
 * yüzde 90'lık dilimden (`spreadScale`), yani her gün bazı üyeler tavanı
 * aşıyor ve şeridin ucuna yapışıyor. Uçtaki etiket "−%5" dediği için
 * −%22,5'lik MDB çentiği −%5'te duruyormuş gibi okunuyordu. O yakada
 * kırpılan bir çentik varsa etiket "≤ −%5" / "≥ %5" oluyor — ısı
 * lejantının (`HeatLegend`) aynı yazımı.
 *
 * Çentik girişi `travel`: sıfırdan kalkıp kendi yerine kayıyor. `data-delta`
 * yüzde puan, `cqw` şeridin kendi genişliği (şerit `container-type`).
 */
export function SpreadStrip({
  points,
  median,
  basis,
  scale,
  label,
  locale,
}: {
  points: readonly SpreadPoint[];
  median: number | null;
  basis: "session" | "lastClose" | null;
  /** Ortak ölçek; yedekte bilinmiyor ve künye boş basılıyor. */
  scale: number | null;
  label: string;
  locale: string;
}) {
  /* Renk son kapanışta da işaretten (15 Ekim, sahibinin isteği) — dönemi
     kartın künyesi söylüyor; yalnız `basis` yokken (yedek) nötr. */
  const neutral = basis == null;
  const clippedLow = scale !== null && points.some((point) => point.change < -scale);
  const clippedHigh = scale !== null && points.some((point) => point.change > scale);
  return (
    <div className={styles.spreadWrap}>
      <div className={styles.spread} role="img" aria-label={label}>
        <span className={styles.spreadZero} aria-hidden />
        {scale !== null && points.map((point) => {
          const position = spreadPosition(point.change, scale);
          return (
            <i
              key={point.symbol}
              aria-hidden
              className={styles.tick}
              data-tone={neutral ? "flat" : point.change > 0 ? "up" : point.change < 0 ? "down" : "flat"}
              data-motion-draw="travel"
              data-delta={(50 - position).toFixed(2)}
              style={{ left: `${position}%` }}
            />
          );
        })}
        {scale !== null && median !== null && (
          <i
            aria-hidden
            className={styles.tickMedian}
            data-motion-draw="travel"
            data-delta={(50 - spreadPosition(median, scale)).toFixed(2)}
            style={{ left: `${spreadPosition(median, scale)}%` }}
          />
        )}
      </div>
      <div className={styles.spreadScale} aria-hidden>
        {/* Yedekte künye boş ama satır yerinde: sayılar inince şerit
            aşağı itilmesin. */}
        <span>{scale === null ? "\u00a0" : `${clippedLow ? "≤ " : ""}${formatPercent(-scale, locale, 0)}`}</span>
        <span>{scale === null ? "\u00a0" : "0"}</span>
        <span>{scale === null ? "\u00a0" : `${clippedHigh ? "≥ " : ""}${formatPercent(scale, locale, 0)}`}</span>
      </div>
    </div>
  );
}

/**
 * Isı ölçeğinin anahtarı — `/piyasalar` ısı haritasıyla aynı dokuz kademe.
 */
export function HeatLegend({ locale, label }: { locale: string; label: string }) {
  const levels = [-4, -3, -2, -1, 0, 1, 2, 3, 4] as const;
  return (
    <div className={styles.legend} role="img" aria-label={label}>
      <div className={styles.legendSwatches} aria-hidden>
        {levels.map((level) => (
          <i
            key={level}
            className={styles.heat}
            data-heat-tone={level < 0 ? "down" : level > 0 ? "up" : "flat"}
            data-heat-level={Math.abs(level)}
          />
        ))}
      </div>
      <div className={styles.legendLabels} aria-hidden>
        <span>≤ {formatPercent(-3, locale, 0)}</span>
        <span>0</span>
        <span>≥ {formatPercent(3, locale, 0)}</span>
      </div>
    </div>
  );
}
