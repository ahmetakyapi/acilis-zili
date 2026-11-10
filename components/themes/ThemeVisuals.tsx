import { formatPercent } from "@/lib/utils";
import styles from "./Themes.module.css";

/**
 * Tema ekranlarının küçük veri görselleri — hepsi sunucu bileşeni.
 *
 * 10 Kasım 2026: `LogoGroup` (yığın / mozaik / küme) KALKTI. Dizinin galeri
 * kartları panoya, detay kapağının logo kümesi günün okumasına, "diğer
 * temalar" yığını aralıklı logo sırasına döndü; üçü de logoları kendi
 * satırında düz bir sırayla basıyor. `SpreadStrip` (üye çentikleri) da
 * KALKTI: yalnız ana sayfanın temalar bandında yaşıyordu ve sahibinin
 * "nokta nokta ne anlatıyor anlamıyorum" dediği çizimdi; bant artık
 * yükselen/düşen kalın şerit basıyor (components/today/home/
 * MarketTexture.tsx → ExtremeCard). Tema ekranları `ThemeStrip` kullanıyor;
 * `HeatLegend` detay haritasının anahtarı. `SpreadPoint` tipi veri
 * katmanının (lib/theme-board.ts) sözleşmesi olarak duruyor.
 */

export type LogoMember = { symbol: string; logoUrl: string | null };

export type SpreadPoint = { symbol: string; change: number };

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
