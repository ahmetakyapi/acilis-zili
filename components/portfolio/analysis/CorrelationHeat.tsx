"use client";

import { useState, type CSSProperties } from "react";
import { heatOf } from "./analysis-visuals";
import styles from "./Analysis.module.css";

export type HeatCell = { a: string; b: string; value: number; text: string; aria: string };

/**
 * KORELASYON ISI MATRİSİ — en büyük pozisyonların minyatürü (25 Ekim).
 *
 * Liste en çok/en az birlikte hareket eden ÇİFTLERİ sayıyordu; "portföyün
 * ağır kısmı birbirine ne kadar bağlı" sorusu beş satırdan çıkarılıyordu.
 * Matris bunu bir bakışta veriyor: koyu bir blok = birlikte hareket eden
 * bir küme. Yalnız ALT ÜÇGEN basılıyor (üstü aynı sayıların aynası,
 * köşegen hep 1): yarısı kadar hücre, iki kat okunur.
 *
 * Tek ton (yumuşak mavi), yoğunluk mutlak değerden (`heatOf`); eksi kesikli kenarla
 * işaretli — renk yalnız yön ve etkileşim içindir (CLAUDE.md "Renk anlam
 * taşır"). Hücrede sayının kendisi yazılı; hover ya da klavye odağında
 * çiftin adı ve değeri tablonun altındaki okumada. İstemci yalnız bu
 * okuma için: hesap sunucuda, sayılar biçimlenmiş geliyor.
 */
export function CorrelationHeat({
  symbols,
  cells,
  idle,
  caption,
}: {
  symbols: string[];
  /** Alt üçgen, satır satır: i > j. */
  cells: HeatCell[][];
  idle: string;
  caption: string;
}) {
  const [active, setActive] = useState<HeatCell | null>(null);
  const n = symbols.length;
  return (
    <figure className={styles.heat} style={{ "--n": n } as CSSProperties}>
      <div role="table" aria-label={caption} className={styles.heatGrid}>
        {/* Satırlar 1..n-1 (ilk satırın alt üçgeninde hücre yok); sütun
            başlıkları en altta, 0..n-2. */}
        {symbols.slice(1).map((rowSymbol, rowIndex) => (
          <div key={rowSymbol} role="row" className={styles.heatRow}>
            <span role="rowheader" className={styles.heatHead}>
              {rowSymbol}
            </span>
            {cells[rowIndex]!.map((cell) => {
              return (
                <span
                  key={cell.b}
                  role="cell"
                  tabIndex={0}
                  aria-label={cell.aria}
                  className={styles.heatCell}
                  data-negative={cell.value < 0 || undefined}
                  data-active={active === cell || undefined}
                  style={{ "--heat": heatOf(cell.value).toFixed(3) } as CSSProperties}
                  onPointerEnter={() => setActive(cell)}
                  onPointerLeave={() => setActive((current) => (current === cell ? null : current))}
                  onFocus={() => setActive(cell)}
                  onBlur={() => setActive((current) => (current === cell ? null : current))}
                >
                  {cell.text}
                </span>
              );
            })}
          </div>
        ))}
        <div role="row" className={styles.heatRow}>
          <span aria-hidden className={styles.heatHead} />
          {symbols.slice(0, -1).map((symbol) => (
            <span key={symbol} role="columnheader" className={styles.heatFoot}>
              {symbol}
            </span>
          ))}
        </div>
      </div>
      <figcaption className={styles.heatRead} aria-live="polite">
        {active ? (
          <>
            <b className={styles.mono}>
              {active.a} · {active.b}
            </b>
            <span className="numeral">{active.text}</span>
          </>
        ) : (
          <span>{idle}</span>
        )}
      </figcaption>
    </figure>
  );
}
