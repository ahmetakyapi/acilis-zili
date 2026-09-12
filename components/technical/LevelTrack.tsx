import { Fragment } from "react";
import type { VerdictKey } from "@/lib/analysis";
import type { Dictionary, Locale } from "@/lib/i18n";
import { cn, formatPrice } from "@/lib/utils";
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
 *
 * SAT GÖRÜŞÜNDE HEDEF, HEDEF DEĞİL. Rutin SAT'ta da `targets` yazıyor ama
 * orada anlamı "tepkide satılabilecek direnç" (docs/claude-rutinler.md § 5).
 * Bir dönem AL hedefleriyle aynı yeşil çentik ve "Hedefler" etiketiyle
 * çiziliyordu: SAT kartı okuyucuya yükseliş hedefi gösteriyordu. SAT'ta bu
 * seviyeler düşüş tonuyla ve "Tepkide Satış" adıyla basılıyor.
 */
export function LevelTrack({
  price,
  entryLow,
  entryHigh,
  stop,
  targets,
  supports,
  resistances,
  verdict,
  size = "sm",
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
  verdict: VerdictKey;
  /** `lg` detay kapağında: daha kalın ray, daha büyük fiyat işareti. */
  size?: "sm" | "lg";
  locale: Locale;
  t: Dictionary;
}) {
  const hasEntry = entryLow !== null && entryHigh !== null;
  const sellSide = verdict === "sell";
  /* Alım planı yoksa (SAT ya da bölgesiz TUT) eksen destek ve dirençlerle
     kuruluyor. Koşulda hedef YOK: SAT hedefli geldiğinde de destek ve direnç
     eksende kalmalı, yoksa çizgide fiyat ve satış seviyeleri tek başına
     kalıyordu. */
  const showLevels = !hasEntry && stop === null;
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
  const targetKind = sellSide ? "sellLevel" : "target";

  return (
    <div className="flex flex-col gap-2.5">
      <div className={cn(styles.track, size === "lg" && styles.trackLg)} aria-hidden>
        <span className={styles.trackLine} />
        {hasEntry && (
          <span
            className={styles.trackBand}
            data-motion-draw="line"
            style={{
              left: pos(entryLow),
              width: `max(6px, calc(${pos(entryHigh)} - ${pos(entryLow)}))`,
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
          <span key={`t-${value}`} className={styles.trackTick} data-kind={targetKind} style={{ left: pos(value) }} />
        ))}
        {/* `spark-dot`: ortak sistemin nokta girişi — bant çizildikten sonra
            fiyat yerine oturuyor. Ortalama `margin` ile, `transform` ile değil:
            giriş animasyonu dönüşümü yönetiyor, ikisi çakışınca nokta bitişte
            yarım genişlik sıçrıyordu. */}
        {price !== null && <span className={`${styles.trackPrice} spark-dot`} style={{ left: pos(price) }} />}
      </div>

      <dl className={styles.legend}>
        {stop !== null && (
          <div>
            <dt>
              <i aria-hidden className={styles.legendDot} data-kind="stop" />
              {t.technical.stop}
            </dt>
            <dd>{money(stop)}</dd>
          </div>
        )}
        {hasEntry && (
          <div>
            <dt>
              <i aria-hidden className={styles.legendDot} data-kind="entry" />
              {t.technical.entryZone}
            </dt>
            <dd>{entryLow === entryHigh ? money(entryLow) : `${money(entryLow)} – ${money(entryHigh)}`}</dd>
          </div>
        )}
        {targets.length > 0 && (
          <div>
            <dt>
              <i aria-hidden className={styles.legendDot} data-kind={targetKind} />
              {sellSide ? t.technical.sellLevels : t.technical.targets}
            </dt>
            <dd>
              {targets.map((value, index) => (
                <Fragment key={value}>{index > 0 && " · "}<span>{money(value)}</span></Fragment>
              ))}
            </dd>
          </div>
        )}
        {showLevels && supports[0] !== undefined && (
          <div>
            <dt>
              <i aria-hidden className={styles.legendDot} data-kind="support" />
              {t.technical.support}
            </dt>
            <dd>{money(supports[0])}</dd>
          </div>
        )}
        {showLevels && resistances[0] !== undefined && (
          <div>
            <dt>
              <i aria-hidden className={styles.legendDot} data-kind="resistance" />
              {t.technical.resistance}
            </dt>
            <dd>{money(resistances[0])}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}
