import { PageShare } from "@/components/article/PageShare";
import { Suspense } from "react";
import { MarketPulse } from "@/components/macro/MarketPulse";
import { HeroAccent } from "@/components/motion/HeroAccent";
import {
  MacroSections,
  MacroSelection,
  MacroSummary,
  type BoardData,
  type BoardLabels,
  type BoardSeries,
} from "@/components/macro/MacroBoard";
import { groupOf, groupRank } from "@/components/macro/macro-groups";
import { formatMacroValue, type MacroValueFormat } from "@/components/macro/macro-format";
import { MotionExperience, ScrollProgress } from "@/components/motion/PremiumMotion";
import styles from "@/components/macro/MacroExperience.module.css";
import { GuideHint } from "@/components/article/GuideHint";
import { DataStamp, EmptyState, PageHeader, Skeleton } from "@/components/ui/primitives";
import { FomcCard } from "@/components/macro/FomcCard";
import { getI18n, type Dictionary, type Locale } from "@/lib/i18n";
import { getMacroBoard, type MacroBoardRow } from "@/lib/macro-data";
import {
  formatEtDateLong,
  formatEtDateMedium,
  formatPeriodLabel,
  formatPrice,
  unitLabel,
} from "@/lib/utils";

import { pageMetadata } from "@/lib/page-meta";
import { curveShape, FED_INFLATION_TARGET, fillTemplate, FLAT_DELTA as FLAT_GAUGE_DELTA, gaugeRatio, macroGaugeFacts, SAHM_THRESHOLD } from "@/lib/macro-visual";
import type { GaugeView } from "@/components/macro/MacroGauges";

/* Paylaşım künyesi. Sayfa kendi başlığını vermediğinde Next kökteki
   varsayılanı miras alıyor ve her bölüm linki aynı metinle
   paylaşılıyordu. Metin, bölümün OG kartındaki cümleyle aynı. */
export const generateMetadata = pageMetadata({
  path: "/makro",
  tr: {
    title: "Makro",
    description:
      "Enflasyon, istihdam ve faiz — ABD ekonomisinin ana göstergeleri.",
  },
  en: {
    title: "Macro",
    description:
      "Inflation, employment and rates — the main gauges of the US economy.",
  },
});

/**
 * Makro göstergeler: kapakta bütün serilerin özet ızgarası, altında grup
 * grup büyük grafikler (karar kaydı components/macro/MacroBoard.tsx).
 * Değer büyük ve mono; ok yalnızca yönü söyler (düşüş kırmızı, yükseliş
 * accent mavi) — yeşil bilinçli olarak yok, çünkü enflasyonun düşmesi iyi,
 * istihdamın düşmesi kötüdür ve yeşil "iyi haber" demek olurdu.
 * Dönem ve tarih alanları ham "2026-06" yerine Türkçe okunur.
 */

/** "2026-06" → "Haziran 2026" / "June 2026" */
/* Künye artık `lib/utils.ts` içinde: ana sayfadaki Makro Özeti paneli de
   aynı biçimi kullanıyor. */
const formatPeriod = formatPeriodLabel;

/**
 * Kartın dönem künyesi — SIKLIĞA göre (28 Eylül).
 *
 * Aylık seride ay adı yeterli ("Ağustos 2026"). Haftalık İşsizlik
 * Başvuruları ve günlük 10 yıl − 3 ay farkı aynı biçimle "Eylül 2026"
 * yazılsaydı hangi haftanın ya da günün okunduğu kaybolurdu; o seriler
 * gözlemin kendi tarihini taşıyor. FRED haftalık seriyi haftanın BİTTİĞİ
 * cumartesiyle tarihliyor.
 */
function periodOf(row: MacroBoardRow, locale: Locale, t: Dictionary): string {
  if (row.definition.frequency === "monthly" || !row.observedAt) {
    return formatPeriod(row.periodLabel, locale);
  }
  const date = formatEtDateMedium(row.observedAt, locale);
  return row.definition.frequency === "weekly" ? t.marketExtras.weekEnding.replace("{date}", date) : date;
}

/** Birim etiketi: "puan" iki dilde ayrı yazılıyor (`unitLabel` yalnızca "bin"i çeviriyor). */
function unitText(unit: string, locale: Locale, t: Dictionary): string {
  return unit === "puan" ? t.markets.point : unitLabel(unit, locale);
}

/**
 * Bir satırın değer biçimi: kart, sahne, çip ve önceki değer aynı kuraldan.
 * Hane sayısı seri tanımından (`digits`): Sahm göstergesi ve faiz farkı
 * yüzde PUANI ve sıfır haneyle "0" basılırdı. Birim sözlükten ("bin" bilinçli
 * küçük, sayı sözcüğü). Biçimin kendisi `macro-format.ts`te; istemcideki
 * yuvarlanan rakam da oradan okuyor.
 */
