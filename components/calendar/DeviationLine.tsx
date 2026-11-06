import type { CSSProperties } from "react";
import type { Deviation } from "@/lib/release-deviation";
import { cn } from "@/lib/utils";
import styles from "./ReleasedData.module.css";

/**
 * Sapma çizgisi. Ray `container-type: inline-size`: noktanın kayması
 * (`travel`) rayın kendi genişliğiyle, `cqw` cinsinden. Yüzde konum:
 * orta = %50, uçlar ±`DEVIATION_REACH`.
 *
 * ORTAK BİLEŞEN (6 Kasım). "Son Açıklanan Veriler" kartının yerel
 * fonksiyonuydu; ana sayfanın "Bugünün Akışı" açılan satırı da aynı üç
 * değeri bu çizgiyle okutuyor (CLAUDE.md "karşılaştırılan büyüklük bir de
 * ÇİZGİ olarak okunur"). Biçim tek yerde: ReleasedData.module.css.
 *
 * `motion`: takvim kartında PremiumMotion çizgiyi görünüme girince çizer
 * (`data-motion-*`). Akışta gövde katlı başlıyor ve görünürlük gözlemcisi
 * katlı kutuyu "görünür" sanıp hareketi harcardı; orada `false` verilir ve
 * nokta kendi CSS animasyonuyla, satır her açıldığında kayar
 * (`--travel`, DayFlow.module.css → "SAPMA ÇİZGİSİ").
 */
export function DeviationLine({
  deviation,
  below,
  above,
  baseLabel,
  motion = true,
  className,
}: {
  deviation: Pick<Deviation, "direction" | "actualAt" | "previousAt">;
  below: string;
  above: string;
  baseLabel: string;
  motion?: boolean;
  className?: string;
}) {
  const HALF = 50;
  const pos = (at: number) => HALF + at * HALF;
  const actual = pos(deviation.actualAt);
  const moves = deviation.actualAt !== 0;
  return (
    <div className={cn(styles.line, className)} aria-hidden data-dir={deviation.direction} data-motion-track={motion || undefined}>
      <div className={styles.rail}>
        <span className={styles.axis} />
        {/* Beklentiden gerçekleşene uzanan bacak: sıfırdan açılıyor. */}
        {moves && (
          <span
            className={styles.leg}
            data-motion-draw={motion ? "line" : undefined}
            data-leg
            style={{
              left: `${Math.min(HALF, actual)}%`,
              width: `${Math.abs(actual - HALF)}%`,
              transformOrigin: actual > HALF ? "left center" : "right center",
            }}
          />
        )}
        <span className={styles.zero} />
        {deviation.previousAt !== null && (
          <span className={styles.previous} style={{ left: `${pos(deviation.previousAt)}%` }} />
        )}
        <span
          className={styles.dot}
          style={{ left: `${actual}%`, "--travel": `${(HALF - actual).toFixed(2)}cqw` } as CSSProperties}
          data-motion-draw={motion && moves ? "travel" : undefined}
          data-delta={motion && moves ? (HALF - actual).toFixed(2) : undefined}
          data-dot
        />
      </div>
      <div className={styles.ends}>
        <span>{below}</span>
        <span className={styles.endsZero}>{baseLabel}</span>
        <span>{above}</span>
      </div>
    </div>
  );
}
