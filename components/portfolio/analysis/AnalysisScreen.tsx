import { Suspense, type CSSProperties } from "react";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { GuideHint } from "@/components/article/GuideHint";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { ScaleBar } from "@/components/markets/CompareScale";
import { DirectoryHeader } from "@/components/motion/DirectoryHeader";
import directory from "@/components/motion/DirectoryExperience.module.css";
import { MotionExperience, ScrollProgress } from "@/components/motion/PremiumMotion";
import { AnalysisNote } from "@/components/portfolio/analysis/AnalysisNote";
import {
  ButtonLink,
  DataStamp,
  EmptyState,
  FilterChip,
  Panel,
  PanelHeader,
  PanelSkeleton,
  Segment,
  SegmentItem,
} from "@/components/ui/primitives";
import { SECTOR_FUNDS } from "@/db/seed/symbols";
import { formatIsoDate, formatLira } from "@/lib/fx";
import { getI18n, type Dictionary, type Locale } from "@/lib/i18n";
import {
  getPortfolioAnalysis,
  getUserAnalysis,
  SECTOR_FUND_LIST,
  type AnalysisHolding,
  type PortfolioAnalysis,
} from "@/lib/portfolio-analysis";
import {
  DEFAULT_SCENARIO_WEIGHT,
  formatMeasure,
  isScenarioWeight,
  SCENARIO_WEIGHTS,
  scenarioOf,
  UNDERWEIGHT_GAP_PTS,
  type PortfolioRisk,
} from "@/lib/portfolio-risk";
import { sectorLabel } from "@/lib/sectors";
import { US_WITHHOLDING } from "@/lib/tax";
import { directionOf, formatPercent, formatPercentPlain, formatPrice, tieFigures } from "@/lib/utils";
import styles from "./Analysis.module.css";

/**
 * PORTFÖY ANALİZİ — /portfoy/analiz (24 Ekim, sahibinin isteği: "yapay
 * zekâ ile portföye sektör bazlı ekleme önerisi, portföy analizi, risk
 * dağıtma").
 *
 * AYRI ROTA, /portfoy'un içinde bölüm DEĞİL: /portfoy zaten dokuz panel ve
 * ilk baytı beklemeyen akışlı bir iş masası (PortfolioScreen.tsx). Bu ekran
 * her pozisyonun BİR YILLIK günlük barlarını, SPY'yi, on bir sektör fonunu
 * ve SPY'nin 500 satırlık içerik dosyasını istiyor; /portfoy'a girseydi
 * her açılışta bu yükü taşırdı. Portföyden tek bağlantıyla açılıyor.
 *
 * HUKUKİ ÇİZGİ (bağlayıcı): ekran ölçer, karşılaştırır, açıklar; "şu
 * hisseyi al" demez. "Ekleme önerisi" isteği şöyle karşılandı: eksik
 * sektörler S&P 500 ağırlıklarıyla karşılaştırılır, her birinin GENİŞ
 * sektör fonu ve endeksteki büyük şirketlerinden birkaçı "inceleyebileceğin
 * örnekler" olarak SEMBOLÜN ALFABE SIRASIYLA ve puansız listelenir; senaryo yalnız bir
 * HESAPtır. Her panelde "Yatırım Tavsiyesi Değildir" künyesi.
 *
 * Ekran sırası kurala göre: başlık → ana görsel (sektör dağılımı ve S&P
 * 500) → ölçü ızgarası (yoğunlaşma ve risk) → korelasyon, kur ve temettü,
 * bilanço haftaları → eksik sektörler ve senaryo → Claude'un metni →
 * damga → rehber.
 */

export type AnalysisSource = { userId: string } | { fixture: AnalysisHolding[] };

export async function AnalysisScreen({
  source,
  fund,
  weight,
  basePath = "/portfoy/analiz",
  noteEndpoint,
}: {
  source: AnalysisSource;
  fund: string | null;
  weight: number | null;
  basePath?: string;
  noteEndpoint?: string;
}) {
  const { locale, t } = await getI18n();
  const A = t.portfolioAnalysis;
  return (
    <MotionExperience className={directory.page}>
      <ScrollProgress />
      <DirectoryHeader title={A.title} description={A.description}>
        <div className="mt-4 flex flex-wrap gap-2">
          <ButtonLink href="/portfoy" variant="ghost">
            <ArrowLeft size={16} weight="bold" aria-hidden />
            {A.back}
          </ButtonLink>
        </div>
      </DirectoryHeader>

      <Suspense
        fallback={
          <>
            <PanelSkeleton rows={6} />
            <PanelSkeleton rows={3} />
          </>
        }
      >
        <AnalysisBody source={source} fund={fund} weight={weight} basePath={basePath} noteEndpoint={noteEndpoint} locale={locale} t={t} />
      </Suspense>

      <GuideHint label={t.guide.contextLabel} locale={locale} slugs={["cesitlendirme", "volatilite", "kur-riski"]} className="pt-1" />
    </MotionExperience>
  );
}