function formatOf(row: MacroBoardRow, locale: Locale, t: Dictionary): MacroValueFormat {
  const percent = row.unit === "%";
  return {
    locale,
    percent,
    digits: row.definition.digits ?? (percent ? 2 : 0),
    unit: percent ? "" : unitText(row.unit, locale, t),
  };
}

/* Sahm kuralının eşiği (`SAHM_THRESHOLD`, 0,50 yüzde puanı; Claudia Sahm,
   2019) 31 Ekim'den beri `lib/macro-visual.ts`te: kapağın Sahm ölçüsü de
   aynı sayıyı okuyor. */

/**
 * Seriye özgü okuma notu — kartın İÇİNDE, saç teliyle ayrılmış düz
 * paragraf (ekran düzeni 6. madde). Yalnızca eşiği ya da işareti olan
 * iki seride: sayının kendisi bir yargı taşımıyor ama eşiğe göre konumu
 * taşıyor ve o eşik ekranda yazmıyorsa okuyucu "0,37 çok mu" diye soruyor.
 */
function seriesNote(row: MacroBoardRow, locale: Locale, t: Dictionary): { status: string | null; text: string } | null {
  const x = t.marketExtras;
  const latest = row.latestValue;
  if (row.definition.seriesId === "SAHMREALTIME") {
    const threshold = formatPrice(SAHM_THRESHOLD, locale, { digits: 2 });
    return {
      status: latest === null ? null : latest >= SAHM_THRESHOLD ? x.sahmTriggered : x.sahmBelow,
      text: x.sahmNote.replace("{threshold}", threshold),
    };
  }
  if (row.definition.seriesId === "T10Y3M") {
    return {
      /* Biçim tepedeki cümleyle AYNI kuraldan (`curveShape`, düz bandı
         dahil): cümle "düz" derken rozet "Normal" demesin. */
      status: latest === null ? null : { inverted: x.curveInvertedStatus, flat: t.macroVisual.shapeFlat, normal: x.curveNormalStatus }[curveShape(latest)],
      text: x.curveNote,
    };
  }
  /* ENFLASYON VE FED HEDEFİ (25 Ekim). "%3,72 çok mu" sorusunun cevabı
     hedefe uzaklık; künye sayıyı veriden yazıyor ("Hedefin 1,72 Puan
     Üstünde"), not hedefin hangi endeks için tanımlı olduğunu söylüyor. */
  if (INFLATION_SERIES.has(row.definition.seriesId)) {
    const v = t.macroVisual;
    const gap = latest === null ? null : latest - FED_INFLATION_TARGET;
    const gapText = gap === null ? "" : formatPrice(Math.abs(gap), locale, { digits: 2 });
    return {
      status: gap === null ? null : Math.abs(gap) < FLAT_GAP ? v.atTarget : (gap > 0 ? v.aboveTarget : v.belowTarget).replace("{gap}", gapText),
      text: v.targetNote,
    };
  }
  if (BAR_SERIES.has(row.definition.seriesId)) return { status: null, text: t.macroVisual.barsNote };
  return null;
}

/** Fed'in %2 hedef çizgisini taşıyan seriler: yıllık TÜFE, çekirdek TÜFE, çekirdek PCE. */
const INFLATION_SERIES = new Set(["CPIAUCSL", "CPILFESL", "PCEPILFE"]);
/**
 * AYLIK DEĞİŞİM SERİLERİ ÇUBUKLA (25 Ekim). Tarım dışı istihdamın ve
 * perakende satışların değeri bir SEVİYE değil bir ayın değişimi; çizgi
 * ardışık ayları birleştirip olmayan bir süreklilik çiziyordu ve sıfırın
 * altına inen aylar çizginin bir kıvrımı gibi okunuyordu. Sıfır ekseninden
 * her ay bir çubuk: işaret yön, boy büyüklük.
 */
const BAR_SERIES = new Set(["PAYEMS", "RSAFS"]);
/** Hedefe bu kadar yakınsa "Hedefte" (FRED iki hane yayımlar). */
const FLAT_GAP = 0.005;

/**
 * Eşik çizgisi olan seriler: Sahm (0,50 puan, üstü uyarı), 10Y-3A (sıfır,
 * altı ters eğri) ve enflasyon (Fed'in %2 hedefi, üstü uyarı tonunda —
 * yön değil, hedefe göre konum).
 */
