import type { SavedAnalysis } from "@/lib/ai-analysis";
import type { Dictionary, Locale } from "@/lib/i18n";
import { formatPercent, formatPrice } from "@/lib/utils";
import styles from "./Analysis.module.css";

type Level = { key: string; label: string; value: number; tone: "up" | "down" | "plain" };

/** Çizim alanı (viewBox); metin HTML katmanında, SVG gerilse de punto bozulmaz. */
const VIEW_W = 600;
const VIEW_H = 240;
/** Dikey ölçeğin iki ucundaki pay. */
const Y_PAD = 0.06;
/** Etiketler arasında en az bu kadar yükseklik (yüzde): 240 px'te ~17 px. */
const LABEL_GAP = 7;
/** Ortalama, grafiğin fiyat bandından bu kadar uzaksa çizilmez; ölçeği ezerdi. */
const FAR_LEVEL = 0.12;

/**
 * Raporun ANA GÖRSELİ: son 3 ayın kapanışı ve raporun dayandığı seviyeler.
 *
 * Seviyeler yalnız uygulamanın hesapladığı sayılar (pivotlar, ortalamalar,
 * 3 aylık bant); modelin söylediği tetik seviyesi de ancak bunlardan biriyse
 * gelir (`snapLevel`). Renk yalnız tetikte: olumlu senaryonun tetiği `--up`,
 * olumsuzunki `--down`; ötekiler kesik `--line-strong`. Çizgi 3 aylık yönün
 * rengini taşır (Sparkline'daki kural).
 */
export function PriceMap({ result, t, locale }: { result: SavedAnalysis; t: Dictionary["aiAnalysis"]; locale: Locale }) {
  const path = result.pricePath;
  const s = result.snapshot;
  const price = result.quotePrice ?? s.price;
  if (!path || path.chart.length < 2 || price === null) return null;
  const closes = path.chart.map(p => p.close);
  const lo = Math.min(...closes, price);
  const hi = Math.max(...closes, price);
  const near = (v: number | null | undefined): v is number => typeof v === "number" && v >= lo * (1 - FAR_LEVEL) && v <= hi * (1 + FAR_LEVEL);
  const { bullLevel, bearLevel } = result.output;
  const tone = (v: number): Level["tone"] => v === bullLevel ? "up" : v === bearLevel ? "down" : "plain";
  const raw: [string, number | null | undefined][] = [
    ["r2", s.pivots?.r2], ["r1", s.pivots?.r1], ["s1", s.pivots?.s1], ["s2", s.pivots?.s2],
    ["sma50", s.sma50], ["sma200", s.sma200], ["high3m", path.range3m.high], ["low3m", path.range3m.low],
  ];
  const levels: Level[] = raw.filter((e): e is [string, number] => near(e[1]))
    .map(([key, value]) => ({ key, value, label: t.levels[key as keyof typeof t.levels], tone: tone(value) }));
  // Tetik listedeki bir seviye değilse (tepe/dip) yine çizilir: senaryo onu anlatıyor.
  for (const [value, key] of [[bullLevel, "bull"], [bearLevel, "bear"]] as const) {
    if (typeof value === "number" && near(value) && !levels.some(l => l.value === value)) {
      levels.push({ key, value, label: `${t.trigger} · ${key === "bull" ? t.bull : t.bear}`, tone: key === "bull" ? "up" : "down" });
    }
  }
  const values = [...closes, price, ...levels.map(l => l.value)];
  const min = Math.min(...values);
  const span = (Math.max(...values) - min) || min * 0.01 || 1;
  const yPct = (v: number) => (1 - Y_PAD - ((v - min) / span) * (1 - Y_PAD * 2)) * 100;
  const x = (i: number) => (i / (closes.length - 1)) * VIEW_W;
  const line = closes.map((c, i) => `${x(i).toFixed(1)},${(yPct(c) / 100 * VIEW_H).toFixed(1)}`).join(" ");
  const up = closes.at(-1)! >= closes[0];
  const stroke = up ? "var(--up)" : "var(--down)";

  // Etiket çarpışması: yukarıdan aşağı sırala, en az LABEL_GAP aralık bırak.
  const labelled = [...levels, { key: "now", label: t.now, value: price, tone: "plain" as const }]
    .sort((a, b) => b.value - a.value)
    .map(level => ({ ...level, y: yPct(level.value) }));
  for (let i = 1; i < labelled.length; i++) labelled[i].y = Math.max(labelled[i].y, labelled[i - 1].y + LABEL_GAP);
  const overflow = labelled.at(-1)!.y - 100;
  if (overflow > 0) for (let i = labelled.length - 1; i >= 0; i--) labelled[i].y = Math.max(0, labelled[i].y - overflow);

  return <section className={styles.mapSection} aria-labelledby="ai-price-map">
    <h3 id="ai-price-map" className={styles.sectionTitle}>{t.priceMap}</h3>
    <div className={styles.mapGrid}>
      <figure className={styles.mapFigure}>
        <div className={styles.chart} role="img" aria-label={`${t.priceMap}: ${t.now} ${formatPrice(price, locale, { currency: true })}`}>
          <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="none" className={styles.chartSvg} aria-hidden>
            {levels.map((level, i) => <line key={level.key} x1={0} x2={VIEW_W} y1={yPct(level.value) / 100 * VIEW_H} y2={yPct(level.value) / 100 * VIEW_H}
              className={styles.levelLine} data-tone={level.tone} style={{ animationDelay: `${300 + i * 60}ms` }} vectorEffect="non-scaling-stroke" />)}
            <polygon points={`0,${VIEW_H} ${line} ${VIEW_W},${VIEW_H}`} className={styles.chartArea} style={{ fill: stroke }} />
            <polyline points={line} pathLength={1} className={styles.chartLine} style={{ stroke }} vectorEffect="non-scaling-stroke" />
          </svg>
          <span className={styles.nowDot} style={{ top: `${yPct(price)}%`, background: stroke }} aria-hidden />
          <div className={styles.chartLabels} aria-hidden>
            {labelled.map(level => <span key={level.key} className={styles.chartLabel} data-tone={level.key === "now" ? "now" : level.tone} style={{ top: `${level.y}%` }}>
              {formatPrice(level.value, locale, { currency: true })}
            </span>)}
          </div>
        </div>
        <figcaption className={styles.stamp}>{t.priceMapHint}</figcaption>
      </figure>
      <ol className={styles.ladder} aria-label={t.levelsTitle}>
        {labelled.map((level, i) => <li key={level.key} data-tone={level.key === "now" ? "now" : level.tone} style={{ animationDelay: `${200 + i * 50}ms` }}>
          <span className={styles.ladderName}>{level.label}</span>
          <span className={styles.ladderValue}>{formatPrice(level.value, locale, { currency: true })}</span>
          <span className={styles.ladderDistance}>{level.key === "now" ? "" : formatPercent((level.value / price - 1) * 100, locale, 1)}</span>
        </li>)}
      </ol>
    </div>
  </section>;
}
