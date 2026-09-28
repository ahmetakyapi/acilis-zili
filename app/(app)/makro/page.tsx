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

/** Sahm kuralının eşiği — yüzde puanı (Claudia Sahm, 2019). */
const SAHM_THRESHOLD = 0.5;

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
      status: latest === null ? null : latest < 0 ? x.curveInvertedStatus : x.curveNormalStatus,
      text: x.curveNote,
    };
  }
  return null;
}

/** Eşik çizgisi olan seriler: Sahm (0,50 puan) ve 10Y-3A (sıfır: ters eğri sınırı). */
function thresholdOf(row: MacroBoardRow, locale: Locale, t: Dictionary, format: MacroValueFormat) {
  const value = row.definition.seriesId === "SAHMREALTIME" ? SAHM_THRESHOLD : row.definition.seriesId === "T10Y3M" ? 0 : null;
  if (value === null) return null;
  return { value, label: `${t.macro.threshold} ${formatMacroValue(value, format)}` };
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
  return { series };
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
          <PageHeader embedded eyebrow={x.eyebrow} title={x.title} subtitle={x.subtitle} />
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
    <div className={styles.summary} aria-hidden>
      <Skeleton className={styles.skSummaryTitle} />
      <div className={styles.summaryGrid}>
        {Array.from({ length: SUMMARY_SKELETON_TILES }, (_, i) => <Skeleton key={i} className={styles.tileSkeleton} />)}
      </div>
    </div>
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
