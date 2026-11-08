import type { CSSProperties } from "react";
import { type Locale } from "@/lib/i18n";
import { cn, directionOf, formatPercent } from "@/lib/utils";
import styles from "./HomeLanes.module.css";

/**
 * Ana sayfanın yan kolon şeridi — Dünya Piyasaları ve Günün Hareketleri
 * (8 Kasım görsel tur; ölçüm ve kararlar HomeLanes.module.css başında).
 *
 * NEDEN `MiniLane` DEĞİL. Bülten bandının şeridi (PosterLanes) ucunda bir
 * işaret taşımıyor ve iki kart daha onu kullanıyor; buraya gereken UÇ NOKTASI
 * (değerin bittiği yer, lolipop) o bileşeni değiştirmeyi gerektiriyordu.
 * Dil aynı: `--line-soft` kulvar, ortada `--line-strong` sıfır, 5 piksel,
 * renk yalnız işaretten. Ölçek panel başına TEK (`sharedLaneScale`).
 *
 * `muted`: yüzde bu seansın değil son kapanışın (veri dürüstlüğü 4) —
 * boy doğru, renk `--flat`.
 */
export function HomeLane({
  change,
  scale,
  index = 0,
  muted = false,
}: {
  change: number;
  scale: number;
  /** Giriş sırası (gecikme). */
  index?: number;
  muted?: boolean;
}) {
  const dir = directionOf(change);
  const len = scale > 0 ? (Math.min(Math.abs(change), scale) / scale) * 50 : 0;
  return (
    <span
      aria-hidden
      data-lane=""
      data-dir={dir}
      data-muted={muted || undefined}
      className={styles.track}
      style={{ "--len": `${len}%`, "--i": index } as CSSProperties}
    >
      {dir !== "flat" && (
        <>
          <span className={styles.fill} />
          <span className={styles.dot} />
        </>
      )}
    </span>
  );
}

/**
 * Ölçeğin EKSENİ — "Ortak Ölçek ±%4,1" künyesinin yerine (8 Kasım).
 * Künye başlığın sağında bir sayıydı; okur onu şeritlere kendisi taşımak
 * zorundaydı. Eksen şeritlerle aynı ızgara sütununda, aynı sol ve sağ
 * hatta: uçlar −/+ ölçek, ortada 0 ve sıfır çizgisine inen kısa çentik.
 * Görsel bir kopya; ekran okuyucuya tek cümle (`label`).
 */
export function LaneAxis({
  scale,
  locale,
  label,
  className,
}: {
  scale: number;
  locale: Locale;
  label: string;
  className?: string;
}) {
  return (
    <div role="img" aria-label={label} className={cn(styles.row, styles.axisRow, className)}>
      <span aria-hidden className={styles.axis}>
        <span className={styles.axisMin}>{formatPercent(-scale, locale, 1)}</span>
        <span className={styles.axisZero}>0</span>
        <span className={styles.axisMax}>{formatPercent(scale, locale, 1)}</span>
      </span>
    </div>
  );
}