function thresholdOf(row: MacroBoardRow, locale: Locale, t: Dictionary, format: MacroValueFormat): BoardSeries["threshold"] {
  const id = row.definition.seriesId;
  if (INFLATION_SERIES.has(id)) {
    return { value: FED_INFLATION_TARGET, label: t.macroVisual.target.replace("{value}", formatMacroValue(FED_INFLATION_TARGET, { ...format, digits: 0 })), alertWhen: "above" };
  }
  if (id === "SAHMREALTIME") return { value: SAHM_THRESHOLD, label: `${t.macro.threshold} ${formatMacroValue(SAHM_THRESHOLD, format)}`, alertWhen: "above" };
  if (id === "T10Y3M") return { value: 0, label: `${t.macro.threshold} ${formatMacroValue(0, format)}`, alertWhen: "below" };
  return null;
}

/**
 * Kapağın dört ölçüsü (31 Ekim; karar kaydı components/macro/MacroGauges.tsx).
 * Önceki tek cümle (25 Ekim) TÜFE'nin hedefe uzaklığını, işsizliğin son
 * ayını ve eğrinin biçimini iki satırlık kalın bir paragrafta söylüyordu;
 * olgular aynı (`macroGaugeFacts`, testli), her biri artık bir çizim ve
 * altında kısa bir cümle. Her ölçünün DÖNEMİ kendi başlığının altında,
 * çünkü dördü aynı günün verisi değil (TÜFE bir ay geriden, faiz farkı
 * günlük). Biçim kartlarla aynı kuraldan (`formatMacroValue`).
 */
function gaugesOf(series: BoardSeries[], locale: Locale, t: Dictionary): GaugeView[] {
  const facts = macroGaugeFacts(series);
  if (!facts) return [];
  const v = t.macroVisual;
  const byId = (id: string) => series.find((item) => item.id === id)!;
  const percent = { locale, percent: true, digits: 2, unit: "" };
  const pct = (value: number, digits = 2) => formatMacroValue(value, { ...percent, digits });
  const points = (value: number) => formatPrice(value, locale, { digits: 2 });
  const gauges: GaugeView[] = [];

  if (facts.inflation) {
    const { value, gap, domain } = facts.inflation;
    const at = Math.abs(gap) < FLAT_GAUGE_DELTA;
    gauges.push({
      key: "inflation",
      title: v.gaugeInflation,
      period: byId("CPIAUCSL").period,
      value: pct(value),
      text: fillTemplate(at ? v.gaugeInflationAt : gap > 0 ? v.gaugeInflationAbove : v.gaugeInflationBelow, { gap: points(Math.abs(gap)) }),
      alert: gap > 0 && !at,
      visual: {
        kind: "scale",
        at: gaugeRatio(value, domain),
        ref: gaugeRatio(FED_INFLATION_TARGET, domain),
        refLabel: fillTemplate(v.gaugeTarget, { value: pct(FED_INFLATION_TARGET, 0) }),
        lo: pct(domain.lo, 0),
        hi: pct(domain.hi, 0),
      },
    });
  }

  if (facts.unemployment) {
    const { value, prev, delta, domain } = facts.unemployment;
    const flat = delta === null || Math.abs(delta) < FLAT_GAUGE_DELTA;
    gauges.push({
      key: "unemployment",
      title: v.gaugeUnemployment,
      period: byId("UNRATE").period,
      value: pct(value),
      text: fillTemplate(flat ? v.gaugeUnemploymentFlat : delta! > 0 ? v.gaugeUnemploymentUp : v.gaugeUnemploymentDown, { delta: points(Math.abs(delta ?? 0)) }),
      alert: false,
      visual: {
        kind: "move",
        from: prev === null || flat ? null : gaugeRatio(prev, domain),
        to: gaugeRatio(value, domain),
        fromLabel: prev === null || flat ? null : fillTemplate(v.gaugePrev, { value: pct(prev) }),
        tone: flat ? "flat" : delta! > 0 ? "up" : "down",
        lo: pct(domain.lo, 1),
        hi: pct(domain.hi, 1),
        range: v.gaugeRange,
      },
    });
  }

  if (facts.curve) {
    const { spread, shape, span } = facts.curve;
    const signed = `${spread > 0 ? "+" : spread < 0 ? "−" : ""}${points(Math.abs(spread))} ${t.markets.point}`;
    gauges.push({
      key: "curve",
      title: v.gaugeCurve,
      period: byId("T10Y3M").period,
      value: signed,
      text: fillTemplate({ normal: v.gaugeCurveNormal, flat: v.gaugeCurveFlat, inverted: v.gaugeCurveInverted }[shape], { spread: points(Math.abs(spread)) }),
      alert: shape === "inverted",
      visual: { kind: "slope", rise: spread / span, short: v.gaugeShort, long: v.gaugeLong },
    });
  }

  if (facts.sahm) {
    const { value, triggered, domain } = facts.sahm;
    const threshold = points(SAHM_THRESHOLD);
    gauges.push({
      key: "sahm",
      title: v.gaugeSahm,
      period: byId("SAHMREALTIME").period,
      value: `${points(value)} ${t.markets.point}`,
      text: fillTemplate(triggered ? v.gaugeSahmAbove : v.gaugeSahmBelow, { threshold }),
      alert: triggered,
      visual: {
        kind: "scale",
        at: gaugeRatio(value, domain),
        ref: gaugeRatio(SAHM_THRESHOLD, domain),
        refLabel: fillTemplate(v.gaugeThreshold, { value: threshold }),
        lo: points(domain.lo),
        hi: points(domain.hi),
      },
    });
  }
  return gauges;
}

