import { Suspense } from "react";
import { MarketPulse } from "@/components/macro/MarketPulse";
import { HeroAccent } from "@/components/motion/HeroAccent";
import { MacroExplorer } from "@/components/macro/MacroExplorer";
import { MotionExperience, ScrollProgress } from "@/components/motion/PremiumMotion";
import styles from "@/components/macro/MacroExperience.module.css";
import { GuideHint } from "@/components/article/GuideHint";
import { Sparkline } from "@/components/ui/Sparkline";
import { DataStamp, EmptyState, PageHeader, Panel, Skeleton } from "@/components/ui/primitives";
import { FomcCard } from "@/components/macro/FomcCard";
import { getI18n, type Dictionary, type Locale } from "@/lib/i18n";
import { getMacroBoard, type MacroBoardRow } from "@/lib/macro-data";
import {
  formatEtDateLong,
  formatEtDateMedium,
  formatPeriodLabel,
  formatPrice,
  formatPercentPlain,
  unitLabel,
  NO_VALUE,
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
 * Makro göstergeler — her seri bir gösterge kartı.
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

/** Bir satırın değer biçimi — kart, gezgin ve önceki değer aynı kuraldan. */
function formatterFor(row: MacroBoardRow, locale: Locale, t: Dictionary) {
  const percent = row.unit === "%";
  const digits = row.definition.digits ?? (percent ? 2 : 0);
  const unit = unitText(row.unit, locale, t);
  return {
    percent,
    digits,
    unit,
    format: (value: number | null) =>
      value === null
        ? NO_VALUE
        : percent
          ? formatPercentPlain(value, locale, digits)
          : `${formatPrice(value, locale, { digits })} ${unit}`.trimEnd(),
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

export default async function MacroPage() {
  const { locale, t } = await getI18n();
  /* Tablo + canlı yedek: tohumda satırı olmayan yeni seri de basılıyor
     (gerekçe lib/macro-data.ts). */
  const rows = await getMacroBoard();

  const withData = rows.filter((row) => row.latestValue !== null);

  // Historical observations carry their exact dates and units into the client.
  // The published reading remains separate when a previous point is inspected.
  const explorerSeries = withData.map((row) => {
    const { format } = formatterFor(row, locale, t);
    const dateFormat = new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", {
      day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
    });
    return {
      id: row.definition.seriesId,
      title: locale === "tr" ? row.titleTr : row.titleEn,
      latest: format(row.latestValue),
      period: periodOf(row, locale, t),
      next: row.nextReleaseAt ? formatEtDateLong(row.nextReleaseAt, locale) : null,
      points: row.observations
        .map((point) => {
          const date = new Date(`${point.date}T12:00:00Z`);
          return { value: point.value, date: dateFormat.format(date), timestamp: date.getTime(), label: format(point.value) };
        }),
    };
  });

  return (
    <MotionExperience className={styles.page}>
      <ScrollProgress />
      <div className={`${styles.hero} page-frame`}>
        <HeroAccent />
        <MacroExplorer
          intro={
            <PageHeader
              embedded
              eyebrow={t.macro.eyebrow}
              title={t.macro.title}
              subtitle={t.macro.subtitle}
            />
          }
          labels={{
            title: t.macro.explorer,
            pick: t.macro.pick,
            latest: t.macro.latest,
            next: t.macro.nextRelease,
            noNext: t.macro.noNextRelease,
            history: t.macro.history,
            empty: t.macro.historyEmpty,
          }}
          series={explorerSeries}
        />
        <div className={styles.pulseArea}>
          <Suspense fallback={<Skeleton className={styles.pulseSkeleton} />}>
            <MarketPulse locale={locale} t={t} />
          </Suspense>
        </div>
      </div>

      {withData.length === 0 ? (
        <Panel>
          <EmptyState title={t.common.noData} hint={t.common.noDataHint} scene="chart" />
        </Panel>
      ) : (
        <div className={styles.grid} data-motion-stagger>
          {/* Sonraki FOMC ızgaranın başında: politika faizi kartının
              "sonraki açıklama" satırı aylık ortalamanın yayın günü, karar
              günü değil. Kararın kendisi bu kartta. */}
          <Suspense fallback={null}>
            <FomcCard locale={locale} t={t} />
          </Suspense>
          {withData.map((row) => {
            const title = locale === "tr" ? row.titleTr : row.titleEn;
            const observations = row.observations;
            const delta =
              row.latestValue !== null && row.prevValue !== null
                ? row.latestValue - row.prevValue
                : null;
            /* YÜZDE KURALINI ANA SAYFAYLA AYNI YERDEN OKUYOR.
               Bu ekran işareti elle sayının ARDINA koyuyor ve bir ondalığa
               yuvarlıyordu; ana sayfadaki makro paneli aynı seriyi
               `formatPercentPlain` ile iki ondalıklı ve dile göre doğru
               tarafa yazıyor. Kural tek yerde: lib/utils.ts → withPercent.
               BİRİM DE YAZILIYOR, yalnızca yüzde değil (PAYEMS "-23 bin";
               gerekçe lib/utils.ts → `unitLabel`). Hane sayısı artık seri
               tanımından (`digits`): Sahm göstergesi ve faiz farkı yüzde
               PUANI ve sıfır haneyle "0" basılırdı. */
            const { percent: yuzde, digits, unit: birim, format: olcu } = formatterFor(row, locale, t);
            const note = seriesNote(row, locale, t);

            return (
              <Panel key={row.definition.seriesId} className={`${styles.card} flex flex-col p-4 sm:p-5`}>
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-sm font-semibold leading-snug text-strong">
                    {title}
                  </h2>
                  <span className="numeral shrink-0 rounded-full bg-primary-tint px-2 py-0.5 text-nano text-soft">
                    {periodOf(row, locale, t)}
                  </span>
                </div>

                <div className="mt-3 flex items-baseline gap-2.5">
                  <span className="tote text-[2rem] leading-none">
                    {olcu(row.latestValue)}
                  </span>
                  {delta !== null && Math.abs(delta) > 0.001 && (
                    <span className="numeral inline-flex items-center gap-1 rounded-full bg-surface-sunken px-2 py-0.5 text-tiny font-medium text-body">
                      {/* Ok yalnızca yönü söyler: düşüş kırmızı, yükseliş
                          accent mavi. Yeşil yok — bkz. ana sayfa makro kartı. */}
                      <span
                        aria-hidden
                        className={
                          delta > 0
                            ? "text-[0.8em] font-semibold text-primary"
                            : "text-[0.8em] font-semibold text-down"
                        }
                      >
                        {delta > 0 ? "▲" : "▼"}
                      </span>
                      {formatPrice(Math.abs(delta), locale, { digits })}
                      {/* BİRİM SÖZLÜKTEN, elden yazılmış değil (Title Case
                          künye kuralı; "bin" bilinçli küçük — sayı sözcüğü). */}
                      {yuzde
                        ? ` ${t.markets.point}`
                        : birim
                          ? ` ${birim}`
                          : ""}
                    </span>
                  )}
                </div>
                {note?.status && (
                  <p className="mt-2 w-fit rounded-full bg-surface-elevated px-2 py-0.5 text-nano font-semibold text-body">
                    {note.status}
                  </p>
                )}

                <div className="mt-4">
                  <Sparkline
                    points={observations}
                    title={title}
                    className="h-16 w-full"
                  />
                </div>

                <dl className="mt-4 flex-1 divide-y divide-line-soft border-t border-line-soft text-xs">
                  <div className="flex items-center justify-between py-2">
                    <dt className="text-muted">{t.macro.previous}</dt>
                    <dd className="numeral font-medium text-body">
                      {olcu(row.prevValue)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3 py-2">
                    <dt className="shrink-0 text-muted">{t.macro.nextRelease}</dt>
                    <dd className="text-right">
                      {row.nextReleaseAt ? (
                        <span className="numeral font-semibold text-primary">
                          {formatEtDateLong(row.nextReleaseAt, locale)}
                        </span>
                      ) : (
                        <span className="text-muted">
                          {t.macro.noNextRelease}
                        </span>
                      )}
                    </dd>
                  </div>
                </dl>

                {note && (
                  <p className="mt-3 border-t border-line-soft pt-3 text-tiny leading-relaxed text-muted">
                    {note.text}
                  </p>
                )}

                <DataStamp
                  labels={t.data}
                  source="fred"
                  at={row.updatedAt}
                  locale={locale}
                  className="mt-3"
                />
              </Panel>
            );
          })}
        </div>
      )}

      <GuideHint
        label={t.guide.contextLabel}
        locale={locale}
        slugs={["enflasyon", "istihdam", "sahin-guvercin", "faiz-tahvil", "getiri-egrisi", "volatilite"]}
        className="pt-1"
      />
    </MotionExperience>
  );
}
