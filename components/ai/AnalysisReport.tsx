"use client";
import type { SavedAnalysis } from "@/lib/ai-analysis";
import type { Dictionary, Locale } from "@/lib/i18n";
import { formatPercent, formatPercentPlain, formatPrice } from "@/lib/utils";
import { ChangePill } from "@/components/ui/primitives";
import { PriceMap } from "./PriceMap";
import styles from "./Analysis.module.css";

export type CurrentQuote = { price: number; at: string | null; realtime: boolean } | null;
/** Puan bandının sınırları: 0–19, 20–39, 40–59, 60–79, 80–100 (promptla aynı ölçü). */
const BAND_WIDTH = 20;
const BAND_COUNT = 5;

export function analysisDate(value: string, locale: Locale) {
  return new Date(value).toLocaleString(locale === "tr" ? "tr-TR" : "en-GB", { timeZone: "Europe/Istanbul", dateStyle: "medium", timeStyle: "short" });
}
const bandOf = (score: number) => Math.min(BAND_COUNT - 1, Math.floor(score / BAND_WIDTH));

/**
 * Rapor, ekran düzeninin sırasıyla: karar şeridi → ana görsel (fiyat
 * haritası) → ölçü ızgarası (puanlar, getiriler) → metin (senaryolar,
 * gerekçe/risk) → haber → künyeler. Eski raporlarda (11 Ekim öncesi)
 * güven, tetik, izleme listesi ve fiyat seyri yok; o parçalar basılmaz.
 */