/**
 * Sunucu satırından istemci serisine. Her şey burada biçimleniyor (dönem
 * künyesi, sonraki açıklama, değişimin birimi, damga); istemci yalnızca
 * sayıyı yuvarlarken `formatMacroValue`u çağırıyor.
 */
function toBoard(rows: MacroBoardRow[], locale: Locale, t: Dictionary): BoardData {
  const intl = locale === "tr" ? "tr-TR" : "en-US";
  const monthLong = new Intl.DateTimeFormat(intl, { month: "long", year: "numeric", timeZone: "UTC" });
  const monthShort = new Intl.DateTimeFormat(intl, { month: "short", year: "numeric", timeZone: "UTC" });
  const series: BoardSeries[] = rows
    .filter((row): row is MacroBoardRow & { latestValue: number } => row.latestValue !== null)
    .sort((a, b) => groupRank(a.definition.seriesId) - groupRank(b.definition.seriesId))
    .map((row) => {
      const format = formatOf(row, locale, t);
      const monthly = row.definition.frequency === "monthly";
      const delta = row.prevValue !== null ? row.latestValue - row.prevValue : null;
      /* Yüzde serisinde değişimin birimi PUAN, yüzde değil. */
      const deltaUnit = format.percent ? t.markets.point : format.unit;
      const note = seriesNote(row, locale, t);
      return {
        id: row.definition.seriesId,
        group: groupOf(row.definition.seriesId),
        title: locale === "tr" ? row.titleTr : row.titleEn,
        period: periodOf(row, locale, t),
        format,
        latest: row.latestValue,
        prev: row.prevValue,
        delta,
        deltaLabel: delta === null ? null : `${formatPrice(Math.abs(delta), locale, { digits: format.digits })} ${deltaUnit}`.trimEnd(),
        next: row.nextReleaseAt ? formatEtDateLong(row.nextReleaseAt, locale) : null,
        nextShort: row.nextReleaseAt ? formatEtDateMedium(row.nextReleaseAt, locale) : null,
        threshold: thresholdOf(row, locale, t, format),
        chart: BAR_SERIES.has(row.definition.seriesId) ? "bars" : "line",
        status: note?.status ?? null,
        note: note?.text ?? null,
        points: row.observations.map((point) => {
          const date = new Date(`${point.date}T12:00:00Z`);
          return {
            t: date.getTime(),
            value: point.value,
            date: monthly ? monthLong.format(date) : formatEtDateMedium(point.date, locale),
            axis: monthShort.format(date),
          };
        }),
        /* Damga TABLONUN güncellenme anı; canlı yedekten gelen seride çekim
           anı (lib/macro-data.ts). Gözlemin kendi tarihi dönem künyesinde. */
        stamp: <DataStamp labels={t.data} source="fred" at={row.updatedAt} locale={locale} />,
      };
    });
  return { series, gauges: gaugesOf(series, locale, t) };
}

/**
 * PERFORMANS (28 Eylül, ölçüldü, `next start`, 390 + 4x CPU).
 * Sayfa `getMacroBoard`ı en üstte bekliyordu: tablo okuması, tabloda satırı
 * olmayan seriler için canlı FRED turu, sonra ilk bayt. Veri önbelleği
 * boşken ilk bayt 998 ms'de geliyordu (sıcakta ~150-200 ms). Artık
 * başlık, sekme iskeleti ve piyasa nabzının yeri hemen gidiyor; tahta bir
 * söz olarak istemci sağlayıcısına veriliyor ve özet ile bölümler kendi
 * Suspense sınırlarında akıyor. İskeletler son hâlin kutusunu tutuyor
 * (CLS 0). Sonra, aynı koşulda: soğukta ilk bayt 188 ms, sıcakta 27-58 ms;
 * CLS 0; istemci JS'i 295 → 298 KB. Masaüstü LCP 272 → 408 ms: en büyük öğe
 * artık akışla gelen büyük rakam/grafik, ilk baytla gelen başlık değil.
 */
