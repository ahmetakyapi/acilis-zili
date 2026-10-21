/* SUNUCU BİLEŞENİ (20 Ekim) — `AnalysisVisuals` ve `PriceMap` de. "use client"
   taşıyordu ama ne kanca ne olay ne tarayıcı API'si var; hareketli parçalar
   (`Reveal`, `InView`, `CountUp`) zaten kendi istemci yapraklarında. Yönerge
   bütün rapor ağacını tarayıcıya indirip hidrate ettiriyor, `result`ı ve
   sözlüğü prop olarak ikinci kez gönderiyordu. */
import type { SavedAnalysis } from "@/lib/ai-analysis";
import type { Dictionary, Locale } from "@/lib/i18n";
import { formatPercentPlain, formatPrice } from "@/lib/utils";
import { ChangePill } from "@/components/ui/primitives";
import { ChapterHeading } from "@/components/ui/ChapterHeading";
import { Reveal } from "@/components/motion/PremiumMotion";
import { ScoreRing } from "@/components/earnings/ScoreRing";
import { FOCUS_OF, HORIZON_DAYS, daysSince, scenarioStatus } from "@/lib/ai-analysis-core";
import { PriceMap } from "./PriceMap";
import { KineticText } from "./KineticText";
import { InView } from "./InView";
import { CompanyScorecard, ReturnBars, RsiDial, ScenarioAxis, ScoreCards, TrendChecks } from "./AnalysisVisuals";
import styles from "./Analysis.module.css";

export type CurrentQuote = { price: number; at: string | null; realtime: boolean } | null;
const CONFIDENCE_STEPS = ["low", "medium", "high"] as const;
/** Teknik odakta bu kadar günden eski raporun seviyeleri eskimiş sayılır. */
const TECHNICAL_STALE_DAYS = 3;

export function analysisDate(value: string, locale: Locale) {
  return new Date(value).toLocaleString(locale === "tr" ? "tr-TR" : "en-GB", { timeZone: "Europe/Istanbul", dateStyle: "medium", timeStyle: "short" });
}

/**
 * Rapor iki odakta iki ayrı sırayla okunur (bkz. `FOCUS_OF`):
 * - Teknik: Kısaca → Fiyat Haritası → Teknik Görünüm → Senaryolar → Değerlendirme → Haberler.
 * - Hisse Seçimi: Kısaca → Şirket Karnesi → Değerlendirme → Senaryolar → Fiyat Haritası → Teknik Görünüm → Haberler.
 *
 * Kapak yatırımcının ilk üç sorusunu cevaplar: görüş ne, rapor hâlâ geçerli
 * mi (yaş, şu anki fiyatın tetiklere göre yeri), vade içinde olay riski var
 * mı (bilanço). Hepsi raporun kendi sayılarından; tavsiye değil, koşullu okuma.
 */