export function AnalysisReport({ result, t, locale, current, symbol }: {
  result: SavedAnalysis; t: Dictionary["aiAnalysis"]; locale: Locale; current?: CurrentQuote; symbol: string;
}) {
  const { output: o, snapshot: s } = result;
  const price = (n: number | null | undefined) => formatPrice(n, locale, { currency: true });
  const reportPrice = result.quotePrice ?? s.price;
  const since = current && reportPrice ? (current.price / reportPrice - 1) * 100 : null;
  const scores: [string, number | null][] = [[t.overall, o.overallScore], [t.technical, o.technicalScore], [t.news, o.newsScore], [t.business, result.screeningScore]];
  const cited = new Set(o.news.map(n => n.sourceIndex));
  const readings = [
    [t.price, price(s.price)], [t.sma20, price(s.sma20)], [t.sma50, price(s.sma50)], [t.sma200, price(s.sma200)],
    ["RSI (14)", formatPrice(s.rsi14, locale)], ["MACD", formatPrice(s.macd?.macd, locale)],
    ["ATR (14)", price(s.atr14)], [t.support, `${price(s.pivots?.s1)} / ${price(s.pivots?.s2)}`],
    [t.resistance, `${price(s.pivots?.r1)} / ${price(s.pivots?.r2)}`], [t.lastSession, s.lastSession ?? "—"],
  ];
  return <article className={styles.report} aria-label={`${symbol} · ${t.saved} · ${analysisDate(result.generatedAt, locale)}`}>
    <header className={styles.hero} data-verdict={o.verdict}>
      <div className={styles.heroHead}>
        <strong className={styles.verdict}>{t.verdicts[o.verdict]}</strong>
        <ul className={styles.heroFacts}>
          {o.confidence && <li>{t.confidence}: <b>{t.confidenceLevels[o.confidence]}</b></li>}
          <li>{t.generated}: {analysisDate(result.generatedAt, locale)} · TR</li>
        </ul>
      </div>
      <p className={styles.verdictMeaning}>{t.verdictMeaning[o.verdict]}</p>
      <p className={styles.summary}>{o.summary}</p>
      {since !== null && current && reportPrice && <p className={styles.since}>
        <span>{t.sinceReport}</span>
        <span>{t.reportPrice} {price(reportPrice)}</span>
        <span>{t.currentPrice} {price(current.price)}</span>
        <ChangePill changePct={since} locale={locale} size="sm" />
      </p>}
    </header>

    <PriceMap result={result} t={t} locale={locale} />

    <div className={styles.measures}>
      <section aria-labelledby="ai-scores">
        <h3 id="ai-scores" className={styles.sectionTitle}>{t.scoresTitle}</h3>
        <ul className={styles.lanes}>
          {scores.map(([label, value], i) => <li key={label}>
            <div className={styles.laneHead}>
              <span>{label}</span>
              <span className={styles.laneValue}>{value ?? "—"}{value !== null && <small> / 100 · {t.scoreBands[bandOf(value)]}</small>}</span>
            </div>
            <span className={styles.lane} aria-hidden>
              {value !== null && <span className={styles.laneFill} style={{ width: `${value}%`, animationDelay: `${150 + i * 90}ms` }} />}
            </span>
          </li>)}
        </ul>
        <p className={styles.stamp}>{t.coverage}: {formatPercentPlain(result.screeningCoverage, locale)} · {t.scoresHint}</p>
      </section>
      {result.pricePath && <section aria-labelledby="ai-returns">
        <h3 id="ai-returns" className={styles.sectionTitle}>{t.returnsTitle}</h3>
        <dl className={styles.returns}>
          {(["w1", "m1", "m3", "m6"] as const).map(key => <div key={key}>
            <dt>{t.periods[key]}</dt>
            <dd>{result.pricePath!.returnsPct[key] === null ? "—" : <ChangePill changePct={result.pricePath!.returnsPct[key]!} locale={locale} size="sm" />}</dd>
          </div>)}
        </dl>
        <p className={styles.stamp}>{t.levels.high3m} {price(result.pricePath.range3m.high)} ({formatPercent(result.pricePath.range3m.fromHighPct, locale, 1)}) · {t.levels.low3m} {price(result.pricePath.range3m.low)}</p>
      </section>}
    </div>

    <section aria-labelledby="ai-scenarios">
      <h3 id="ai-scenarios" className={styles.sectionTitle}>{t.scenarios}</h3>
      <div className={styles.scenarios}>
        {([["up", t.bull, o.bullScenario, o.bullLevel, t.triggerAbove], ["down", t.bear, o.bearScenario, o.bearLevel, t.triggerBelow]] as const).map(([tone, title, text, level, rule]) =>
          <div key={tone} className={styles.scenario} data-tone={tone}>
            <h4>{title}</h4>
            {typeof level === "number" && <p className={styles.trigger}>{t.trigger} · {price(level)} {rule}</p>}
            <p>{text}</p>
          </div>)}
      </div>
      <div className={styles.invalidation}><h4>{t.invalidation}</h4><p>{o.invalidation}</p></div>
    </section>

    {o.watch && o.watch.length > 0 && <section aria-labelledby="ai-watch">
      <h3 id="ai-watch" className={styles.sectionTitle}>{t.watch}</h3>
      <ol className={styles.watch}>{o.watch.map((item, i) => <li key={i}>{item}</li>)}</ol>
    </section>}

    <div className={styles.columns}>
      <section className={styles.prose}><h3>{t.reasons}</h3><ul>{o.reasons.map((item, i) => <li key={i}>{item}</li>)}</ul></section>
      <section className={styles.prose}><h3>{t.risks}</h3><ul>{o.risks.map((item, i) => <li key={i}>{item}</li>)}</ul></section>
    </div>

    <section className={styles.prose} aria-labelledby="ai-news">
      <h3 id="ai-news">{t.citedNews}</h3>
      {!result.newsAvailable && <p>{t.missingNews}</p>}
      {result.newsAvailable && !cited.size && <p>{t.noNews}</p>}
      <ul className={styles.sources}>{result.sources.map((source, i) => cited.has(i) && <li key={`${source.url}:${i}`}>
        <a href={source.url} target="_blank" rel="noopener noreferrer">{source.headline}</a>
        <p className={styles.stamp}>{source.source} · {analysisDate(source.publishedAt, locale)} · TR</p>
        {o.news.filter(n => n.sourceIndex === i).map((n, j) => <p key={j}>{n.impact}</p>)}
      </li>)}</ul>
      {result.sources.length > cited.size && <details className={styles.fold}>
        <summary>{t.otherNews} ({result.sources.length - cited.size})</summary>
        <ul className={styles.sources}>{result.sources.map((source, i) => !cited.has(i) && <li key={`${source.url}:${i}`}>
          <a href={source.url} target="_blank" rel="noopener noreferrer">{source.headline}</a>
          <p className={styles.stamp}>{source.source} · {analysisDate(source.publishedAt, locale)} · TR</p>
        </li>)}</ul>
      </details>}
    </section>

    <details className={styles.fold}>
      <summary>{t.allIndicators}</summary>
      <dl className={styles.indicators}>{readings.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    </details>

    <footer className={styles.foot}>
      <p>{t.quote}: {analysisDate(result.quoteAt, locale)} · TR · {result.quoteSource} · {result.realtime ? t.realtime : t.delayed}</p>
      {result.newsFetchedAt && <p>{t.newsFetched}: {analysisDate(result.newsFetchedAt, locale)} · TR</p>}
      <p>{t.dataHint}</p><p>{t.disclaimer}</p>
    </footer>
  </article>;
}
