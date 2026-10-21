/* Sunucu bileşeni (20 Ekim); gerekçe `AnalysisReport.tsx`in başında. */
import type { SavedAnalysis } from "@/lib/ai-analysis";
import type { Dictionary, Locale } from "@/lib/i18n";
import { formatPercent, formatPrice } from "@/lib/utils";
import { triggerMath } from "@/lib/ai-analysis-core";
import { CountUp, InView } from "./InView";
import styles from "./AnalysisVisuals.module.css";

type T = Dictionary["aiAnalysis"];
/** Puan bandının sınırları: 0–19, 20–39, 40–59, 60–79, 80–100 (promptla aynı ölçü). */
const BAND_WIDTH = 20;
const BAND_COUNT = 5;
export const bandOf = (score: number) => Math.min(BAND_COUNT - 1, Math.floor(score / BAND_WIDTH));
/** RSI bölgeleri: klasik 30 / 70 eşikleri. */
const RSI_LOW = 30;
const RSI_HIGH = 70;
/** Kadran yarım daire: 0 → 180°. */
const DIAL_R = 44;

/** Dört puan kartı: büyük sayı sayarak gelir, altında 5 piksellik şerit ve bant adı. */
export function ScoreCards({ result, t }: { result: SavedAnalysis; t: T }) {
  const o = result.output;
  const scores: [string, number | null][] = [[t.overall, o.overallScore], [t.technical, o.technicalScore], [t.news, o.newsScore], [t.business, result.screeningScore]];
  return <InView as="ul" className={styles.scoreCards}>
    {scores.map(([label, value], i) => <li key={label} style={{ "--i": i } as React.CSSProperties} data-lead={i === 0 ? "" : undefined}>
      <span className={styles.cardLabel}>{label}</span>
      <span className={`figure ${styles.cardValue}`}>{value === null ? "—" : <CountUp value={value} />}<small>/ 100</small></span>
      <span className={styles.track} aria-hidden>{value !== null && <span className={styles.trackFill} style={{ width: `${value}%` }} />}</span>
      <span className={styles.cardNote}>{value === null ? t.noNewsShort : t.scoreBands[bandOf(value)]}</span>
    </li>)}
  </InView>;
}

/** Senaryo ekseni: olumsuz tetik ← şu an → olumlu tetik; uzaklıklar yüzde. */
export function ScenarioAxis({ result, t, locale }: { result: SavedAnalysis; t: T; locale: Locale }) {
  const { bullLevel, bearLevel } = result.output;
  const price = result.quotePrice ?? result.snapshot.price;
  if (typeof bullLevel !== "number" || typeof bearLevel !== "number" || price === null || bullLevel <= bearLevel) return null;
  // Fiyat iki tetiğin dışındaysa eksen onu kenara oturtur; yüzde yine gerçek uzaklığı söyler.
  const at = Math.min(1, Math.max(0, (price - bearLevel) / (bullLevel - bearLevel)));
  const money = (v: number) => formatPrice(v, locale, { currency: true });
  return <InView className={styles.axis} role="img" aria-label={`${t.axisTitle}: ${t.toBear} ${formatPercent((bearLevel / price - 1) * 100, locale, 1)}, ${t.toBull} ${formatPercent((bullLevel / price - 1) * 100, locale, 1)}`}>
    <div className={styles.axisTrack} aria-hidden style={{ "--at": at } as React.CSSProperties}>
      <span className={styles.axisBear} />
      <span className={styles.axisBull} />
      <span className={styles.axisNow}><span>{t.now} · {money(price)}</span></span>
    </div>
    {(() => {
      const m = triggerMath(price, bullLevel, bearLevel, result.snapshot.atr14);
      if (!m) return null;
      const atr = (v: number | null) => v === null ? "" : ` · ${formatPrice(v, locale, { digits: 1 })} ATR`;
      return <dl className={styles.axisMath}>
        <div><dt>{t.toBear}</dt><dd className="figure" data-tone="down">{formatPercent(m.downPct, locale, 1)}{atr(m.downAtr)}</dd></div>
        <div><dt>{t.ratioTitle}</dt><dd className="figure">{m.ratio === null ? "—" : formatPrice(m.ratio, locale, { digits: 2 })}</dd></div>
        <div><dt>{t.toBull}</dt><dd className="figure" data-tone="up">{formatPercent(m.upPct, locale, 1)}{atr(m.upAtr)}</dd></div>
      </dl>;
    })()}
    <div className={styles.axisEnds} aria-hidden>
      <span data-tone="down"><b className="figure">{money(bearLevel)}</b>{t.bear}</span>
      <span data-tone="up"><b className="figure">{money(bullLevel)}</b>{t.bull}</span>
    </div>
  </InView>;
}

/** RSI yarım kadranı: 30 / 70 bölgeleri ince, ibre değere döner. */
export function RsiDial({ result, t, locale }: { result: SavedAnalysis; t: T; locale: Locale }) {
  const rsi = result.snapshot.rsi14;
  if (rsi === null) return null;
  const zone = rsi < RSI_LOW ? "oversold" : rsi > RSI_HIGH ? "overbought" : "neutral";
  const arc = (from: number, to: number) => {
    const a = Math.PI * (1 - from / 100), b = Math.PI * (1 - to / 100);
    return `M ${50 + DIAL_R * Math.cos(a)} ${50 - DIAL_R * Math.sin(a)} A ${DIAL_R} ${DIAL_R} 0 0 1 ${50 + DIAL_R * Math.cos(b)} ${50 - DIAL_R * Math.sin(b)}`;
  };
  return <InView as="figure" className={styles.dial}>
    <div className={styles.dialFace}>
      <svg viewBox="0 0 100 56" aria-hidden>
        <path d={arc(0, 100)} className={styles.dialTrack} />
        <path d={arc(0, RSI_LOW)} className={styles.dialZone} />
        <path d={arc(RSI_HIGH, 100)} className={styles.dialZone} />
        <g className={styles.needle} style={{ "--deg": `${(rsi / 100) * 180}deg` } as React.CSSProperties}>
          <line x1="50" y1="50" x2={50 - DIAL_R + 8} y2="50" />
          <circle cx="50" cy="50" r="3.2" />
        </g>
      </svg>
      <span className={`figure ${styles.dialValue}`}>{formatPrice(rsi, locale, { digits: 0 })}</span>
    </div>
    <figcaption><b>RSI (14)</b> · {t.rsiZones[zone]}</figcaption>
  </InView>;
}

