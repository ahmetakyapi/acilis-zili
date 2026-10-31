import { Suspense, type CSSProperties, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, ChartPieSlice, Pulse, SquaresFour } from "@phosphor-icons/react/dist/ssr";
import { GuideHint } from "@/components/article/GuideHint";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { DirectoryHeader } from "@/components/motion/DirectoryHeader";
import { FoldToggle } from "@/components/ui/FoldToggle";
import directory from "@/components/motion/DirectoryExperience.module.css";
import { MotionExperience, ScrollProgress } from "@/components/motion/PremiumMotion";
import { AnalysisNote } from "@/components/portfolio/analysis/AnalysisNote";
import { CorrelationHeat, type HeatCell } from "@/components/portfolio/analysis/CorrelationHeat";
import { PanelFill } from "@/components/portfolio/analysis/PanelFill";
import {
  composeAnalysisFacts,
  effectivePips,
  heaviestSector,
  type LeadFact,
  pairScale,
  clamp01,
  ratioTo,
  sectorBoard,
  weightStrip,
} from "@/components/portfolio/analysis/analysis-visuals";
import {
  ButtonLink,
  DataStamp,
  EmptyState,
  FilterChip,
  LogoTile,
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
 * KART PANOSU (25 Ekim, sahibinin isteği: "bu kadar yatayda büyük kart
 * yerine yan yana kartlar ve detaylar; kullanıcı daha çok şeyi kaydırmadan
 * görüp ulaşabilsin, daha görsel olsun"). Ekran sırası kurala göre: kompakt
 * başlık bandı (tepe cümlesi içinde) → Temel Ölçüler (künye şeridi gibi
 * beş kart) → sektör dağılımı (ana görsel) ile yoğunlaşma ve bilanço
 * haftaları yan yana → korelasyon ile kur ve temettü yan yana → eksik
 * sektörler → senaryo → Claude'un metni → damga → rehber.
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
  return (
    <MotionExperience className={directory.page}>
      <ScrollProgress />
      {/* Bant hem bekleme karesinde hem sonuçta aynı: başlık ilk baytta
          gelir, tepe cümlesinin yeri iskeletle tutulur (cümle ölçülerden
          kurulduğu için verinin arkasında). */}
      <Suspense
        fallback={
          <>
            <AnalysisHeader t={t} footer={<span className={styles.leadSkeleton} aria-hidden />} />
            {/* İskelet en az bir ekran boyu: kısa kalınca alttaki rehber
                bloğu 1920×1080'de ilk ekrana giriyor, veri gelince aşağı
                itiliyordu (CLS 0,07-0,14, ölçüldü). Pano bu boydan uzun. */}
            <div className={styles.boardSkeleton}>
              <PanelSkeleton rows={3} />
              <PanelSkeleton rows={6} />
            </div>
          </>
        }
      >
        <AnalysisBody source={source} fund={fund} weight={weight} basePath={basePath} noteEndpoint={noteEndpoint} locale={locale} t={t} />
      </Suspense>

      <GuideHint label={t.guide.contextLabel} locale={locale} slugs={["cesitlendirme", "volatilite", "kur-riski"]} className="pt-1" />
    </MotionExperience>
  );
}

/**
 * KOMPAKT BAŞLIK BANDI (25 Ekim, sahibinin isteği: "bu kadar yatayda büyük
 * kart yerine yan yana kartlar; kullanıcı daha çok şeyi kaydırmadan
 * görsün"). Eski kapak 1440'ta 238 piksel yer tutuyordu: dev başlık, iki
 * satır açıklama, ayrı satırda "Portföye Dön" ve sağda boş dekor yayları;
 * tepe cümlesi kartın DIŞINDA iki satır daha. Artık tek bant: başlık,
 * yanında tek satırlık açıklama, sağda küçük buton; tepe cümlesi bandın alt
 * satırında, saç teliyle ayrılmış (DirectoryHeader `compact` + `footer`).
 */
function AnalysisHeader({ t, footer }: { t: Dictionary; footer?: ReactNode }) {
  const A = t.portfolioAnalysis;
  return (
    <DirectoryHeader title={A.title} description={t.portfolioAnalysisVisuals.board.description} compact footer={footer}>
      <ButtonLink href="/portfoy" variant="ghost" size="sm">
        <ArrowLeft size={14} weight="bold" aria-hidden />
        {A.back}
      </ButtonLink>
    </DirectoryHeader>
  );
}

const FACT_ICON = { sector: ChartPieSlice, spread: SquaresFour, volatility: Pulse } as const;

/**
 * Kısa okumalar: en fazla üç cümle, 1100 ve üstünde yan yana üç sütun,
 * altında alt alta. İkon cümlenin konusunu söyler (sektör, dağılım,
 * oynaklık) ve aşağıdaki ölçü kartlarının sırasıyla aynı; sayı ve ad
 * kalın, gerisi gövde tonunda. Bölüm adı (`aria-label`) ekran okuyucu için.
 */
function LeadFacts({ facts, label }: { facts: LeadFact[]; label: string }) {
  return (
    <section aria-label={label}>
      <ul className={styles.facts} data-count={facts.length} data-motion-stagger>
        {facts.map((fact) => {
          const Icon = FACT_ICON[fact.key];
          return (
            <li key={fact.key} className={styles.fact}>
              <span className={styles.factIcon} aria-hidden>
                <Icon size={16} weight="duotone" />
              </span>
              <p>
                {fact.parts.map((part, index) =>
                  part.strong ? (
                    <b key={index} className="numeral">
                      {tieFigures(part.text)}
                    </b>
                  ) : (
                    <span key={index}>{part.text}</span>
                  ),
                )}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
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
  const V = t.portfolioAnalysisVisuals;
  let analysis: PortfolioAnalysis | null;
  let count: number;
  if ("userId" in source) {
    const loaded = await getUserAnalysis(source.userId);
    if (!loaded.ok) {
      return (
        <>
          <AnalysisHeader t={t} />
          <Panel>
            <EmptyState title={A.unavailableTitle} hint={A.unavailableBody} scene="mishap" />
          </Panel>
        </>
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
      <>
        <AnalysisHeader t={t} />
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
      </>
    );
  }
  const risk = analysis?.risk ?? null;
  if (!analysis || !risk) {
    return (
      <>
        <AnalysisHeader t={t} />
        <Panel>
          <EmptyState title={A.noDataTitle} hint={A.noDataBody} scene="mishap" />
        </Panel>
      </>
    );
  }

  const sessionLabel = fill(A.session, { date: dateLong(risk.session, locale) });
  const partial = risk.covered < risk.total ? fill(A.partial, { covered: risk.covered, total: risk.total }) : null;
  const C = A.concentration;
  const r = risk.risk;
  const missing = r ? risk.covered - r.covered : 0;
  /* Risk ölçülerinin künyesi (pencere, eksik pozisyon) bandın alt satırında,
     cümlenin hemen altında: cümle de, hemen alttaki ölçü kartları da bu
     pencereden. Eski "Yoğunlaşma ve Risk" panelinin künyesiydi; kartlar
     panelsiz şeride geçince künye kartı aynı bilgiyle 1440'ta 100 piksel
     ayrı yer tutuyordu. */
  const riskNotes = [
    r ? fill(C.window, { start: dateLong(r.start, locale), end: dateLong(r.end, locale), sessions: r.sessions }) : C.riskUnavailable,
    r && missing > 0 ? fill(C.riskPartial, { covered: r.covered, missing }) : null,
    partial,
  ].filter((note): note is string => note !== null);

  const facts = composeAnalysisFacts(
    {
      count: risk.concentration.count,
      effective: risk.concentration.effectiveCount,
      largest: risk.concentration.largest,
      sector: risk.sectors ? heaviestSector(risk.sectors.rows) : null,
      volatility: risk.risk ? { portfolio: risk.risk.volatility, benchmark: risk.risk.benchmarkVolatility } : null,
    },
    V.lead,
    {
      percent: (value) => pct(value, locale),
      measure: (value, digits) => num(value, locale, digits),
      sector: (key) => sectorLabel(key, locale) ?? key,
    },
  );

  return (
    <>
      {/* TEPEDEKİ KISA OKUMALAR (31 Ekim; 25 Ekim'de tek cümleydi).
          Ölçülerden kurulur, yorum değil (composeAnalysisFacts, testli).
          Bandın alt satırında: üç kısa cümle yan yana, her biri ikonla ve
          sayısı kalın. Hesap künyesi (seans, pencere, eksik pozisyon) her
          genişlikte "Nasıl Hesaplanır" katında (FoldToggle, JS'siz): eski
          düzende kalın cümlenin altında 12 piksellik gri paragraftı,
          okunmuyordu. */}
      <AnalysisHeader
        t={t}
        footer={
          <div className={styles.leadBlock}>
            <LeadFacts facts={facts} label={V.lead.label} />
            <FoldToggle id="analiz-hesap-notu" hiddenCount={1} more={V.board.notesMore} less={V.board.notesLess} narrow={false}>
              <div className={styles.method}>
                <p data-fold className={styles.leadNote}>
                  {`${sessionLabel}. ${riskNotes.join(" ")} ${V.lead.note}`}
                </p>
              </div>
            </FoldToggle>
          </div>
        }
      />
      {/* KART PANOSU. Sıra ekran düzeni kuralının sırası: ölçü kartları
          (künye şeridi gibi en üstte), ana görsel (sektör), yanında
          yoğunlaşma; sonra korelasyon, kur, bilanço, eksik sektörler ve
          senaryo. 1100 ve üstünde iki kolon (7:5); bilanço haftaları,
          eksik sektörler ve senaryo tam genişlik. Dar ekranda tek kolon,
          aynı sıra. Ölçüm Analysis.module.css → `.board`. */}
      <div className={styles.board}>
        <KeyStrip risk={risk} locale={locale} A={A} V={V} />
        <SectorPanel risk={risk} analysis={analysis} locale={locale} A={A} V={V} partial={partial} />
        <ConcentrationPanel risk={risk} names={analysis.names} locale={locale} A={A} V={V} />
        <CorrelationPanel risk={risk} locale={locale} A={A} V={V} />
        <div className={styles.stack} data-area="money">
          <CurrencyPanel risk={risk} locale={locale} A={A} />
          <DividendPanel risk={risk} locale={locale} A={A} />
        </div>
        <EarningsPanel risk={risk} locale={locale} A={A} />
        <GapsPanel analysis={analysis} locale={locale} A={A} />
        <ScenarioPanel analysis={analysis} risk={risk} fund={fund} weight={weight} basePath={basePath} locale={locale} A={A} V={V} />
      </div>
      <PanelFill />
      <AnalysisNote locale={locale} labels={A.note} disclaimer={A.notAdvice} endpoint={noteEndpoint} />
      <DataStamp labels={t.data} source="Alpaca · State Street · TCMB" locale={locale} note={fill(A.stampNote, { date: dateLong(risk.session, locale) })} />
    </>
  );
}

type Labels = Dictionary["portfolioAnalysis"];
type VisualLabels = Dictionary["portfolioAnalysisVisuals"];

/* ------------------------------------------------------- ölçü kartları */

function Metric({
  label,
  value,
  aside,
  sub,
  tone,
  mono,
  visual,
  card,
}: {
  label: string;
  value: string;
  /** Değerin yanında küçük künye ("6,7 Kat"): aynı ölçünün başka okunuşu. */
  aside?: string;
  sub?: string;
  tone?: string;
  mono?: boolean;
  /** Sayının altındaki çizim (kulvar, eş çizgi, halka) — sayının kopyası, aria-hidden. */
  visual?: ReactNode;
  /** Sayfa zemininde duran kart (künye şeridi): sitenin kartı, gömük ton değil. */
  card?: boolean;
}) {
  return (
    <div className={card ? `panel ${styles.metric} ${styles.keyCard}` : styles.metric}>
      <dt className={styles.metricLabel}>{label}</dt>
      {/* Açıklama etiketin altında, değer kutunun dibinde: açıklamaları
          farklı uzunlukta olsa da yan yana değerler aynı hatta biter.
          Çizim değerin ALTINDA ve her kartta aynı yükseklikte (iki
          kulvarlık yer): değerler yine aynı hatta biter. */}
      <dd className="contents">
        {sub && <span className={styles.metricSub}>{sub}</span>}
        <span className={styles.metricValueRow}>
          <span className={`numeral ${styles.metricValue} ${mono ? styles.mono : ""}`} data-tone={tone}>
            {value}
          </span>
          {aside && <span className={`numeral ${styles.metricAside}`}>{tieFigures(aside)}</span>}
        </span>
        {visual && (
          <span aria-hidden className={styles.metricVisual}>
            {visual}
          </span>
        )}
      </dd>
    </div>
  );
}

/**
 * Tek kulvar: büyüklük çizgisi (nötr) ya da yönlü çizgi (`tone`). Kulvar
 * `--line-soft`, şerit `var(--lane-h, 5px)` — sitenin ince grafik dili
 * (CLAUDE.md "Grafik dili ince"). `tick`: aynı ölçekte bir gösterge çentiği
 * (betada S&P 500 = 1).
 */
function Lane({ ratio, tone, tick, faint }: { ratio: number; tone?: "up" | "down"; tick?: number; faint?: boolean }) {
  return (
    <span className={styles.lane} data-motion-track>
      <span
        className={styles.laneFill}
        data-tone={tone}
        data-faint={faint || undefined}
        data-motion-draw="line"
        style={{ width: `${clamp01(ratio) * 100}%`, transformOrigin: "left center" }}
      />
      {tick !== undefined && <span className={styles.laneTick} style={{ left: `${clamp01(tick) * 100}%` }} />}
    </span>
  );
}

/**
 * Portföy ve S&P 500 AYNI ölçekte, alt alta iki kulvar. Sayı kartın büyük
 * değeri ve alt satırı; çizgi "endeksin kaç katı" sorusunu okutmadan
 * cevaplıyor. Renk işaretten: düşüş derinliği eksi → `down`; oynaklık ve
 * beta yönsüz büyüklük → nötr (CompareScale'in kuralı).
 */
function PairLanes({
  portfolio,
  benchmark,
  labels,
  tone,
  floor = 0,
  tick,
}: {
  portfolio: number;
  benchmark: number;
  labels: VisualLabels["compare"];
  tone?: "down";
  floor?: number;
  /** Ölçek üzerinde gösterge değeri (betada 1). */
  tick?: number;
}) {
  const scale = pairScale(portfolio, benchmark, floor);
  const tickAt = tick !== undefined && scale.max > 0 ? tick / scale.max : undefined;
  return (
    <span className={styles.pairLanes}>
      <span className={styles.pairLane}>
        <span className={styles.pairLaneLabel}>{labels.portfolio}</span>
        <Lane ratio={scale.a} tone={tone} tick={tickAt} />
      </span>
      <span className={styles.pairLane}>
        <span className={styles.pairLaneLabel}>{labels.benchmark}</span>
        <Lane ratio={scale.b} tone={tone} tick={tickAt} faint />
      </span>
    </span>
  );
}


/**
 * Etkin pozisyon KUTULARI (31 Ekim; 25 Ekim'de halkaydı). Halka "etkin /
 * toplam" oranını çiziyordu; yoğun portföyde ince bir yay kalıyor ve kart
 * boş görünüyordu (sahibinin itirazı). Şimdi her pozisyon bir kutu, etkin
 * sayı kadarı dolu, kesir son kutuda kısmi dolgu (`effectivePips`, testli):
 * "5 kutunun 2,7'si dolu" okumadan görülür. Ton büyüklüğün yumuşak mavisi
 * (`--bar-soft`): dağınıklık bir yargı değil, yön rengi almaz. Kutular
 * soldan sırayla dolar (`data-motion-draw`), hareketi azaltana son kare.
 * Pozisyon sayısı `PIP_MAX`'ı aşarsa aynı oran tek kulvarda.
 */
function EffectivePips({ count, effective }: { count: number; effective: number }) {
  const pips = effectivePips(count, effective);
  if (!pips) return <Lane ratio={count > 0 ? effective / count : 0} />;
  return (
    <span className={styles.pips} data-motion-track>
      {pips.map((fill, index) => (
        <span key={index} className={styles.pip}>
          {fill > 0 && (
            <span
              className={styles.pipFill}
              data-motion-draw="line"
              style={{ width: `${fill * 100}%`, transformOrigin: "left center" }}
            />
          )}
        </span>
      ))}
    </span>
  );
}

/** Beta ölçeğinin tabanı: ölçek hiçbir zaman 1,5'in altına inmez, 1 çentiği hep içeride. */
const BETA_FLOOR = 1.5;

/**
 * TEMEL ÖLÇÜLER — panonun künye şeridi (25 Ekim, kart panosu). Eski
 * düzende bu sayılar "Yoğunlaşma ve Risk" panelinin altı kartıydı ve
 * 1440'ta sayfanın 1,7 ekran aşağısında başlıyordu; tepede on bir satırlık
 * sektör paneli duruyordu. Şimdi bandın hemen altında yan yana beş kart
 * (ekran düzeninde künye şeridinin yeri): en ağır sektör, etkin pozisyon
 * sayısı (kutu dizisi, 31 Ekim), oynaklık, beta ve en büyük düşüş. Etkin pozisyon dışında
 * her kart portföyü ve S&P 500'ü AYNI ölçekte iki kulvarla gösteriyor;
 * sayılar eski panelin aynısı, aynı kaynaktan. Kartlar panelsiz (Günün
 * Grafiği panosunun künye kartları gibi); başlık ekran okuyucu için.
 * Künyesi (hesap penceresi) bandın alt satırında, cümlenin altında.
 */
function KeyStrip({ risk, locale, A, V }: { risk: PortfolioRisk; locale: Locale; A: Labels; V: VisualLabels }) {
  const L = A.concentration;
  const c = risk.concentration;
  const r = risk.risk;
  const top = risk.sectors ? heaviestSector(risk.sectors.rows) : null;
  const ratio = r ? ratioTo(r.volatility, r.benchmarkVolatility) : null;
  const cards = 1 + (top ? 1 : 0) + (r ? 3 : 0);
  return (
    <section id="risk" data-area="keys" aria-labelledby="analiz-olculer" className={styles.keyStrip}>
      <h2 id="analiz-olculer" className="sr-only">
        {V.board.keysTitle}
      </h2>
      <dl className={`${styles.metrics} ${styles.keys}`} data-count={cards} data-motion-stagger>
        {top && (
          <Metric
            card
            label={V.board.heaviest}
            value={pct(top.portfolio, locale)}
            sub={sectorLabel(top.key, locale) ?? top.key}
            visual={<PairLanes portfolio={top.portfolio} benchmark={top.benchmark} labels={V.compare} />}
          />
        )}
        <Metric
          card
          label={L.effective}
          value={num(c.effectiveCount, locale, 1)}
          aside={`/ ${c.count}`}
          sub={fill(V.board.effectiveSub, { count: c.count })}
          visual={<EffectivePips count={c.count} effective={c.effectiveCount} />}
        />
        {r && (
          <>
            <Metric
              card
              label={L.volatility}
              value={pct(r.volatility, locale)}
              aside={ratio !== null ? fill(V.board.ratio, { ratio: num(ratio, locale, 1) }) : undefined}
              sub={fill(L.vsBenchmark, { value: pct(r.benchmarkVolatility, locale) })}
              visual={<PairLanes portfolio={r.volatility} benchmark={r.benchmarkVolatility} labels={V.compare} />}
            />
            <Metric
              card
              label={L.beta}
              value={num(r.beta, locale)}
              sub={L.betaHint}
              visual={<PairLanes portfolio={r.beta} benchmark={1} labels={V.compare} floor={BETA_FLOOR} tick={1} />}
            />
            <Metric
              card
              label={L.drawdown}
              value={formatPercent(r.maxDrawdown.depth, locale, 1)}
              tone={directionOf(r.maxDrawdown.depth)}
              sub={fill(L.vsBenchmark, { value: formatPercent(r.benchmarkMaxDrawdown, locale, 1) })}
              visual={
                <PairLanes
                  portfolio={r.maxDrawdown.depth}
                  benchmark={r.benchmarkMaxDrawdown}
                  labels={V.compare}
                  tone={r.maxDrawdown.depth < 0 ? "down" : undefined}
                />
              }
            />
          </>
        )}
      </dl>
    </section>
  );
}

/* --------------------------------------------------------- ana görsel */

/**
 * Bu kadar sektörde pay taşıyan portföyde sektör satırı iki satıra iner
 * (31 Ekim): S&P 500 payı adın yanına, fark kulvarın sağına. On
 * pozisyonlu, sekiz sektörlü portföyde sektör kartı 890 piksel ve yanındaki
 * yoğunlaşma kartının bütün yedek satırları açıldıktan sonra bile dibinde
 * 159 piksel boşluk kalıyordu (1440, ölçüldü). Az sektörde üç satırlık
 * düzen kalıyor: orada kısa kalan sektör kartı olurdu.
 */
const DENSE_SECTORS = 6;

/**
 * SEKTÖR DAĞILIMI ve S&P 500 — kompakt (25 Ekim, kart panosu). Eski panel
 * on bir sektörü 1400 piksellik satırlar olarak basıyordu; tek sektörde
 * yoğunlaşmış portföyde on satır "%0,0 · 12,1 Puan Eksik" idi. Şimdi
 * portföyde payı olan sektörler satır (kulvar + S&P 500 çentiği + fark),
 * portföyde hiç olmayanlar altta "Portföyde Olmayan Sektörler" ızgarasında:
 * ad, S&P 500 payı ve boş kulvarda yalnız çentik. İkisi aynı ölçekte
 * (`sectorBoard`), hiçbir sektör düşmüyor.
 */
function SectorPanel({
  risk,
  analysis,
  locale,
  A,
  V,
  partial,
}: {
  risk: PortfolioRisk;
  analysis: PortfolioAnalysis;
  locale: Locale;
  A: Labels;
  V: VisualLabels;
  partial: string | null;
}) {
  const L = A.sectors;
  const sectors = risk.sectors;
  const board = sectors ? sectorBoard(sectors.rows) : null;
  /* Fark yarım puanın altındaysa "yakın": ondalık hassasiyet uydurmuyoruz. */
  const EVEN_PTS = 0.5;
  const at = (value: number) => `${board ? clamp01(value / board.scale) * 100 : 0}%`;
  /* Lejant başlığın sağında (kart panosu): ayrı satırda 35 piksel tutuyordu. */
  const legend = sectors ? (
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
  ) : undefined;
  return (
    <Panel id="sektorler" data-area="sector" className={styles.cell}>
      <PanelHeader title={L.title} meta={legend} />
      <div className={styles.body}>
        {sectors && board ? (
          <>
            {board.held.length > 0 && (
              <ul className={styles.sectorList} data-dense={board.held.length >= DENSE_SECTORS || undefined}>
                {board.held.map((row, index) => {
                  const diff = Math.abs(row.diff);
                  const diffText =
                    diff < EVEN_PTS
                      ? L.even
                      : fill(row.diff > 0 ? L.heavier : L.lighter, { pts: formatPrice(diff, locale, { digits: 1 }) });
                  return (
                    <li key={row.sector} className={styles.sectorRow}>
                      <span className={styles.sectorName}>{sectorLabel(row.sector, locale) ?? row.sector}</span>
                      <span className={`numeral ${styles.sectorShare}`}>{pct(row.portfolio, locale)}</span>
                      <span className={styles.track} aria-hidden>
                        <span
                          className={styles.trackFill}
                          style={{ width: at(row.portfolio), animationDelay: `${index * 40}ms` } as CSSProperties}
                        />
                        <span className={styles.trackTick} style={{ left: at(row.benchmark) }} />
                      </span>
                      <span className={`numeral ${styles.sectorBench}`}>{tieFigures(`${L.legendBenchmark} ${pct(row.benchmark, locale)}`)}</span>
                      <span className={`numeral ${styles.sectorDiff}`}>{tieFigures(diffText)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
            {board.absent.length > 0 && (
              <div className={styles.absent}>
                <p className={styles.groupTitle}>{V.board.absent}</p>
                <ul className={styles.absentGrid}>
                  {board.absent.map((row) => {
                    const name = sectorLabel(row.sector, locale) ?? row.sector;
                    const bench = pct(row.benchmark, locale);
                    return (
                      <li key={row.sector} className={styles.absentItem} aria-label={fill(V.board.absentAria, { sector: name, bench })}>
                        <span className={styles.absentName} aria-hidden>
                          {name}
                        </span>
                        <span className={`numeral ${styles.absentShare}`} aria-hidden>
                          {bench}
                        </span>
                        <span className={styles.absentLane} aria-hidden>
                          <span className={styles.trackTick} style={{ left: at(row.benchmark) }} />
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </>
        ) : (
          <p className={styles.lead}>{L.unavailable}</p>
        )}
      </div>
      <div className={styles.notes}>
        {sectors && analysis.benchmark && <p>{fill(L.source, { date: dateLong(analysis.benchmark.asOf, locale) })}</p>}
        {sectors && sectors.unclassified > 0 && <p>{fill(L.unclassified, { share: pct(sectors.unclassified, locale) })}</p>}
        {partial && <p>{partial}</p>}
      </div>
    </Panel>
  );
}

/* -------------------------------------------------------- yoğunlaşma */

/** Şerit diliminin tonu: birinci dilim tam `--bar-soft`, sıra ilerledikçe açılır. */
const toneOf = (index: number) => `${Math.max(36, 100 - index * 11)}%`;

/**
 * POZİSYONLARIN AĞIRLIĞI — yüzde yüzlük şerit (25 Ekim) ve altında
 * pozisyon satırları (31 Ekim). "En büyük pozisyon %43" ve "ilk 5 %100"
 * iki ayrı sayıydı; şerit ikisini bir bakışta veriyor: portföyün ne
 * kadarını kaç dilim taşıyor. Dilimler ağırlık sırasında, tonu sıra
 * ilerledikçe açılıyor (renk değil koyuluk — kimlik etiketle, yön renkleri
 * burada yok).
 *
 * RENK (31 Ekim): dilimler `--primary-soft`ün doygun tonundaydı ve
 * "mavi çubuk" diye okunuyordu; artık sitenin büyüklük tonu `--bar-soft`
 * (globals.css, CompareScale ile aynı), koyuluk ondan açılıyor.
 *
 * SATIRLAR (31 Ekim). Şeridin altındaki dizin tek satırda yan yana
 * çiplerdi; sağ kolon sektör kartından kısa kalıyor, dibinde boşluk
 * duruyordu. Dizin artık satır satır: ton karesi, logo, sembol, şirket
 * adı, dilimin kendi tonunda ağırlık kulvarı (ölçek en büyük pozisyon) ve
 * yüzde. "Diğer" diliminin içindeki pozisyonlar `data-fill` yedek
 * satırlar: kolonda yer varsa `PanelFill` sığanı açar (boşluk esnetilmez,
 * doldurulur), JS kapalıyken ve dar ekranda taban liste kalır. Şeridin
 * `aria-label`ı her dilimi yazdığı için satırlar aria-hidden.
 */
function WeightStrip({
  risk,
  names,
  locale,
  V,
}: {
  risk: PortfolioRisk;
  names: PortfolioAnalysis["names"];
  locale: Locale;
  V: VisualLabels;
}) {
  const segments = weightStrip(risk.rows);
  const restCount = risk.rows.length - (segments.length - 1);
  const list = segments.map((segment) => `${segment.symbol ?? V.strip.rest} ${pct(segment.weight, locale)}`).join(", ");
  const peak = Math.max(0, ...risk.rows.map((row) => row.weight));
  const hasRest = segments.some((segment) => segment.symbol === null);
  /* "Diğer"in içindekiler: şeritte adıyla duranlardan sonrakiler. */
  const restRows = hasRest ? risk.rows.slice(segments.length - 1) : [];
  const row = (symbol: string, weight: number, tone: string, extra?: boolean) => (
    <li key={symbol} className={styles.posRow} data-fill={extra || undefined} hidden={extra || undefined}>
      <i className={styles.posSwatch} style={{ "--tone": tone } as CSSProperties} />
      <LogoTile symbol={symbol} logoUrl={names[symbol]?.logoUrl} size="xs" />
      <span className={styles.posId}>
        <b className={styles.mono}>{symbol}</b>
        {names[symbol]?.name && <small>{names[symbol]!.name}</small>}
      </span>
      <span className={styles.posLane}>
        <span
          className={styles.posLaneFill}
          data-motion-draw="line"
          style={{ width: `${peak > 0 ? clamp01(weight / peak) * 100 : 0}%`, "--tone": tone, transformOrigin: "left center" } as CSSProperties}
        />
      </span>
      <span className={`numeral ${styles.posShare}`}>{pct(weight, locale)}</span>
    </li>
  );
  return (
    <div className={styles.strip}>
      <p className={styles.groupTitle}>{V.strip.title}</p>
      <div className={styles.stripBar} role="img" aria-label={fill(V.strip.aria, { list })} data-motion-track>
        {segments.map((segment, index) => (
          <span
            key={segment.key}
            className={styles.stripSeg}
            data-rest={segment.symbol === null || undefined}
            data-motion-draw="line"
            style={{ flexGrow: segment.weight, "--tone": toneOf(index), transformOrigin: "left center" } as CSSProperties}
          />
        ))}
      </div>
      <ul className={styles.posList} aria-hidden data-fill-zone data-motion-track>
        {segments.map((segment, index) =>
          segment.symbol ? (
            row(segment.symbol, segment.weight, toneOf(index))
          ) : (
            <li key={segment.key} className={styles.posRow} data-rest>
              <i className={styles.posSwatch} data-rest />
              <span className={styles.posRestMark} />
              <span className={styles.posId}>
                <b>{V.strip.rest}</b>
                <small>{fill(V.strip.restCount, { n: restCount })}</small>
              </span>
              <span className={styles.posLane} />
              <span className={`numeral ${styles.posShare}`}>{pct(segment.weight, locale)}</span>
            </li>
          ),
        )}
        {restRows.map((rest) => row(rest.symbol, rest.weight, toneOf(segments.length), true))}
      </ul>
    </div>
  );
}

function ConcentrationPanel({
  risk,
  names,
  locale,
  A,
  V,
}: {
  risk: PortfolioRisk;
  names: PortfolioAnalysis["names"];
  locale: Locale;
  A: Labels;
  V: VisualLabels;
}) {
  const L = A.concentration;
  const c = risk.concentration;
  return (
    <Panel id="yogunlasma" data-area="side" className={styles.cell} data-fill-host>
      <PanelHeader title={V.board.concentrationTitle} />
      <div className={styles.body}>
        <WeightStrip risk={risk} names={names} locale={locale} V={V} />
        <dl className={styles.metrics} data-cols="2">
          <Metric
            label={L.largest}
            value={tieFigures(`${c.largest.symbol} ${pct(c.largest.weight, locale)}`)}
            visual={<Lane ratio={c.largest.weight / 100} />}
          />
          <Metric label={L.top5} value={pct(c.top5Share, locale)} visual={<Lane ratio={c.top5Share / 100} />} />
        </dl>
      </div>
      {/* "Yatırım Tavsiyesi Değildir" ilk ekranda bu kartta: sektör kartının
          yanında satır boyunca uzayan kart, künyeyi boşluğa koyuyor;
          sektör kartında 55 piksel daha tutup onu katın altına itiyordu. */}
      <div className={styles.notes}>
        <p>{fill(L.hhi, { hhi: num(c.hhi, locale, 3) })}</p>
        <p>{A.notAdvice}</p>
      </div>
    </Panel>
  );
}


/* --------------------------------------------------------- korelasyon */

function CorrelationPanel({ risk, locale, A, V }: { risk: PortfolioRisk; locale: Locale; A: Labels; V: VisualLabels }) {
  const L = A.correlation;
  const c = risk.correlation;
  /* Liste satırındaki çizgi: korelasyon −1..1, sıfır ortada (işaretli
     kulvar). Nötr ton — "birlikte hareket" bir yargı değil. */
  const list = (pairs: NonNullable<typeof c>["top"]) => (
    <ul className={styles.pairList}>
      {pairs.map((pair) => (
        <li key={`${pair.a}-${pair.b}`} className={styles.pairRow}>
          <span className={`${styles.pairNames} ${styles.mono}`}>
            {pair.a} · {pair.b}
          </span>
          <span className={`numeral ${styles.pairValue}`}>{num(pair.value, locale)}</span>
          <span aria-hidden className={styles.signedLane} data-motion-track>
            <span
              className={styles.laneFill}
              data-motion-draw="line"
              style={{
                left: pair.value < 0 ? `${50 - clamp01(-pair.value) * 50}%` : "50%",
                width: `${clamp01(Math.abs(pair.value)) * 50}%`,
                transformOrigin: pair.value < 0 ? "right center" : "left center",
              }}
            />
          </span>
        </li>
      ))}
    </ul>
  );
  const matrix = c?.matrix;
  const cells: HeatCell[][] | null =
    matrix && matrix.symbols.length >= 3
      ? matrix.symbols.slice(1).map((a, row) =>
          matrix.symbols.slice(0, row + 1).map((b, col) => {
            const value = matrix.values[row + 1]![col]!;
            const text = num(value, locale);
            return { a, b, value, text, aria: fill(V.matrix.aria, { a, b, value: text }) };
          }),
        )
      : null;
  return (
    <Panel id="korelasyon" data-area="corr" className={styles.cell}>
      <PanelHeader
        title={L.title}
        meta={c ? tieFigures(`${L.average} ${num(c.average, locale)}`) : undefined}
      />
      <div className={styles.body}>
        <p className={styles.lead}>{L.hint}</p>
        {c ? (
          <div className={styles.corrLayout} data-has-matrix={cells ? true : undefined}>
            {cells && matrix && (
              <div className={styles.corrMatrix}>
                <p className={styles.groupTitle}>{fill(V.matrix.title, { n: matrix.symbols.length })}</p>
                <CorrelationHeat symbols={matrix.symbols} cells={cells} idle={V.matrix.idle} caption={V.matrix.caption} />
                <p className={styles.metricSub}>{V.matrix.hint}</p>
              </div>
            )}
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
    <Panel id="kur" className={styles.cell}>
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
    <Panel id="temettu" className={styles.cell}>
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
    <Panel id="bilancolar" data-area="earn" className={styles.cell}>
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
                  {/* Haftanın payı en ağır haftaya göre — nötr büyüklük, mavi değil
                      (25 Ekim renk kararı: mavi yalnız etkileşim). */}
                  <span aria-hidden className={styles.weekLane}>
                    <Lane ratio={heaviest > 0 ? week.weight / heaviest : 0} />
                  </span>
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
    <Panel id="eksik-sektorler" data-area="gaps" className={styles.cell}>
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
                  {/* Portföy payı ve S&P 500 çentiği aynı ölçekte (sektör
                      panelinin dili): eksiğin boyu bir bakışta. */}
                  <span aria-hidden className={styles.gapLane}>
                    <Lane
                      ratio={pairScale(gap.portfolio, gap.benchmark).a}
                      tick={pairScale(gap.portfolio, gap.benchmark).b}
                    />
                  </span>
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
  V,
}: {
  analysis: PortfolioAnalysis;
  risk: PortfolioRisk;
  fund: string | null;
  weight: number | null;
  basePath: string;
  locale: Locale;
  A: Labels;
  V: VisualLabels;
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
  const measure = (
    label: string,
    pick: (side: NonNullable<typeof scenario>["before"]) => number,
    kind: "pct" | "num" | "num1",
    /** Kulvarın ölçeği: yüzde payı 0-100, öteki ölçüler iki değerin büyüğü. */
    floor: number | "share",
  ) => {
    if (!scenario) return null;
    const before = pick(scenario.before);
    const after = pick(scenario.after);
    const digits = kind === "num" ? 2 : 1;
    const show = (value: number) => (kind === "pct" ? pct(value, locale) : num(value, locale, digits));
    const delta = Number((after - before).toFixed(digits));
    const signedDelta = delta > 0 ? `+${num(delta, locale, digits)}` : num(delta, locale, digits);
    const lanes =
      floor === "share"
        ? { a: clamp01(before / 100), b: clamp01(after / 100) }
        : pairScale(before, after, floor);
    return {
      label,
      before: show(before),
      after: show(after),
      beforeAt: lanes.a,
      afterAt: lanes.b,
      delta: delta === 0 ? null : kind === "pct" ? fill(L.deltaPts, { value: signedDelta }) : signedDelta,
    };
  };
  const rows = scenario
    ? [
        measure(L.volatility, (side) => side.volatility, "pct", 0),
        measure(L.beta, (side) => side.beta, "num", BETA_FLOOR),
        measure(fill(L.sectorShare, { sector }), (side) => side.sectorShare, "pct", "share"),
        measure(L.effective, (side) => side.effectiveCount, "num1", 0),
        measure(L.largest, (side) => side.largestWeight, "pct", "share"),
      ].filter((row) => row !== null)
    : [];
  return (
    <Panel id="senaryo" data-area="scenario" className={styles.cell}>
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
          /* ÖNCE / SONRA KARTLARI (25 Ekim). Beş satırlık tablo iki sütunu
             yan yana veriyordu; okur farkı ve yönü sayıdan çıkarıyordu.
             Her ölçü artık bir kart: iki nokta aynı kulvarda (içi boş
             bugün, dolu fonla), aralarındaki çizgi değişimin kendisi. Renk
             nötr — oynaklığın düşmesi "iyi" diye boyanmaz (yukarıdaki not).
             Sayılar tablodakinin aynısı, yalnız biçim değişti. */
          <div className={styles.scenarioBlock}>
          <ul className={styles.legend} aria-hidden>
            <li>
              <span className={styles.dumbbellKey} data-side="before" />
              {L.before}
            </li>
            <li>
              <span className={styles.dumbbellKey} data-side="after" />
              {`${L.after} (${chosen.symbol})`}
            </li>
          </ul>
          <ul className={styles.scenarioCards} aria-label={`${L.before} / ${L.after} (${chosen.symbol})`} data-motion-stagger>
            {rows.map((row) => (
              <li
                key={row.label}
                className={styles.scenarioCard}
                aria-label={fill(V.scenario.aria, { label: row.label, before: row.before, after: row.after })}
              >
                <p className={styles.metricLabel}>{row.label}</p>
                <p className={`numeral ${styles.scenarioFigures}`} aria-hidden>
                  <span className={styles.scenarioBefore}>{row.before}</span>
                  <ArrowRight size={13} weight="bold" className={styles.scenarioArrow} />
                  <span className={styles.scenarioAfter}>{row.after}</span>
                </p>
                <span aria-hidden className={styles.dumbbell}>
                  <span
                    className={styles.dumbbellSpan}
                    style={{
                      left: `${Math.min(row.beforeAt, row.afterAt) * 100}%`,
                      width: `${Math.abs(row.afterAt - row.beforeAt) * 100}%`,
                    }}
                  />
                  <span className={styles.dumbbellDot} data-side="before" style={{ left: `${row.beforeAt * 100}%` }} />
                  <span className={styles.dumbbellDot} data-side="after" style={{ left: `${row.afterAt * 100}%` }} />
                </span>
                <p className={styles.scenarioDelta} aria-hidden>
                  {row.delta ? tieFigures(row.delta) : V.scenario.same}
                </p>
              </li>
            ))}
          </ul>
          </div>
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
