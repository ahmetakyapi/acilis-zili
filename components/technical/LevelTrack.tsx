import type { Dictionary, Locale } from "@/lib/i18n";
import { formatPrice } from "@/lib/utils";
import styles from "./Technical.module.css";

/**
 * Seviye çizgisi — stop, alım bölgesi, hedefler ve fiyat tek eksende.
 *
 * ÖLÇEK SEVİYELERE GÖRE, SIFIRA GÖRE DEĞİL. Eksen en düşük ile en yüksek
 * seviye arasında; %6 pay ile uçlar kenara yapışmıyor. Sıfırdan çizilen
 * bir eksende 212 ile 216 arasındaki alım bölgesi tek bir çizgiye inerdi.
 *
 * Çizim yalnızca görsel (`aria-hidden`); aynı bilgi altındaki lejantta
 * metin olarak duruyor, ekran okuyucu onu okur.
 */
export function LevelTrack({
  price,
  entryLow,
  entryHigh,
  stop,
  targets,
  supports,
  resistances,
  locale,
  t,
}: {
  price: number | null;
  entryLow: number | null;
  entryHigh: number | null;
  stop: number | null;
  targets: readonly number[];
  supports: readonly number[];
  resistances: readonly number[];
  locale: Locale;
  t: Dictionary;
}) {
  const hasEntry = entryLow !== null && entryHigh !== null;
  /* SAT görüşünde alım bölgesi ve stop yok; eksen o zaman destek ve
     dirençlerle kuruluyor, yoksa çizgide yalnızca fiyat kalırdı. */
  const showLevels = !hasEntry && stop === null && targets.length === 0;
  const points = [
    price,
    entryLow,
    entryHigh,
    stop,
    ...targets,
    ...(showLevels ? [...supports, ...resistances] : []),
  ].filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (points.length < 2) return null;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const pad = (max - min) * 0.06 || max * 0.02;
  const lo = min - pad;
  const hi = max + pad;
  const pos = (value: number) => `${((value - lo) / (hi - lo)) * 100}%`;
  const money = (value: number) => formatPrice(value, locale, { currency: true });

  return (
    <div className="flex flex-col gap-2">
      <div className={styles.track} aria-hidden>
        <span className={styles.trackLine} />
        {hasEntry && (
          <span
            className={styles.trackBand}
            style={{
              left: pos(entryLow),
              width: `max(4px, calc(${pos(entryHigh)} - ${pos(entryLow)}))`,
            }}
          />
        )}
        {showLevels &&
          [...supports.map((v) => ["support", v] as const), ...resistances.map((v) => ["resistance", v] as const)].map(
            ([kind, value]) => (
              <span key={`${kind}-${value}`} className={styles.trackTick} data-kind={kind} style={{ left: pos(value) }} />
            ),
          )}
        {stop !== null && (
          <span className={styles.trackTick} data-kind="stop" style={{ left: pos(stop) }} />
        )}
        {targets.map((value) => (
          <span key={`t-${value}`} className={styles.trackTick} data-kind="target" style={{ left: pos(value) }} />
        ))}
        {price !== null && <span className={styles.trackPrice} style={{ left: pos(price) }} />}
      </div>

      <p className={styles.legend}>
        {stop !== null && (
          <span>
            <i aria-hidden className={styles.legendDot} style={{ background: "var(--down)" }} />
            {t.technical.stop} <b>{money(stop)}</b>
          </span>
        )}
        {hasEntry && (
          <span>
            <i aria-hidden className={styles.legendDot} style={{ background: "var(--up-wash)", boxShadow: "inset 0 0 0 1px var(--up)" }} />
            {t.technical.entryZone}{" "}
            <b>{entryLow === entryHigh ? money(entryLow) : `${money(entryLow)} – ${money(entryHigh)}`}</b>
          </span>
        )}
        {targets.length > 0 && (
          <span>
            <i aria-hidden className={styles.legendDot} style={{ background: "var(--up)" }} />
            {t.technical.targets}{" "}
            <b>{targets.map(money).join(" · ")}</b>
          </span>
        )}
        {showLevels && supports[0] !== undefined && (
          <span>
            {t.technical.support} <b>{money(supports[0])}</b>
          </span>
        )}
        {showLevels && resistances[0] !== undefined && (
          <span>
            {t.technical.resistance} <b>{money(resistances[0])}</b>
          </span>
        )}
      </p>
    </div>
  );
}
