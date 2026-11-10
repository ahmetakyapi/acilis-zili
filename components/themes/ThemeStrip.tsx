import type { CSSProperties } from "react";
import { spreadPosition } from "@/lib/theme-view";
import { cn } from "@/lib/utils";
import styles from "./ThemeStrip.module.css";

/**
 * Temanın dağılım şeridi — dizin panosunun satırında ve detay kapağında
 * AYNI çizim (10 Kasım 2026).
 *
 * Her üye, günlük hareketi kadar sağda ya da solda bir çentik; dolu düğme
 * temanın medyanı, içi boş kare im ölçüt fonu. Medyan tek sayı olarak "tema
 * bugün ne yaptı" diyor ama yayılımı söylemiyor: %0,3'lük bir medyanın
 * altında on altı üyenin hepsi sıfıra yakın da olabilir, yarısı +%4 yarısı
 * −%4 de (gerekçe `SpreadStrip`, ThemeVisuals.tsx — ana sayfa bandı hâlâ
 * onu kullanıyor; bu bileşen onun pano dilindeki kardeşi).
 *
 * Farklar: ölçek etiketi şeridin DIŞINDA (panoda başlıkta bir kez, kapakta
 * altında); çentikler tek katmanda ve tek animasyonla sıfırdan iki yana
 * açılıyor (`clip-path`), medyan ve ölçüt imi sıfırdan yerine kayıyor
 * (`translate`, `cqw`). Çentik başına animasyon yok: yirmi üyeli temada
 * yirmi yerine üç animasyon. Ölçek dışı üye uca yapışır (`spreadPosition`);
 * "≤ / ≥" yazımını etiketi basan çağıran koyar.
 *
 * Renk son kapanışta da işaretten (15 Ekim, sahibinin isteği); dönemi
 * çağıranın künyesi söylüyor.
 */
export type StripPoint = { symbol: string; change: number };

export function ThemeStrip({
  points,
  median,
  bench,
  scale,
  label,
  className,
}: {
  points: readonly StripPoint[];
  median: number | null;
  /** Ölçüt fonunun yüzdesi; yalnız temayla aynı seansı anlatıyorsa verilir. */
  bench?: number;
  /** Yoksa (yedek, ölçek dışı tema) yalnız kulvar basılır. */
  scale: number | null;
  label: string;
  className?: string;
}) {
  const at = (value: number) => spreadPosition(value, scale ?? 1);
  return (
    <span className={cn(styles.strip, className)} role="img" aria-label={label}>
      <span className={styles.lane} aria-hidden />
      {scale !== null && (
        <>
          <span className={styles.ticks} aria-hidden>
            {points.map((point) => (
              <i
                key={point.symbol}
                data-tone={point.change > 0 ? "up" : point.change < 0 ? "down" : "flat"}
                style={{ left: `${at(point.change).toFixed(2)}%` }}
              />
            ))}
          </span>
          {bench !== undefined && (
            <i
              className={styles.bench}
              aria-hidden
              style={{ left: `${at(bench).toFixed(2)}%`, "--d": (50 - at(bench)).toFixed(2) } as CSSProperties}
            />
          )}
          {median !== null && (
            <i
              className={styles.knob}
              aria-hidden
              style={{ left: `${at(median).toFixed(2)}%`, "--d": (50 - at(median)).toFixed(2) } as CSSProperties}
            />
          )}
        </>
      )}
    </span>
  );
}