/* ------------------------------------------------------------ biçimler */

const pct = (value: number, locale: Locale) => formatPercentPlain(value, locale, 1);
const num = (value: number, locale: Locale, digits = 2) => formatMeasure(value, locale, digits);
const dateLong = (date: string, locale: Locale) => formatIsoDate(date, locale, "long");

function fill(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, String(value)), template);
}

async function AnalysisBody({
  source,
  fund,
  weight,
  basePath,
  noteEndpoint,
  locale,
  t,
}: {
  source: AnalysisSource;
  fund: string | null;
  weight: number | null;
  basePath: string;
  noteEndpoint?: string;
  locale: Locale;
  t: Dictionary;
}) {
  const A = t.portfolioAnalysis;
  let analysis: PortfolioAnalysis | null;
  let count: number;
  if ("userId" in source) {
    const loaded = await getUserAnalysis(source.userId);
    if (!loaded.ok) {
      return (
        <Panel>
          <EmptyState title={A.unavailableTitle} hint={A.unavailableBody} scene="mishap" />
        </Panel>
      );
    }
    analysis = loaded.analysis;
    count = loaded.count;
  } else {
    analysis = await getPortfolioAnalysis(source.fixture);
    count = source.fixture.length;
  }

  if (count === 0) {
    return (
      <Panel>
        <EmptyState
          title={A.emptyTitle}
          hint={A.emptyBody}
          scene="ledger"
          action={
            <ButtonLink href="/portfoy" variant="primary">
              {A.back}
            </ButtonLink>
          }
        />
      </Panel>
    );
  }
  const risk = analysis?.risk ?? null;
  if (!analysis || !risk) {
    return (
      <Panel>
        <EmptyState title={A.noDataTitle} hint={A.noDataBody} scene="mishap" />
      </Panel>
    );
  }

  const sessionLabel = fill(A.session, { date: dateLong(risk.session, locale) });
  const partial = risk.covered < risk.total ? fill(A.partial, { covered: risk.covered, total: risk.total }) : null;

  return (
    <>
      <SectorPanel risk={risk} analysis={analysis} locale={locale} A={A} meta={sessionLabel} partial={partial} />
      <RiskPanel risk={risk} locale={locale} A={A} partial={partial} />
      <CorrelationPanel risk={risk} locale={locale} A={A} />
      <div className={styles.pair}>
        <CurrencyPanel risk={risk} locale={locale} A={A} />
        <DividendPanel risk={risk} locale={locale} A={A} />
      </div>
      <EarningsPanel risk={risk} locale={locale} A={A} />
      <GapsPanel analysis={analysis} locale={locale} A={A} />
      <ScenarioPanel analysis={analysis} risk={risk} fund={fund} weight={weight} basePath={basePath} locale={locale} A={A} />
      <AnalysisNote locale={locale} labels={A.note} disclaimer={A.notAdvice} endpoint={noteEndpoint} />
      <DataStamp labels={t.data} source="Alpaca · State Street · TCMB" locale={locale} note={fill(A.stampNote, { date: dateLong(risk.session, locale) })} />
    </>
  );
}

type Labels = Dictionary["portfolioAnalysis"];

/* --------------------------------------------------------- ana görsel */

