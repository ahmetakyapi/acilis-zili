"use client";
import type { SavedAnalysis } from "@/lib/ai-analysis";
import type { Dictionary, Locale } from "@/lib/i18n";
import { formatPercentPlain, formatPrice } from "@/lib/utils";
import { ChangePill } from "@/components/ui/primitives";
import { ChapterHeading } from "@/components/ui/ChapterHeading";
import { Reveal } from "@/components/motion/PremiumMotion";
import { ScoreRing } from "@/components/earnings/ScoreRing";
import { PriceMap } from "./PriceMap";
import { ReturnBars, RsiDial, ScenarioAxis, ScoreCards, TrendChecks } from "./AnalysisVisuals";
import styles from "./Analysis.module.css";

export type CurrentQuote = { price: number; at: string | null; realtime: boolean } | null;
const CONFIDENCE_STEPS = ["low", "medium", "high"] as const;

export function analysisDate(value: string, locale: Locale) {
  return new Date(value).toLocaleString(locale === "tr" ? "tr-TR" : "en-GB", { timeZone: "Europe/Istanbul", dateStyle: "medium", timeStyle: "short" });
}

/**
 * Rapor, bilanço raporunun diliyle: kapak (karar, halka, giriş paragrafı,
 * fiyat künyesi) → Kısaca (üç madde) → Fiyat Haritası → Teknik Görünüm
 * (puanlar, RSI, trend, getiri) → Senaryolar → Değerlendirme → Haberler.
 *
 * Göz önce kararı, sonra kararın neden ve hangi seviyede değişeceğini
 * görmeli; metin en sonda. Kapak açılışta sahnelenir (halka dolar, karar
 * yükselir), alttaki her parça görününce oynar (`Reveal`, `InView`).
 * Eski raporlarda (11 Ekim 2026 öncesi) olmayan alanların parçası basılmaz.
 */