export default async function MacroPage() {
  const { locale, t } = await getI18n();
  /* Tablo + canlı yedek: tohumda satırı olmayan yeni seri de basılıyor
     (gerekçe lib/macro-data.ts). BEKLENMİYOR: söz sağlayıcıya gidiyor. */
  const board = getMacroBoard().then((rows) => toBoard(rows, locale, t));
  const x = t.macro;
  const labels: BoardLabels = {
    groups: { inflation: x.groupInflation, labor: x.groupLabor, policy: x.groupPolicy, growth: x.groupGrowth },
    seriesLabel: x.pick,
    previous: x.previous,
    nextRelease: x.nextRelease,
    noNextRelease: x.noNextRelease,
    unchanged: x.unchanged,
    history: x.history,
    historyEmpty: x.historyEmpty,
    all: x.all,
    glance: t.macroVisual.gaugesTitle,
  };

  return (
    <MotionExperience className={styles.page}>
      <ScrollProgress />
      <MacroSelection board={board} labels={labels}>
        {/* KAPAK: başlık, bütün göstergelerin özeti, dipte faiz ve
            oynaklık. Grafikler aşağıda, grup grup (karar kaydı
            components/macro/MacroBoard.tsx başında). */}
        <div className={`${styles.hero} page-frame`}>
          <HeroAccent />
          <PageHeader share={<PageShare compactOnMobile align="right" path="/makro" title={x.title} locale={locale} t={t} />} embedded title={x.title} subtitle={x.subtitle} />
          <Suspense fallback={<SummarySkeleton />}>
            <MacroSummary
              empty={<EmptyState title={t.common.noData} hint={t.common.noDataHint} scene="chart" />}
            />
          </Suspense>
          <div className={styles.pulseArea}>
            <Suspense fallback={<Skeleton className={styles.pulseSkeleton} />}>
              <MarketPulse locale={locale} t={t} />
            </Suspense>
          </div>
        </div>

        <Suspense fallback={<SectionsSkeleton />}>
          {/* Sonraki FOMC para politikası bölümünde, grafiğin altında
              kompakt bir şerit. Kendi sınırında akıyor; yer tutucu
              şeridin kutusunda. */}
          <MacroSections
            fomc={
              <Suspense fallback={<Skeleton className={styles.fomcSkeleton} />}>
                <FomcCard locale={locale} t={t} />
              </Suspense>
            }
          />
        </Suspense>
      </MacroSelection>

      <GuideHint
        label={t.guide.contextLabel}
        locale={locale}
        slugs={["enflasyon", "istihdam", "sahin-guvercin", "faiz-tahvil", "getiri-egrisi", "volatilite"]}
        className="pt-1"
      />
    </MotionExperience>
  );
}

/** Özetin yer tutucusu: başlık ve on bir kartın kutusu (CLS). */
const SUMMARY_SKELETON_TILES = 11;

function SummarySkeleton() {
  return (
    <>
    <Skeleton className={styles.skLead} />
    <div className={styles.summary} aria-hidden>
      <Skeleton className={styles.skSummaryTitle} />
      <div className={styles.summaryGrid}>
        {Array.from({ length: SUMMARY_SKELETON_TILES }, (_, i) => <Skeleton key={i} className={styles.tileSkeleton} />)}
      </div>
    </div>
    </>
  );
}

/** Bölümlerin yer tutucusu: ilk iki bölümün (geniş ekranda bir satır) başlığı ve sahnesi. */
const SECTION_SKELETONS = 2;

function SectionsSkeleton() {
  return (
    <div className={styles.sections} aria-hidden>
      {Array.from({ length: SECTION_SKELETONS }, (_, i) => <SectionSkeleton key={i} />)}
    </div>
  );
}

function SectionSkeleton() {
  return (
    <div className={styles.section}>
      <Skeleton className={styles.skHeading} />
      <div className={styles.stage}>
        <Skeleton className={styles.skChips} />
        <div className={`${styles.reading} ${styles.skReading}`}>
          <div className={styles.readingMain}>
            <Skeleton className={styles.skTitle} />
            <Skeleton className={styles.skFigure} />
          </div>
        </div>
        <Skeleton className={styles.skChart} />
        <Skeleton className={styles.skFoot} />
      </div>
    </div>
  );
}