function SectorPanel({
  risk,
  analysis,
  locale,
  A,
  meta,
  partial,
}: {
  risk: PortfolioRisk;
  analysis: PortfolioAnalysis;
  locale: Locale;
  A: Labels;
  meta: string;
  partial: string | null;
}) {
  const L = A.sectors;
  const sectors = risk.sectors;
  const rows = sectors ? sectors.rows.filter((row) => row.portfolio > 0 || row.benchmark > 0) : [];
  const scale = Math.max(1, ...rows.flatMap((row) => [row.portfolio, row.benchmark]));
  /* Fark yarım puanın altındaysa "yakın": ondalık hassasiyet uydurmuyoruz. */
  const EVEN_PTS = 0.5;
  return (
    <Panel id="sektorler">
      <PanelHeader title={L.title} meta={meta} />
      <div className={styles.body}>
        {sectors ? (
          <>
            <ul className={styles.legend}>
              <li>
                <span className={styles.swatchBar} aria-hidden />
                {L.legendPortfolio}
              </li>
              <li>
                <span className={styles.swatchTick} aria-hidden />
                {L.legendBenchmark}
              </li>
            </ul>
            <ul className={styles.sectorList}>
              {rows.map((row, index) => {
                const diff = Math.abs(row.diff);
                const diffText =
                  diff < EVEN_PTS
                    ? L.even
                    : fill(row.diff > 0 ? L.heavier : L.lighter, { pts: formatPrice(diff, locale, { digits: 1 }) });
                return (
                  <li key={row.sector} className={styles.sectorRow}>
                    <span className={styles.sectorName}>{sectorLabel(row.sector, locale) ?? row.sector}</span>
                    <span className={styles.track} aria-hidden>
                      <span
                        className={styles.trackFill}
                        style={{ width: `${(row.portfolio / scale) * 100}%`, animationDelay: `${index * 40}ms` } as CSSProperties}
                      />
                      <span className={styles.trackTick} style={{ left: `${(row.benchmark / scale) * 100}%` }} />
                    </span>
                    <span className={`numeral ${styles.sectorFigures}`}>
                      <span className={styles.sectorShare}>{pct(row.portfolio, locale)}</span>
                      <span className={styles.sectorBench}>{tieFigures(`${L.legendBenchmark} ${pct(row.benchmark, locale)}`)}</span>
                      <span className={styles.sectorDiff}>{diffText}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <p className={styles.lead}>{L.unavailable}</p>
        )}
      </div>
      <div className={styles.notes}>
        {sectors && analysis.benchmark && <p>{fill(L.source, { date: dateLong(analysis.benchmark.asOf, locale) })}</p>}
        {sectors && sectors.unclassified > 0 && <p>{fill(L.unclassified, { share: pct(sectors.unclassified, locale) })}</p>}
        {partial && <p>{partial}</p>}
        <p>{A.notAdvice}</p>
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------- ölçü ızgarası */

function Metric({ label, value, sub, tone, mono }: { label: string; value: string; sub?: string; tone?: string; mono?: boolean }) {
  return (
    <div className={styles.metric}>
      <dt className={styles.metricLabel}>{label}</dt>
      {/* Açıklama etiketin altında, değer kutunun dibinde: açıklamaları
          farklı uzunlukta olsa da yan yana değerler aynı hatta biter. */}
      <dd className="contents">
        {sub && <span className={styles.metricSub}>{sub}</span>}
        <span className={`numeral ${styles.metricValue} ${mono ? styles.mono : ""}`} data-tone={tone}>
          {value}
        </span>
      </dd>
    </div>
  );
}

function RiskPanel({ risk, locale, A, partial }: { risk: PortfolioRisk; locale: Locale; A: Labels; partial: string | null }) {
  const L = A.concentration;
  const c = risk.concentration;
  const r = risk.risk;
  const missing = r ? risk.covered - r.covered : 0;
  return (
    <Panel id="risk">
      <PanelHeader title={L.title} />
      <div className={styles.body}>
        <dl className={styles.metrics}>
          <Metric
            label={L.largest}
            value={tieFigures(`${c.largest.symbol} ${pct(c.largest.weight, locale)}`)}
          />
          <Metric label={L.top5} value={pct(c.top5Share, locale)} />
          <Metric
            label={L.effective}
            value={num(c.effectiveCount, locale, 1)}
            sub={fill(L.effectiveHint, { count: c.count, effective: num(c.effectiveCount, locale, 1) })}
          />
          {r && (
            <>
              <Metric
                label={L.volatility}
                value={pct(r.volatility, locale)}
                sub={fill(L.vsBenchmark, { value: pct(r.benchmarkVolatility, locale) })}
              />
              <Metric label={L.beta} value={num(r.beta, locale)} sub={L.betaHint} />
              <Metric
                label={L.drawdown}
                value={formatPercent(r.maxDrawdown.depth, locale, 1)}
                tone={directionOf(r.maxDrawdown.depth)}
                sub={fill(L.vsBenchmark, { value: formatPercent(r.benchmarkMaxDrawdown, locale, 1) })}
              />
            </>
          )}
        </dl>
      </div>
      <div className={styles.notes}>
        {r ? (
          <p>
            {fill(L.window, { start: dateLong(r.start, locale), end: dateLong(r.end, locale), sessions: r.sessions })}
          </p>
        ) : (
          <p>{L.riskUnavailable}</p>
        )}
        {r && missing > 0 && <p>{fill(L.riskPartial, { covered: r.covered, missing })}</p>}
        <p>{fill(L.hhi, { hhi: num(c.hhi, locale, 3) })}</p>
        {partial && <p>{partial}</p>}
      </div>
    </Panel>
  );
}

/* --------------------------------------------------------- korelasyon */

function CorrelationPanel({ risk, locale, A }: { risk: PortfolioRisk; locale: Locale; A: Labels }) {
  const L = A.correlation;
  const c = risk.correlation;
  const list = (pairs: NonNullable<typeof c>["top"]) => (
    <ul className={styles.pairList}>
      {pairs.map((pair) => (
        <li key={`${pair.a}-${pair.b}`} className={styles.pairRow}>
          <span className={`${styles.pairNames} ${styles.mono}`}>
            {pair.a} · {pair.b}
          </span>
          <span className={`numeral ${styles.pairValue}`}>{num(pair.value, locale)}</span>
          <ScaleBar ratio={pair.value} signed className="max-w-none" />
        </li>
      ))}
    </ul>
  );
  return (
    <Panel id="korelasyon">
      <PanelHeader
        title={L.title}
        meta={c ? tieFigures(`${L.average} ${num(c.average, locale)}`) : undefined}
      />
      <div className={styles.body}>
        <p className={styles.lead}>{L.hint}</p>
        {c ? (
          <div className={styles.pairGroups}>
            <div>
              <p className={styles.groupTitle}>{L.most}</p>
              {list(c.top)}
            </div>
            {c.low.length > 0 && (
              <div>
                <p className={styles.groupTitle}>{L.least}</p>
                {list(c.low)}
              </div>
            )}
          </div>
        ) : (
          <p className={styles.lead}>{L.single}</p>
        )}
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------ kur ve temettü */

function CurrencyPanel({ risk, locale, A }: { risk: PortfolioRisk; locale: Locale; A: Labels }) {
  const L = A.currency;
  const fx = risk.fx;
  return (
    <Panel id="kur">
      <PanelHeader title={L.title} />
      <div className={styles.body}>
        {fx ? (
          /* Her ölçünün altında aynı pencerenin S&P 500'ü (25 Ekim): lira
             getirisinin büyük kısmı kurdan geliyor ve bu portföye özgü
             değil; eş sayı olmadan "+%88" portföyün başarısı gibi okunuyordu.
             Kur kartının altı da kurun iki ucu. Üç kart da alt satırlı:
             1280'de Kur ile Temettü panelleri 202 ve 242 pikseldi, kartlar
             eşit boya geldi. */
          <dl className={styles.metrics} data-cols="3">
            <Metric
              label={L.usd}
              value={formatPercent(fx.returnUsd, locale, 1)}
              tone={directionOf(fx.returnUsd)}
              sub={fill(A.concentration.vsBenchmark, { value: formatPercent(fx.benchmarkUsd, locale, 1) })}
            />
            <Metric
              label={L.tl}
              value={formatPercent(fx.returnTl, locale, 1)}
              tone={directionOf(fx.returnTl)}
              sub={fill(A.concentration.vsBenchmark, { value: formatPercent(fx.benchmarkTl, locale, 1) })}
            />
            <Metric
              label={L.rate}
              value={formatPercent(fx.fxChange, locale, 1)}
              sub={fill(L.rateRange, { start: num(fx.rateStart, locale), end: num(fx.rateEnd, locale) })}
            />
          </dl>
        ) : (
          <p className={styles.lead}>{L.unavailable}</p>
        )}
      </div>
      {fx && (
        <div className={styles.notes}>
          <p>{L.hint}</p>
        </div>
      )}
    </Panel>
  );
}

function DividendPanel({ risk, locale, A }: { risk: PortfolioRisk; locale: Locale; A: Labels }) {
  const L = A.dividends;
  const d = risk.dividends;
  return (
    <Panel id="temettu">
      <PanelHeader title={L.title} />
      <div className={styles.body}>
        {!d ? (
          <p className={styles.lead}>{L.unavailable}</p>
        ) : d.payers === 0 ? (
          <p className={styles.lead}>{L.none}</p>
        ) : (
          <dl className={styles.metrics} data-cols="2">
            <Metric
              label={L.annual}
              value={formatPrice(d.annualUsd, locale, { currency: true })}
              sub={d.annualTl === null ? undefined : formatLira(d.annualTl, locale)}
            />
            <Metric label={L.yield} value={pct(d.yieldPct, locale)} sub={fill(L.payers, { n: d.payers })} />
          </dl>
        )}
      </div>
      {d && d.payers > 0 && (
        <div className={styles.notes}>
          <p>{fill(L.hint, { withholding: US_WITHHOLDING.w8ben })}</p>
        </div>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------ bilanço haftası */

function EarningsPanel({ risk, locale, A }: { risk: PortfolioRisk; locale: Locale; A: Labels }) {
  const L = A.earnings;
  const weeks = risk.earnings.weeks;
  const heaviest = Math.max(0, ...weeks.map((week) => week.weight));
  return (
    <Panel id="bilancolar">
      <PanelHeader title={L.title} />
      <div className={styles.body}>
        {weeks.length === 0 ? (
          <p className={styles.lead}>{L.none}</p>
        ) : (
          <>
            <p className={styles.lead}>{L.hint}</p>
            <ul className={styles.weeks}>
              {weeks.map((week) => (
                <li key={week.weekStart} className={styles.week}>
                  <span className={styles.weekName}>{fill(L.week, { date: dateLong(week.weekStart, locale) })}</span>
                  <span className={`numeral ${styles.weekShare}`}>{tieFigures(fill(L.weight, { share: pct(week.weight, locale) }))}</span>
                  <ul className={styles.chips}>
                    {week.symbols.map((symbol) => (
                      <li key={symbol}>
                        <Link href={`/hisse/${symbol}`} className={styles.chip}>
                          <b>{symbol}</b>
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <ScaleBar ratio={heaviest > 0 ? week.weight / heaviest : 0} signed={false} className="col-span-full max-w-none" />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------ eksik sektörler */

function GapsPanel({ analysis, locale, A }: { analysis: PortfolioAnalysis; locale: Locale; A: Labels }) {
  const L = A.gaps;
  const gaps = analysis.gaps;
  if (!analysis.risk?.sectors) return null;
  return (
    <Panel id="eksik-sektorler">
      <PanelHeader title={L.title} />
      <div className={styles.body}>
        {gaps.length === 0 ? (
          <p className={styles.lead}>{fill(L.none, { pts: UNDERWEIGHT_GAP_PTS })}</p>
        ) : (
          <>
            <p className={styles.lead}>{fill(L.hint, { pts: UNDERWEIGHT_GAP_PTS })}</p>
            <ul className={styles.gaps}>
              {gaps.map((gap) => (
                <li key={gap.sector} className={styles.gap}>
                  <div className={styles.gapHead}>
                    <h3 className={styles.gapName}>{sectorLabel(gap.sector, locale) ?? gap.sector}</h3>
                    <p className={`numeral ${styles.gapRow}`}>
                      {tieFigures(fill(L.row, { portfolio: pct(gap.portfolio, locale), benchmark: pct(gap.benchmark, locale) }))}
                    </p>
                  </div>
                  {gap.fund && (
                    <div>
                      <p className={styles.gapLabel}>{L.fund}</p>
                      <ul className={styles.chips}>
                        <li>
                          <Link href={`/hisse/${gap.fund}`} className={styles.chip}>
                            <b>{gap.fund}</b>
                            {fundName(gap.fund, locale)}
                          </Link>
                        </li>
                      </ul>
                    </div>
                  )}
                  {gap.examples.length > 0 && (
                    <div>
                      <p className={styles.gapLabel}>{L.examples}</p>
                      <ul className={styles.chips}>
                        {gap.examples.map((example) => (
                          <li key={example.symbol}>
                            <Link href={`/hisse/${example.symbol}`} className={styles.chip}>
                              <b>{example.symbol}</b>
                              {example.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      <div className={styles.notes}>
        <p>{A.notAdvice}</p>
      </div>
    </Panel>
  );
}

function fundName(symbol: string, locale: Locale): string {
  const fund = SECTOR_FUNDS.find((item) => item.symbol === symbol);
  return fund ? (locale === "en" ? fund.nameEn : fund.nameTr) : symbol;
}

/* ------------------------------------------------------------ senaryo */

function ScenarioPanel({
  analysis,
  risk,
  fund,
  weight,
  basePath,
  locale,
  A,
}: {
  analysis: PortfolioAnalysis;
  risk: PortfolioRisk;
  fund: string | null;
  weight: number | null;
  basePath: string;
  locale: Locale;
  A: Labels;
}) {
  const L = A.scenario;
  /* Seçim adresten (`?fon=XLV&agirlik=10`); yoksa en eksik sektörün fonu. */
  const gapFunds = analysis.gaps.map((gap) => gap.fund).filter((symbol): symbol is string => symbol !== null);
  const chosen =
    SECTOR_FUND_LIST.find((item) => item.symbol === fund) ??
    SECTOR_FUND_LIST.find((item) => item.symbol === gapFunds[0]) ??
    SECTOR_FUND_LIST[0]!;
  const add = weight !== null && isScenarioWeight(weight) ? weight : DEFAULT_SCENARIO_WEIGHT;
  const scenario = scenarioOf(analysis.input, risk, chosen, add);
  const order = [
    ...gapFunds,
    ...SECTOR_FUND_LIST.map((item) => item.symbol).filter((symbol) => !gapFunds.includes(symbol)),
  ];
  const href = (symbol: string, value: number) => `${basePath}?fon=${symbol}&agirlik=${value}#senaryo`;
  const sector = sectorLabel(chosen.sector, locale) ?? chosen.sector;
  /* Önce → sonra + aradaki fark (`oncesi` bloğunun dili, 25 Ekim): fark
     ekranda hesaplanmazsa okur beş satırda iki sayıyı kafadan çıkarıyordu.
     Fark bir BÜYÜKLÜK, yargı değil: oynaklığın düşmesi "iyi" diye
     boyanmaz (CompareScale'in kuralı), renk nötr. Yüzde satırlarında fark
     puan; yuvarlanınca sıfırsa basılmaz. */
  const measure = (label: string, pick: (side: NonNullable<typeof scenario>["before"]) => number, kind: "pct" | "num" | "num1") => {
    if (!scenario) return null;
    const before = pick(scenario.before);
    const after = pick(scenario.after);
    const digits = kind === "num" ? 2 : 1;
    const show = (value: number) => (kind === "pct" ? pct(value, locale) : num(value, locale, digits));
    const delta = Number((after - before).toFixed(digits));
    const signedDelta = delta > 0 ? `+${num(delta, locale, digits)}` : num(delta, locale, digits);
    return {
      label,
      before: show(before),
      after: show(after),
      delta: delta === 0 ? null : kind === "pct" ? fill(L.deltaPts, { value: signedDelta }) : signedDelta,
    };
  };
  const rows = scenario
    ? [
        measure(L.volatility, (side) => side.volatility, "pct"),
        measure(L.beta, (side) => side.beta, "num"),
        measure(fill(L.sectorShare, { sector }), (side) => side.sectorShare, "pct"),
        measure(L.effective, (side) => side.effectiveCount, "num1"),
        measure(L.largest, (side) => side.largestWeight, "pct"),
      ].filter((row) => row !== null)
    : [];
  return (
    <Panel id="senaryo">
      <PanelHeader title={L.title} />
      <div className={styles.body}>
        <p className={styles.lead}>{L.hint}</p>
        <div className={styles.controls}>
          <div className={styles.controlRow} role="group" aria-label={L.fund}>
            <span className={styles.controlLabel}>{L.fund}</span>
            {order.map((symbol) => (
              <FilterChip key={symbol} href={href(symbol, add)} active={symbol === chosen.symbol}>
                {`${symbol} · ${fundName(symbol, locale)}`}
              </FilterChip>
            ))}
          </div>
          <div className={styles.controlRow}>
            <span className={styles.controlLabel}>{L.weight}</span>
            <Segment label={L.weight}>
              {SCENARIO_WEIGHTS.map((value) => (
                <SegmentItem key={value} href={href(chosen.symbol, value)} active={value === add}>
                  {formatPercentPlain(value, locale, 0)}
                </SegmentItem>
              ))}
            </Segment>
          </div>
        </div>
        {scenario ? (
          <table className={styles.compare}>
            <thead>
              <tr>
                <td />
                <th scope="col">{L.before}</th>
                <th scope="col">{`${L.after} (${chosen.symbol})`}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  <td className="numeral">{row.before}</td>
                  <td className="numeral" data-after>
                    <span className={styles.afterCell}>
                      {row.delta && <span className={styles.delta}>{tieFigures(row.delta)}</span>}
                      <span>{row.after}</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className={styles.lead}>{L.unavailable}</p>
        )}
      </div>
      <div className={styles.notes}>
        {scenario && <p>{L.note}</p>}
        <p>{A.notAdvice}</p>
      </div>
    </Panel>
  );
}