export function AnalysisReport({ result, t, locale, current, symbol, horizon }: {
  result: SavedAnalysis; t: Dictionary["aiAnalysis"]; locale: Locale; current?: CurrentQuote; symbol: string; horizon: "short" | "medium";
}) {
  const { output: o, snapshot: s } = result;
  const price = (n: number | null | undefined) => formatPrice(n, locale, { currency: true });
  const reportPrice = result.quotePrice ?? s.price;
  const since = current && reportPrice ? (current.price / reportPrice - 1) * 100 : null;
  const cited = new Set(o.news.map(n => n.sourceIndex));
  const ring = o.verdict === "insufficient" ? "hold" : o.verdict;
  const readings = [
    [t.price, price(s.price)], [t.sma20, price(s.sma20)], [t.sma50, price(s.sma50)], [t.sma200, price(s.sma200)],
    ["RSI (14)", formatPrice(s.rsi14, locale)], ["MACD", formatPrice(s.macd?.macd, locale)],
    ["ATR (14)", price(s.atr14)], [t.support, `${price(s.pivots?.s1)} / ${price(s.pivots?.s2)}`],
    [t.resistance, `${price(s.pivots?.r1)} / ${price(s.pivots?.r2)}`], [t.lastSession, s.lastSession ?? "—"],
  ];
  const id = (part: string) => `ai-${part}`;
  return <article className={styles.report} aria-label={`${symbol} · ${t.saved} · ${analysisDate(result.generatedAt, locale)}`}>
    {/* ===== Kapak ===== */}
    <header className={styles.cover} data-verdict={o.verdict}>
      <div className={styles.coverVerdict}>
        <ScoreRing score={o.overallScore} verdict={ring} size={112} showDenominator className={styles.coverRing} />
        <div className={styles.coverWord}>
          <p className="plate">{t.coverLabel} · {horizon === "short" ? t.short : t.medium}</p>
          <strong className={styles.verdict}><span>{t.verdicts[o.verdict]}</span></strong>
          <p className={styles.verdictMeaning}>{t.verdictMeaning[o.verdict]}</p>
        </div>
      </div>
      <p className={styles.lead}>{o.summary}</p>
      <dl className={styles.coverFacts}>
        {o.confidence && <div>
          <dt>{t.confidence}</dt>
          <dd className={styles.confidence} data-level={o.confidence}>
            <span className={styles.meter} aria-hidden>{CONFIDENCE_STEPS.map((step, i) => <span key={step} data-on={i <= CONFIDENCE_STEPS.indexOf(o.confidence!) ? "" : undefined} style={{ "--i": i } as React.CSSProperties} />)}</span>
            {t.confidenceLevels[o.confidence]}
          </dd>
        </div>}
        <div><dt>{t.reportPrice}</dt><dd className="figure">{price(reportPrice)}</dd></div>
        {since !== null && current && <div><dt>{t.sinceReport}</dt><dd className={styles.sinceValue}><span className="figure">{price(current.price)}</span><ChangePill changePct={since} locale={locale} size="sm" /></dd></div>}
        <div><dt>{t.generated}</dt><dd>{analysisDate(result.generatedAt, locale)} · TR</dd></div>
      </dl>
    </header>

    {/* ===== Kısaca ===== */}
    {o.takeaways && o.takeaways.length > 0 && <section aria-labelledby={id("takeaways")} className={styles.takeawaysSection}>
      <p id={id("takeaways")} className="plate">{t.takeaways}</p>
      <ol className={styles.takeaways} data-motion-stagger>
        {o.takeaways.map((line, i) => <li key={i}><span className={`figure ${styles.takeawayNo}`} aria-hidden>{i + 1}</span><p>{line}</p></li>)}
      </ol>
    </section>}

    {/* ===== Fiyat Haritası ===== */}
    {result.pricePath && <section aria-labelledby={id("map")} className={styles.chapter}>
      <ChapterHeading id={id("map")} title={t.priceMap} dek={`${t.now} ${price(reportPrice)}${typeof o.bullLevel === "number" ? ` · ${t.bull} ${price(o.bullLevel)}` : ""}${typeof o.bearLevel === "number" ? ` · ${t.bear} ${price(o.bearLevel)}` : ""}`} />
      <PriceMap result={result} t={t} locale={locale} />
    </section>}

    {/* ===== Teknik Görünüm ===== */}
    <section aria-labelledby={id("measures")} className={styles.chapter}>
      <ChapterHeading id={id("measures")} title={t.measuresTitle} dek={`${t.coverage}: ${formatPercentPlain(result.screeningCoverage, locale)} · ${t.scoresHint}`} />
      <ScoreCards result={result} t={t} />
      <Reveal className={styles.technicalGrid}>
        <RsiDial result={result} t={t} locale={locale} />
        <div className={styles.technicalSide}>
          <p className="plate">{t.trendTitle}</p>
          <TrendChecks result={result} t={t} locale={locale} />
        </div>
        {result.pricePath && <div className={styles.technicalSide}>
          <p className="plate">{t.returnsTitle}</p>
          <ReturnBars result={result} t={t} locale={locale} />
        </div>}
      </Reveal>
    </section>

    {/* ===== Senaryolar ===== */}
    <section aria-labelledby={id("scenarios")} className={styles.chapter}>
      <ChapterHeading id={id("scenarios")} title={t.scenarios} dek={t.axisHint} />
      <Reveal><ScenarioAxis result={result} t={t} locale={locale} /></Reveal>
      <div className={styles.scenarios} data-motion-stagger>
        {([["up", t.bull, o.bullScenario, o.bullLevel, t.triggerAbove], ["down", t.bear, o.bearScenario, o.bearLevel, t.triggerBelow]] as const).map(([tone, title, text, level, rule]) =>
          <div key={tone} className={styles.scenario} data-tone={tone}>
            <h3 data-ink="plain">{title}</h3>
            {typeof level === "number" && <p className={styles.trigger}>{t.trigger} · <span className="figure">{price(level)}</span> {rule}</p>}
            <p>{text}</p>
          </div>)}
      </div>
      <Reveal className={styles.invalidation}><h3 data-ink="plain">{t.invalidation}</h3><p>{o.invalidation}</p></Reveal>
      {o.watch && o.watch.length > 0 && <Reveal className={styles.watchBlock}>
        <p className="plate">{t.watch}</p>
        <ol className={styles.watch}>{o.watch.map((item, i) => <li key={i}>{item}</li>)}</ol>
      </Reveal>}
    </section>

    {/* ===== Değerlendirme ===== */}
    <section aria-labelledby={id("reading")} className={styles.chapter}>
      <ChapterHeading id={id("reading")} title={t.evaluation} />
      <div className={styles.points} data-motion-stagger>
        {([["reasons", t.reasons, o.reasons], ["risks", t.risks, o.risks]] as const).map(([key, title, items]) => <div key={key} className={styles.pointsCard} data-kind={key}>
          <h3 data-ink="plain">{title}<span className="figure">{items.length}</span></h3>
          <ol>{items.map((item, i) => <li key={i}><span className={`figure ${styles.pointNo}`} aria-hidden>{i + 1}</span><p>{item}</p></li>)}</ol>
        </div>)}
      </div>
    </section>

    {/* ===== Haberler ===== */}
    <section aria-labelledby={id("news")} className={styles.chapter}>
      <ChapterHeading id={id("news")} title={t.citedNews} dek={result.newsFetchedAt ? `${t.newsFetched}: ${analysisDate(result.newsFetchedAt, locale)} · TR` : undefined} />
      {!result.newsAvailable && <p className={styles.hint}>{t.missingNews}</p>}
      {result.newsAvailable && !cited.size && <p className={styles.hint}>{t.noNews}</p>}
      <ul className={styles.sources} data-motion-stagger>{result.sources.map((source, i) => cited.has(i) && <li key={`${source.url}:${i}`}>
        <p className={styles.sourceMeta}>{source.source} · {analysisDate(source.publishedAt, locale)} · TR</p>
        <a href={source.url} target="_blank" rel="noopener noreferrer">{source.headline}</a>
        {o.news.filter(n => n.sourceIndex === i).map((n, j) => <p key={j} className={styles.impact}>{n.impact}</p>)}
      </li>)}</ul>
      {result.sources.length > cited.size && <details className={styles.fold}>
        <summary>{t.otherNews} ({result.sources.length - cited.size})</summary>
        <ul className={styles.otherSources}>{result.sources.map((source, i) => !cited.has(i) && <li key={`${source.url}:${i}`}>
          <a href={source.url} target="_blank" rel="noopener noreferrer">{source.headline}</a>
          <span className={styles.sourceMeta}>{source.source} · {analysisDate(source.publishedAt, locale)} · TR</span>
        </li>)}</ul>
      </details>}
      <details className={styles.fold}>
        <summary>{t.allIndicators}</summary>
        <dl className={styles.indicators}>{readings.map(([label, value]) => <div key={label}><dt>{label}</dt><dd className="figure">{value}</dd></div>)}</dl>
      </details>
    </section>

    <footer className={styles.foot}>
      <p>{t.quote}: {analysisDate(result.quoteAt, locale)} · TR · {result.quoteSource} · {result.realtime ? t.realtime : t.delayed}</p>
      <p>{t.dataHint}</p><p>{t.disclaimer}</p>
    </footer>
  </article>;
}
