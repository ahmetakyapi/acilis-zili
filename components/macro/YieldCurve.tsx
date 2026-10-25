import type { CSSProperties, ReactNode } from "react";
import type { Dictionary, Locale } from "@/lib/i18n";
import { curveRatio, curveShape, FLAT_CURVE_SPREAD, type CurveShape, type YieldCurve as Curve } from "@/lib/macro-visual";
import { formatEtDateCompact, formatPercentPlain, formatPrice } from "@/lib/utils";
import styles from "./YieldCurve.module.css";

/**
 * Getiri eğrisi minyatürü (25 Ekim görsel turu) — /makro kapağının "Faiz
 * ve Oynaklık" satırı ve ana sayfanın tahvil kartı AYNI bileşenden.
 *
 * Önce dört vade yalın rakamdı (2Y %4,69 … 30Y %5,33): eğrinin kendisi,
 * yani vadeler arasındaki ilişki, okuyucunun kafasında kurulması gereken
 * bir şeydi. Şimdi her vade bir sütun: tepede eğrideki noktası, altında
 * değeri ve günlük değişimi. Bir ay önceki eğri aynı ölçekte kesikli,
 * soluk bir iz; "eğri dikleşti mi, yattı mı" ikinci çizgiden okunuyor.
 *
 * X EKSENİ VADENİN SIRASI, YILI DEĞİL. Doğrusal yıl ölçeğinde 2, 5 ve 10
 * yıllık ilk üçte bire sıkışıyor ve 30 yıllık tek başına sağda kalıyordu;
 * eşit aralık her noktanın altında vadesini yazdığı için yanıltmıyor
 * (piyasa ekranlarının eğri çiziminde de yaygın kalıp).
 *
 * Sunucu bileşeni: hover ve klavye odağı CSS ile (`:hover`,
 * `:focus-visible`); sütun odaklanabilir bir grup ve bir ay önceki okuma
 * sütunun içinde, ekran okuyucuya da açık. Çizgi giriş hareketi
 * `MotionExperience`in `.spark-line` kırpmasıyla bir kez; hareketi
 * azaltana son kare.
 */

export type CurveColumn = {
  key: string;
  /** Vadenin adı ("2 Yıllık"). */
  label: string;
  /** Biçimlenmiş değer (dil kuralı çağıranda: `PercentReading` ya da düz metin). */
  value: ReactNode;
  /** Günlük değişim satırı; yoksa yer tutucu basılır ki sayılar aynı hatta dursun. */
  delta?: ReactNode;
  /** "Bir Ay Önce %4,55" — hover/odak okuması. */
  ghost?: string | null;
  /** "+0,14 Puan" — bir aydaki fark. */
  change?: string | null;
};

const VIEW_STEP = 100;
const VIEW_H = 100;

export function YieldCurve({
  curve,
  columns,
  legend,
  shape,
  shapeLabel,
  shapeNote,
  chartLabel,
  compact = false,
}: {
  curve: Curve;
  /** `curve.points` ile aynı sırada. */
  columns: CurveColumn[];
  legend: { now: string; ghost: string | null };
  shape: CurveShape | null;
  shapeLabel: string | null;
  /** Biçimin neye göre söylendiği; yalnız "düz" gibi yoruma açık durumda basılır. */
  shapeNote?: string | null;
  chartLabel: string;
  compact?: boolean;
}) {
  const n = curve.points.length;
  const width = n * VIEW_STEP;
  const x = (index: number) => (index + 0.5) * VIEW_STEP;
  const y = (value: number) => (1 - curveRatio(value, curve)) * VIEW_H;
  /* Boş nokta çizgiyi böler: olmayan bir vadeden geçen çizgi uydurulmaz. */
  const path = (pick: (index: number) => number | null) => {
    let d = "";
    let open = false;
    for (let index = 0; index < n; index++) {
      const value = pick(index);
      if (value === null) { open = false; continue; }
      d += `${open ? "L" : "M"}${x(index)},${y(value).toFixed(2)}`;
      open = true;
    }
    return d;
  };
  const now = path((index) => curve.points[index].value);
  const ghost = curve.ghostDate ? path((index) => curve.points[index].ghost) : "";
  const pct = (value: number) => `${(1 - curveRatio(value, curve)) * 100}%`;

  return (
    <figure className={styles.curve} data-compact={compact || undefined} style={{ "--n": n } as CSSProperties}>
      <div className={styles.body}>
        <svg className={styles.lines} viewBox={`0 0 ${width} ${VIEW_H}`} preserveAspectRatio="none" role="img" aria-label={chartLabel}>
          {ghost && <path d={ghost} className={styles.ghostLine} vectorEffect="non-scaling-stroke" />}
          <path d={now} className={`spark-line ${styles.nowLine}`} vectorEffect="non-scaling-stroke" />
        </svg>
        {curve.points.map((point, index) => {
          const column = columns[index];
          return (
            /* Odaklanabilir grup: hover'ın klavye karşılığı. Adı vade;
               içerik görünen değer, değişim ve bir ay önceki okuma. */
            <div key={point.key} className={styles.column} role="group" aria-label={column.label} tabIndex={0}>
              <span className={styles.plot} aria-hidden>
                {point.ghost !== null && <i className={styles.ghostDot} style={{ top: pct(point.ghost) }} />}
                {point.value !== null && <i className={`spark-dot ${styles.dot}`} style={{ top: pct(point.value) }} />}
                {column.ghost && (
                  <span
                    className={`${styles.tip} numeral`}
                    data-low={point.value !== null && curveRatio(point.value, curve) > 0.55 ? "" : undefined}
                    data-edge={index === 0 ? "start" : index === n - 1 ? "end" : undefined}
                  >
                    {column.ghost}
                    {column.change && <small>{column.change}</small>}
                  </span>
                )}
              </span>
              <span className={styles.label}>{column.label}</span>
              <span className={`${styles.value} numeral`}>{column.value}</span>
              <span className={`${styles.delta} numeral`}>{column.delta ?? <span aria-hidden>{" "}</span>}</span>
              {column.ghost && <span className="sr-only">{column.ghost}{column.change ? `, ${column.change}` : ""}</span>}
            </div>
          );
        })}
      </div>
      <figcaption className={styles.caption}>
        <span className={styles.key}><i data-line="now" aria-hidden />{legend.now}</span>
        {legend.ghost && <span className={styles.key}><i data-line="ghost" aria-hidden />{legend.ghost}</span>}
        {shape && shapeLabel && <span className={styles.shape} data-shape={shape}>{shapeLabel}</span>}
        {shape === "flat" && shapeNote && <span className={styles.note}>{shapeNote}</span>}
      </figcaption>
    </figure>
  );
}

