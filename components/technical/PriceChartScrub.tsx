"use client";

import { useState, type PointerEvent } from "react";
import { formatEtDateMedium, formatPrice } from "@/lib/utils";
import styles from "./PriceChart.module.css";

/**
 * Grafiğin tek istemci adası: üzerine gelince ya da dokununca o seansın
 * tarihi ve kapanışı. Çizim sunucuda; bu katman yalnız OKUR (dikey kıl
 * çizgi, nokta, sol üstte tek satır). İmleç çıkınca ve parmak kalkınca
 * okuma temizlenir (`kucuk-ama-kritik.md` → dokunmatik okuma). Hareket yok:
 * okuma bir geri bildirim, çizim değil.
 *
 * `touch-action: pan-y` (CSS): yatay sürükleme okur, dikey kaydırma sayfada
 * kalır; telefonda grafik kaydırmayı yutmuyor.
 */
export function PriceChartScrub({
  dates,
  closes,
  min,
  max,
  locale,
}: {
  dates: readonly string[];
  closes: readonly number[];
  min: number;
  max: number;
  locale: string;
}) {
  const [at, setAt] = useState<number | null>(null);
  const read = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    if (box.width <= 0) return;
    const ratio = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
    setAt(Math.round(ratio * (closes.length - 1)));
  };
  const clear = () => setAt(null);
  const x = at === null ? 0 : (at / (closes.length - 1)) * 100;
  const y = at === null ? 0 : (1 - (closes[at]! - min) / (max - min || 1)) * 100;
  return (
    <div className={styles.scrub} onPointerMove={read} onPointerDown={read} onPointerLeave={clear} onPointerUp={(event) => event.pointerType !== "mouse" && clear()} onPointerCancel={clear}>
      {at !== null && (
        <>
          <span className={styles.scrubLine} style={{ left: `${x}%` }} />
          <span className={styles.scrubDot} style={{ left: `${x}%`, top: `${y}%` }} />
          <span className={styles.scrubRead} data-side={x > 55 ? "start" : "end"}>
            {formatEtDateMedium(dates[at]!, locale)}
            <b className="numeral">{formatPrice(closes[at]!, locale, { currency: true })}</b>
          </span>
        </>
      )}
    </div>
  );
}
