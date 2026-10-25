import { cn, formatPercent, formatPrice } from "@/lib/utils";
import { pctFromStart, type SilhouetteRange } from "@/lib/stock-puzzle";
import type { Locale } from "@/lib/i18n/config";
import type { StockPuzzleLabels } from "@/lib/i18n/dictionaries/stock-puzzle";
import styles from "./PuzzleChart.module.css";

/**
 * Bulmacanın siluet grafiği (25 Ekim) — oyunun ana görseli ve kapak
 * kartının yeniden çizimi aynı bileşen, üç eksen kipiyle:
 *
 *   "shape" — başta: eksensiz şekil, yalnız zaman künyesi.
 *   "pct"   — üç yanlıştan sonra: üst ve alt çizgi BAŞLANGICA GÖRE yüzde,
 *             başlangıç seviyesi kesik çizgi (`axisFor`, `pctFromStart`).
 *   "price" — bitmiş bulmacada: dip/zirve fiyatı ve gerçek tarihler.
 *
 * ÇİZİM DİLİ: mürekkep çizgi (`--text-strong`, veri çizimi mavi değil),
 * altında markanın mavi ailesinin yumuşak tonunda alan (renk kararı:
 * nötr veri çizimi yumuşak mavi olabilir, doygun mavi olmaz), ince ızgara.
 * Kutu yok; panelin kendi zemini. Degrade yok (veri paneli).
 *
 * GİRİŞ: çizgi bir kez soldan sağa çizilir (kırpma, 1,2 sn
 * `--ease-brand`; gerekçe CSS'te), alan ardından belirir, uç nokta
 * en son oturur. Hareketi azaltana son kare (kurallar yalnız
 * `no-preference` içinde). Sunucuda da çizilebilir: durum yok.
 */

export type ChartAxis =
  | { kind: "shape" }
  | { kind: "pct"; spreadPct: number }
  | { kind: "price"; range: SilhouetteRange };

/** Çizgi kutunun üst ve altına değmesin — yüzde (viewBox 0-100). */
const PAD = 8;
const yOf = (value: number) => PAD + (1 - value) * (100 - PAD * 2);

const dateText = (day: string, locale: Locale) =>
  new Intl.DateTimeFormat(locale === "en" ? "en-US" : "tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${day}T12:00:00Z`));

export function PuzzleChart({
  points,
  axis,
  labels,
  locale,
  label,
  className,
}: {
  points: number[];
  axis: ChartAxis;
  labels: StockPuzzleLabels;
  locale: Locale;
  /** Ekran okuyucu için tek cümle. */
  label: string;
  className?: string;
}) {
  const coords = points.map((value, i) => [(i / (points.length - 1)) * 100, yOf(value)] as const);
  const line = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  const area = `${line} L100,100 L0,100 Z`;
  const first = points[0];
  const last = points[points.length - 1];
  const gutter = axis.kind !== "shape";

  /* Yüzde kipinde üst/alt çizginin ve son noktanın başlangıca göre
     yüzdesi; fiyat kipinde gerçek fiyat (son kapanış ölçüden, noktadan
     türetilmiyor — nokta üç haneye yuvarlı). */
  let top = "";
  let bottom = "";
  let figures: { key: string; label: string; value: string; tone?: "up" | "down" }[] = [];
  if (axis.kind === "pct") {
    const pct = (value: number) => formatPercent(pctFromStart(value, first, axis.spreadPct), locale, 0);
    top = pct(1);
    bottom = pct(0);
    const change = pctFromStart(last, first, axis.spreadPct);
    figures = [
      { key: "end", label: labels.axisEnd, value: formatPercent(change, locale, 0), tone: change >= 0 ? "up" : "down" },
      { key: "high", label: labels.chartHigh, value: top },
      { key: "low", label: labels.chartLow, value: bottom },
    ];
  } else if (axis.kind === "price") {
    const price = (value: number) => formatPrice(value, locale, { currency: true });
    top = price(axis.range.high);
    bottom = price(axis.range.low);
    figures = [
      { key: "end", label: labels.axisEnd, value: price(axis.range.last) },
      { key: "high", label: labels.chartHigh, value: top },
      { key: "low", label: labels.chartLow, value: bottom },
    ];
  }

  const ticks =
    axis.kind === "price"
      ? [dateText(axis.range.from, locale), dateText(axis.range.to, locale)]
      : [labels.axisStart, labels.axisMid, labels.axisEnd];

  return (
    <figure className={cn(styles.chart, className)} data-bulmaca="siluet">
      <div className={cn(styles.frame, gutter && styles.withGutter)}>
        {gutter && (
          <div aria-hidden className={styles.gutter}>
            <span className="numeral" style={{ top: `${yOf(1)}%` }}>{top}</span>
            <span className="numeral" style={{ top: `${yOf(0)}%` }}>{bottom}</span>
          </div>
        )}
        <div className={styles.plot}>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={label} className={styles.svg}>
            {[1, 0.5, 0].map((value) => (
              <line key={value} x1="0" x2="100" y1={yOf(value)} y2={yOf(value)} className={styles.grid} vectorEffect="non-scaling-stroke" />
            ))}
            {[25, 50, 75].map((x) => (
              <line key={x} x1={x} x2={x} y1="0" y2="100" className={styles.gridV} vectorEffect="non-scaling-stroke" />
            ))}
            {axis.kind === "pct" && (
              <line x1="0" x2="100" y1={yOf(first)} y2={yOf(first)} className={styles.start} vectorEffect="non-scaling-stroke" />
            )}
            <path d={area} className={styles.area} />
            <path d={line} className={styles.line} vectorEffect="non-scaling-stroke" />
          </svg>
          {/* Uç nokta HTML: `preserveAspectRatio="none"` daireyi eziyordu. */}
          <span aria-hidden className={styles.dot} style={{ left: "100%", top: `${yOf(last)}%` }} />
          {axis.kind === "pct" && (
            <span aria-hidden className={styles.startLabel} style={{ top: `${yOf(first)}%` }}>{labels.startLine}</span>
          )}
        </div>
      </div>
      <div aria-hidden className={cn(styles.ticks, gutter && styles.withGutter)}>
        {gutter && <span />}
        <span className={styles.tickRow}>
          {ticks.map((tick) => (
            <span key={tick}>{tick}</span>
          ))}
        </span>
      </div>
      {figures.length > 0 && (
        <dl className={styles.figures}>
          {figures.map((figure) => (
            <div key={figure.key}>
              <dt>{figure.label}</dt>
              <dd className={cn("numeral", figure.tone === "up" && styles.up, figure.tone === "down" && styles.down)}>{figure.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </figure>
  );
}