export function AnalysisReport({ result, t, locale, current, symbol, horizon, categoryNames, fresh = false }: {
  result: SavedAnalysis; t: Dictionary["aiAnalysis"]; locale: Locale; current?: CurrentQuote; symbol: string;
  horizon: "short" | "medium"; categoryNames: Record<string, string>;
  /** Film az önce bitti (`yeni=1`): kapak filmin son karesindeki mürekkep selinin çekilmesiyle açılır. */
  fresh?: boolean;
}) {
  const { output: o, snapshot: s } = result;
  const focus = FOCUS_OF[horizon];
  const price = (n: number | null | undefined) => formatPrice(n, locale, { currency: true });
  const reportPrice = result.quotePrice ?? s.price;
  const since = current && reportPrice ? (current.price / reportPrice - 1) * 100 : null;
  const status = current ? scenarioStatus(current.price, o.bullLevel, o.bearLevel) : null;
  const age = daysSince(result.generatedAt);
  const earningsIn = typeof result.fundamentals?.earningsInDays === "number" ? result.fundamentals.earningsInDays - age : null;
  const earningsInside = earningsIn !== null && earningsIn >= 0 && earningsIn <= HORIZON_DAYS[horizon];
  const cited = new Set(o.news.map(n => n.sourceIndex));
  const ring = o.verdict === "insufficient" ? "hold" : o.verdict;
  const readings = [
    [t.price, price(s.price)], [t.sma20, price(s.sma20)], [t.sma50, price(s.sma50)], [t.sma200, price(s.sma200)],
    ["RSI (14)", formatPrice(s.rsi14, locale)], ["MACD", formatPrice(s.macd?.macd, locale)],
    ["ATR (14)", price(s.atr14)], [t.support, `${price(s.pivots?.s1)} / ${price(s.pivots?.s2)}`],
    [t.resistance, `${price(s.pivots?.r1)} / ${price(s.pivots?.r2)}`], [t.lastSession, s.lastSession ?? "—"],
  ];
  const id = (part: string) => `ai-${part}`;

  const map = result.pricePath && <section key="map" aria-labelledby={id("map")} className={styles.chapter}>
    <ChapterHeading id={id("map")} title={t.priceMap} dek={`${t.now} ${price(reportPrice)}${typeof o.bullLevel === "number" ? ` · ${t.bull} ${price(o.bullLevel)}` : ""}${typeof o.bearLevel === "number" ? ` · ${t.bear} ${price(o.bearLevel)}` : ""}`} />
    <PriceMap result={result} t={t} locale={locale} />
  </section>;
  const measures = <section key="measures" aria-labelledby={id("measures")} className={styles.chapter}>
    <ChapterHeading id={id("measures")} title={t.measuresTitle} dek={`${t.coverage}: ${formatPercentPlain(result.screeningCoverage, locale)} · ${t.scoresHint}`} />
    <ScoreCards result={result} t={t} />
    <Reveal className={styles.technicalGrid}>
      <RsiDial result={result} t={t} locale={locale} />
      <div className={styles.technicalSide}><p className="plate">{t.trendTitle}</p><TrendChecks result={result} t={t} locale={locale} /></div>
      {result.pricePath && <div className={styles.technicalSide}><p className="plate">{t.returnsTitle}</p><ReturnBars result={result} t={t} locale={locale} /></div>}
    </Reveal>
  </section>;
  const scorecard = (result.categories?.length || result.fundamentals) ? <section key="scorecard" aria-labelledby={id("scorecard")} className={styles.chapter}>
    <ChapterHeading id={id("scorecard")} title={t.scorecard.title} dek={t.scorecard.dek} />
    <CompanyScorecard result={result} t={t} locale={locale} categoryNames={categoryNames} />
  </section> : null;
  const scenarios = <section key="scenarios" aria-labelledby={id("scenarios")} className={styles.chapter}>
    <ChapterHeading id={id("scenarios")} title={t.scenarios} dek={t.axisHint} />
    <Reveal><ScenarioAxis result={result} t={t} locale={locale} /></Reveal>
    <InView className={styles.scenarios} data-motion-stagger>
      {([["up", t.bull, o.bullScenario, o.bullLevel, t.triggerAbove], ["down", t.bear, o.bearScenario, o.bearLevel, t.triggerBelow]] as const).map(([tone, title, text, level, rule]) =>
        <div key={tone} className={styles.scenario} data-tone={tone}>
          <h3 data-ink="plain">{title}</h3>
          {typeof level === "number" && <p className={styles.trigger}>{t.trigger} · <span className="figure">{price(level)}</span> {rule}</p>}
          <p>{text}</p>
        </div>)}
    </InView>
    <Reveal className={styles.invalidation}><h3 data-ink="plain">{t.invalidation}</h3><p>{o.invalidation}</p></Reveal>
    {o.watch && o.watch.length > 0 && <Reveal className={styles.watchBlock}>
      <p className="plate">{t.watch}</p>
      <ol className={styles.watch}>{o.watch.map((item, i) => <li key={i}>{item}</li>)}</ol>
    </Reveal>}
  </section>;
  const reading = <section key="reading" aria-labelledby={id("reading")} className={styles.chapter}>
    <ChapterHeading id={id("reading")} title={t.evaluation} />
    <div className={styles.points} data-motion-stagger>
      {([["reasons", t.reasons, o.reasons], ["risks", t.risks, o.risks]] as const).map(([key, title, items]) => <div key={key} className={styles.pointsCard} data-kind={key}>
        <h3 data-ink="plain">{title}<span className="figure">{items.length}</span></h3>
        <ol>{items.map((item, i) => <li key={i}><span className={`figure ${styles.pointNo}`} aria-hidden>{i + 1}</span><p>{item}</p></li>)}</ol>
      </div>)}
    </div>
  </section>;
  const order = focus === "technical" ? [map, measures, scenarios, reading] : [scorecard, reading, scenarios, map, measures];

  return <article className={styles.report} aria-label={`${symbol} · ${t.saved} · ${analysisDate(result.generatedAt, locale)}`}>
    {/* ===== Kapak ===== */}
    <header className={styles.cover} data-verdict={o.verdict} data-fresh={fresh ? "" : undefined}>
      <div className={styles.coverVerdict}>
        <ScoreRing score={o.overallScore} verdict={ring} size={112} showDenominator className={styles.coverRing} />
        <div className={styles.coverWord}>
          <p className="plate">{t.coverLabel} · {focus === "technical" ? t.focus.technical : t.focus.selection} · {horizon === "short" ? t.short : t.medium}</p>
          {/* Karar harf harf yükselir, altına mürekkep fırçasıyla çizgi çekilir (filmin dili). */}
          <strong className={styles.verdict}>
            <KineticText text={t.verdicts[o.verdict]} delay={fresh ? 820 : 200} stagger={70} />
            <svg className={styles.verdictInk} viewBox="0 0 200 12" preserveAspectRatio="none" aria-hidden>
              <path d="M4 8.5 C 38 4, 82 10.5, 122 6.5 S 178 4.5, 196 7" pathLength={1} />
            </svg>
          </strong>
          <p className={styles.verdictMeaning}>{t.verdictMeaning[o.verdict]}</p>
          <ul className={styles.chips}>
            <li data-tone={focus === "technical" && age >= TECHNICAL_STALE_DAYS ? "warn" : undefined}>{age === 0 ? t.age.today : t.age.days.replace("{n}", String(age))}</li>
            {earningsIn !== null && earningsIn >= 0 && <li data-tone={earningsInside ? "warn" : undefined}>{t.earningsIn.replace("{n}", String(earningsIn))}{earningsInside ? ` · ${t.earningsInside}` : ""}</li>}
          </ul>
        </div>
      </div>
      <p className={styles.lead}>{o.summary}</p>
      <dl className={styles.coverFacts}>
        {o.confidence && <div>
          <dt>{t.confidence}</dt>
          <dd className={styles.confidence}>
            <span className={styles.meter} aria-hidden>{CONFIDENCE_STEPS.map((step, i) => <span key={step} data-on={i <= CONFIDENCE_STEPS.indexOf(o.confidence!) ? "" : undefined} style={{ "--i": i } as React.CSSProperties} />)}</span>
            {t.confidenceLevels[o.confidence]}
          </dd>
        </div>}
        {status && <div title={t.status.hint}>
          <dt>{t.status.label}</dt>
          <dd className={styles.status} data-status={status}>{t.status[status]}</dd>
        </div>}
        <div><dt>{t.reportPrice}</dt><dd className="figure">{price(reportPrice)}</dd></div>
        {since !== null && current && <div><dt>{t.sinceReport}</dt><dd className={styles.sinceValue}><span className="figure">{price(current.price)}</span><ChangePill changePct={since} locale={locale} size="sm" /></dd></div>}
      </dl>
      {focus === "technical" && age >= TECHNICAL_STALE_DAYS && <p className={styles.staleNote}>{t.age.stale}</p>}
    </header>

    {/* ===== Kısaca ===== */}
    {o.takeaways && o.takeaways.length > 0 && <section aria-labelledby={id("takeaways")} className={styles.takeawaysSection}>
      <p id={id("takeaways")} className="plate">{t.takeaways}</p>
      <InView as="ol" className={styles.takeaways} data-motion-stagger>
        {o.takeaways.map((line, i) => <li key={i} style={{ "--i": i } as React.CSSProperties}><span className={`figure ${styles.takeawayNo}`} aria-hidden>{i + 1}</span><p>{line}</p></li>)}
      </InView>
    </section>}

    {order}

    {/* ===== Haberler: kompakt; başlık raporun dilinde (model çevirir), özgünü ipucunda ===== */}
    <section aria-labelledby={id("news")} className={styles.chapter}>
      <ChapterHeading id={id("news")} title={t.citedNews} dek={result.newsFetchedAt ? `${t.newsFetched}: ${analysisDate(result.newsFetchedAt, locale)} · TR` : undefined} />
      {!result.newsAvailable && <p className={styles.hint}>{t.missingNews}</p>}
      {result.newsAvailable && !cited.size && <p className={styles.hint}>{t.noNews}</p>}
      <ul className={styles.sources} data-motion-stagger>{o.news.filter(n => result.sources[n.sourceIndex]).map(n => {
        const source = result.sources[n.sourceIndex];
        return <li key={n.sourceIndex}>
          <a href={source.url} target="_blank" rel="noopener noreferrer" title={n.title && n.title !== source.headline ? source.headline : undefined}>{n.title ?? source.headline}</a>
          <p className={styles.impact}>{n.impact}</p>
          <p className={styles.sourceMeta}>{source.source} · {analysisDate(source.publishedAt, locale)} · TR</p>
        </li>;
      })}</ul>
      <div className={styles.folds}>
        {result.sources.length > cited.size && <details className={styles.fold}>
          <summary>{t.otherNews} ({result.sources.length - cited.size})</summary>
          <ul className={styles.otherSources}>{result.sources.map((source, i) => !cited.has(i) && <li key={`${source.url}:${i}`}>
            <a href={source.url} target="_blank" rel="noopener noreferrer">{source.headline}</a>
            <span className={styles.sourceMeta}>{source.source} · {analysisDate(source.publishedAt, locale)}</span>
          </li>)}</ul>
        </details>}
        <details className={styles.fold}>
          <summary>{t.allIndicators}</summary>
          <dl className={styles.indicators}>{readings.map(([label, value]) => <div key={label}><dt>{label}</dt><dd className="figure">{value}</dd></div>)}</dl>
        </details>
      </div>
    </section>

    <footer className={styles.foot}>
      <p>{t.quote}: {analysisDate(result.quoteAt, locale)} · TR · {result.quoteSource} · {result.realtime ? t.realtime : t.delayed}</p>
      <p>{t.dataHint}</p><p>{t.disclaimer}</p>
    </footer>
  </article>;
}