/** Eğrinin biçimini veren iki vade: 2 ve 10 yıllık (sitenin her yerinde "10 − 2"). */
export const CURVE_SHORT_KEY = "yield-2y";
export const CURVE_LONG_KEY = "yield-10y";

/**
 * Minyatürün künyeleri — iki çağıran (MarketPulse, YieldCard) aynı
 * metinleri aynı kuraldan bassın diye tek yerde. Sayı biçimi sitenin
 * yüzde kuralı (`formatPercentPlain`, işaret dile göre).
 */
export function curveCaption(curve: Curve, labels: string[], locale: Locale, t: Dictionary) {
  const v = t.macroVisual;
  const short = curve.points.find((point) => point.key === CURVE_SHORT_KEY)?.value ?? null;
  const long = curve.points.find((point) => point.key === CURVE_LONG_KEY)?.value ?? null;
  const spread = short !== null && long !== null ? long - short : null;
  const shape = spread === null ? null : curveShape(spread);
  const shapeLabel = shape === "inverted" ? v.shapeInverted : shape === "flat" ? v.shapeFlat : shape === "normal" ? v.shapeNormal : null;
  const pctText = (value: number) => formatPercentPlain(value, locale, 2);
  const list = (pick: (point: Curve["points"][number]) => number | null) =>
    curve.points.map((point, index) => {
      const value = pick(point);
      return value === null ? null : `${labels[index]} ${pctText(value)}`;
    }).filter(Boolean).join(", ");
  const date = formatEtDateCompact(curve.date, locale);
  const ghostDate = curve.ghostDate ? formatEtDateCompact(curve.ghostDate, locale) : null;
  return {
    spread,
    shape,
    shapeLabel,
    shapeNote: v.shapeNote.replace("{threshold}", formatPrice(FLAT_CURVE_SPREAD, locale, { digits: 2 })),
    legend: { now: v.legendNow.replace("{date}", date), ghost: ghostDate ? v.legendGhost.replace("{date}", ghostDate) : null },
    chartLabel: [
      v.chartLabel.replace("{date}", date).replace("{values}", list((point) => point.value)),
      ghostDate ? v.chartLabelGhost.replace("{date}", ghostDate).replace("{values}", list((point) => point.ghost)) : null,
    ].filter(Boolean).join(". "),
    /** Sütunun bir ay önceki okuması ve aradaki fark. */
    ghostOf(index: number) {
      const point = curve.points[index];
      if (point.ghost === null) return { ghost: null, change: null };
      const change = point.value === null ? null : point.value - point.ghost;
      return {
        ghost: v.pointGhost.replace("{value}", pctText(point.ghost)),
        change: change === null ? null : v.pointChange.replace("{delta}", `${change > 0 ? "+" : change < 0 ? "−" : ""}${formatPrice(Math.abs(change), locale, { digits: 2 })}`),
      };
    },
  };
}