/** Fiyat 20 / 50 / 200 günlük ortalamaların üstünde mi: üç satırlık hızlı okuma. */
export function TrendChecks({ result, t, locale }: { result: SavedAnalysis; t: T; locale: Locale }) {
  const s = result.snapshot;
  const price = result.quotePrice ?? s.price;
  if (price === null) return null;
  const rows = ([["sma20", s.sma20, t.sma20], ["sma50", s.sma50, t.sma50], ["sma200", s.sma200, t.sma200]] as const)
    .filter((r): r is [typeof r[0], number, string] => typeof r[1] === "number");
  if (!rows.length) return null;
  return <InView as="ul" className={styles.trend} aria-label={t.trendTitle}>
    {rows.map(([key, value, label], i) => {
      const above = price >= value;
      return <li key={key} data-tone={above ? "up" : "down"} style={{ "--i": i } as React.CSSProperties}>
        <span className={styles.trendMark} aria-hidden>{above ? "▲" : "▼"}</span>
        <span>{label}</span>
        <span className={styles.trendState}>{above ? t.above : t.below}</span>
        <span className={`figure ${styles.trendGap}`}>{formatPercent((price / value - 1) * 100, locale, 1)}</span>
      </li>;
    })}
  </InView>;
}

/** Dönem getirisi: sıfır çizgisinden yukarı/aşağı büyüyen dört çubuk. Çubuk büyüklük, renk yalnız işaret. */
export function ReturnBars({ result, t, locale }: { result: SavedAnalysis; t: T; locale: Locale }) {
  const path = result.pricePath;
  if (!path) return null;
  const keys = ["w1", "m1", "m3", "m6"] as const;
  const max = Math.max(...keys.map(k => Math.abs(path.returnsPct[k] ?? 0)), 1);
  return <InView as="ul" className={styles.returns} aria-label={t.returnsTitle}>
    {keys.map((key, i) => {
      const value = path.returnsPct[key];
      const tone = value === null ? "flat" : value >= 0 ? "up" : "down";
      return <li key={key} data-tone={tone} style={{ "--i": i, "--h": value === null ? 0 : Math.abs(value) / max } as React.CSSProperties}>
        <span className={`figure ${styles.returnValue}`}>{value === null ? "—" : formatPercent(value, locale, 1)}</span>
        <span className={styles.returnPlot} aria-hidden><span /></span>
        <span className={styles.returnLabel}>{t.periods[key]}</span>
      </li>;
    })}
  </InView>;
}

const PERCENT_METRICS = new Set(["salesGrowthQ", "epsGrowthQ", "grossMargin", "operatingMargin", "buyShareNow", "upside"]);
/** Büyüme ve potansiyel yön taşır (işaret rengi); marj ve oranlar büyüklüktür, renksiz. */
const SIGNED_METRICS = new Set(["salesGrowthQ", "epsGrowthQ", "upside"]);
const SCORECARD_METRICS = ["salesGrowthQ", "epsGrowthQ", "grossMargin", "operatingMargin", "forwardPE", "debtToEquity", "buyShareNow", "upside"] as const;

/** Şirket Karnesi: seçim motorunun altı kategorisi şerit olarak, altında raporun dayandığı sekiz ölçü. */
export function CompanyScorecard({ result, t, locale, categoryNames }: { result: SavedAnalysis; t: T; locale: Locale; categoryNames: Record<string, string> }) {
  const categories = result.categories?.filter(c => c.category !== "gate") ?? [];
  const f = result.fundamentals ?? {};
  const metrics = SCORECARD_METRICS.filter(key => typeof f[key] === "number");
  if (!categories.length && !metrics.length) return null;
  return <div className={styles.scorecard}>
    {categories.length > 0 && <InView as="ul" className={styles.categories}>
      {categories.map((c, i) => <li key={c.category} style={{ "--i": i } as React.CSSProperties}>
        <span className={styles.catName}>{categoryNames[c.category] ?? c.category}<small>%{c.weight}</small></span>
        <span className={styles.track} aria-hidden>{c.score !== null && <span className={styles.trackFill} style={{ width: `${c.score}%` }} />}</span>
        <span className={`figure ${styles.catScore}`}>{c.score === null ? "—" : <CountUp value={c.score} />}</span>
      </li>)}
    </InView>}
    {metrics.length > 0 && <InView as="dl" className={styles.metrics}>
      {metrics.map((key, i) => {
        const value = f[key] as number;
        const tone = SIGNED_METRICS.has(key) ? (value >= 0 ? "up" : "down") : undefined;
        return <div key={key} style={{ "--i": i } as React.CSSProperties} data-tone={tone}>
          <dt>{t.scorecard.metrics[key]}</dt>
          <dd className="figure">{PERCENT_METRICS.has(key) ? formatPercent(value, locale, 1).replace(/^\+/, SIGNED_METRICS.has(key) ? "+" : "") : formatPrice(value, locale, { digits: 1 })}</dd>
        </div>;
      })}
    </InView>}
  </div>;
}
