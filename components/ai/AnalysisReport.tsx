"use client";
import type { SavedAnalysis } from "@/lib/ai-analysis";
import type { Dictionary, Locale } from "@/lib/i18n";
import { formatPercentPlain, formatPrice } from "@/lib/utils";
import styles from "./Analysis.module.css";

export function analysisDate(value: string, locale: Locale) {
  return new Date(value).toLocaleString(locale === "tr" ? "tr-TR" : "en-GB", { timeZone: "Europe/Istanbul", dateStyle: "medium", timeStyle: "short" });
}
export function AnalysisReport({ result, t, locale }: { result: SavedAnalysis; t: Dictionary["aiAnalysis"]; locale: Locale }) {
  const { output: o, snapshot: s } = result;
  const price = (n: number | null | undefined) => formatPrice(n, locale, { currency: true });
  const readings = [
    [t.price, price(s.price)], [t.sma20, price(s.sma20)], [t.sma50, price(s.sma50)], [t.sma200, price(s.sma200)],
    ["RSI (14)", formatPrice(s.rsi14, locale)], ["MACD", formatPrice(s.macd?.macd, locale)],
    ["ATR (14)", price(s.atr14)], [t.support, `${price(s.pivots?.s1)} / ${price(s.pivots?.s2)}`],
    [t.resistance, `${price(s.pivots?.r1)} / ${price(s.pivots?.r2)}`], [t.lastSession, s.lastSession ?? "—"],
  ];
  return <article className={styles.report} aria-label={`${t.saved} · ${analysisDate(result.generatedAt, locale)}`}>
    <div className={styles.heading}>
      <strong className={styles.verdict} data-verdict={o.verdict}>{t.verdicts[o.verdict]}</strong>
      <p className={styles.stamp}>{t.generated}: {analysisDate(result.generatedAt, locale)} · TR</p>
    </div>
    <dl className={styles.scores}>
      {[[t.overall, o.overallScore], [t.technical, o.technicalScore], [t.news, o.newsScore], [t.business, result.screeningScore]].map(([label, value]) =>
        <div className={styles.score} key={label}><dt>{label}</dt><dd>{value ?? "—"} {value !== null && <small>/ 100</small>}</dd></div>)}
    </dl>
    <p className={styles.stamp}>{t.coverage}: {formatPercentPlain(result.screeningCoverage, locale)}</p>
    <p className={styles.prose}>{o.summary}</p>
    <div className={styles.columns}>
      <section className={styles.prose}><h3>{t.reasons}</h3><ul>{o.reasons.map((item, i) => <li key={i}>{item}</li>)}</ul></section>
      <section className={styles.prose}><h3>{t.risks}</h3><ul>{o.risks.map((item, i) => <li key={i}>{item}</li>)}</ul></section>
    </div>
    <div className={styles.columns}>
      <section className={styles.prose}><h3>{t.bull}</h3><p>{o.bullScenario}</p></section>
      <section className={styles.prose}><h3>{t.bear}</h3><p>{o.bearScenario}</p></section>
    </div>
    <section className={styles.prose}><h3>{t.invalidation}</h3><p>{o.invalidation}</p></section>
    <section className={styles.prose}><h3>{t.indicators}</h3><dl className={styles.indicators}>{readings.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>
    <section className={styles.prose}><h3>{t.sources}</h3>
      {!result.newsAvailable && <p>{t.missingNews}</p>}
      {result.newsAvailable && !result.sources.length && <p>{t.noNews}</p>}
      <ul className={styles.sources}>{result.sources.map((source, i) => <li key={`${source.url}:${i}`}>
        <a href={source.url} target="_blank" rel="noopener noreferrer">{source.headline}</a>
        <p className={styles.stamp}>{source.source} · {analysisDate(source.publishedAt, locale)} · TR</p>
        {o.news.filter(n => n.sourceIndex === i).map((n, j) => <p key={j}>{n.impact}</p>)}
      </li>)}</ul>
    </section>
    <footer className={styles.foot}>
      <p>{t.quote}: {analysisDate(result.quoteAt, locale)} · TR · {result.quoteSource} · {result.realtime ? t.realtime : t.delayed}</p>
      {result.newsFetchedAt && <p>{t.newsFetched}: {analysisDate(result.newsFetchedAt, locale)} · TR</p>}
      <p>{t.dataHint}</p><p>{t.disclaimer}</p>
    </footer>
  </article>;
}
