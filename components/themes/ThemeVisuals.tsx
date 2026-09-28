import type { CSSProperties } from "react";
import { LogoTile, Skeleton, type LogoTileSize } from "@/components/ui/primitives";
import { spreadPosition } from "@/lib/theme-view";
import { cn, formatPercent } from "@/lib/utils";
import styles from "./Themes.module.css";

/**
 * Tema ekranlarının küçük veri görselleri — hepsi sunucu bileşeni.
 *
 * Hareket istemci JS'i istemiyor: şerit çentikleri `data-motion-draw`
 * kancasıyla `MotionExperience`e, logo girişleri CSS'e bırakılıyor.
 */

export type LogoMember = { symbol: string; logoUrl: string | null };

/**
 * Logo yığını ya da mozaiği. Yığın dar kartta, mozaik geniş kartta: aynı
 * bilgi, kartın genişliğine göre iki ayrı ritim (dizinde kartlar tek tip
 * görünmesin diye).
 *
 * `placeholder`: üyeleri henüz bilinmeyen liste (Katılım, akış sürerken).
 * Aynı sayıda boş karo basılıyor ki üyeler gelince hiçbir şey kaymasın.
 */
export function LogoGroup({
  members,
  max,
  variant,
  size = "md",
  placeholder = 0,
  className,
}: {
  members: readonly LogoMember[];
  max: number;
  variant: "stack" | "mosaic" | "cluster";
  size?: LogoTileSize;
  placeholder?: number;
  className?: string;
}) {
  const shown = members.slice(0, max);
  const rest = members.length - shown.length;
  const variantClass =
    variant === "stack" ? styles.stack : variant === "mosaic" ? styles.mosaic : styles.cluster;

  return (
    <span aria-hidden className={cn(variantClass, className)} data-size={size}>
      {members.length === 0
        ? Array.from({ length: placeholder }, (_, i) => (
            <span key={i} className={styles.logoSlot} style={{ "--i": i } as CSSProperties}>
              <Skeleton className={styles.logoSkeleton} />
            </span>
          ))
        : shown.map((member, i) => (
            <span key={member.symbol} className={styles.logoSlot} style={{ "--i": i } as CSSProperties}>
              <LogoTile symbol={member.symbol} logoUrl={member.logoUrl} size={size} />
            </span>
          ))}
      {rest > 0 && (
        <span className={cn(styles.logoSlot, styles.logoRest)} style={{ "--i": shown.length } as CSSProperties}>
          +{rest}
        </span>
      )}
    </span>
  );
}

export type SpreadPoint = { symbol: string; change: number };

/**
 * Dağılım şeridi — temanın her üyesi, günlük hareketi kadar sağda ya da
 * solda bir çentik; kalın çentik medyan.
 *
 * Medyan tek sayı olarak "tema bugün ne yaptı" diyor ama yayılımı
 * söylemiyor: %0,3'lük bir medyanın altında on altı üyenin hepsi sıfıra
 * yakın da olabilir, yarısı +%4 yarısı −%4 de. Şerit ikisini ayırıyor.
 *
 * Yön rengi yalnızca bu seansın yüzdelerinde (`basis === "session"`).
 * Son kapanışa ait şeritte çentikler nötr: yeşil ve kırmızı "bugün" der.
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
  const neutral = basis !== "session";
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
        <span>{scale === null ? "\u00a0" : formatPercent(-scale, locale, 0)}</span>
        <span>{scale === null ? "\u00a0" : "0"}</span>
        <span>{scale === null ? "\u00a0" : formatPercent(scale, locale, 0)}</span>
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
