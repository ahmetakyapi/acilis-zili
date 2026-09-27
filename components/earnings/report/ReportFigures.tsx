import { Reveal } from "@/components/motion/PremiumMotion";
import { ChapterHeading } from "@/components/ui/ChapterHeading";
import { MetricCards } from "@/components/earnings/MetricCards";
import { RevenueColumns } from "@/components/earnings/RevenueColumns";
import { GuidanceRanges } from "@/components/earnings/GuidanceRanges";
import type { FooterStat } from "@/components/earnings/ChartFooter";
import styles from "@/components/earnings/EarningsReport.module.css";
import { formatGuidanceRange, guidanceEnds } from "@/lib/earnings-report";
import type { Dictionary, Locale } from "@/lib/i18n";
import type { EarningsAnalysisRow } from "@/lib/schema";
import { cn, formatMoneyCompact, formatPercentPlain, formatPrice } from "@/lib/utils";

type Highlight = NonNullable<EarningsAnalysisRow["highlights"]>[number];

/**
 * Rakamlar bölümü — kalan metrik kartları, çeyreklik gelir sütunları ve
 * öngörü aralıkları. Sayfa dosyasından olduğu gibi taşındı; künyeler ve
 * ölçek sayfada hesaplanıyor (gerekçe orada).
 */
export function ReportFigures({
  row,
  locale,
  t,
  detailMetrics,
  hasColumns,
  hasGuidance,
  revenueScale,
  revenueUnit,
  revenueFooter,
  guidanceFooter,
  nextPeriodReported,
  children,
}: {
  row: EarningsAnalysisRow;
  locale: Locale;
  t: Dictionary;
  detailMetrics: Highlight[];
  hasColumns: boolean;
  hasGuidance: boolean;
  revenueScale: number;
  revenueUnit: string;
  revenueFooter: FooterStat[];
  guidanceFooter: FooterStat[];
  nextPeriodReported: boolean;
  /** Bölümün sonuna eklenen panel — segment ve KPI verisi. */
  children?: React.ReactNode;
}) {
  return (
    <>
          {/* ---- Görsel katman ----
              Sayfa uzun metinle açılıyordu ve çeyreğin rakamları dokuz
              paragrafın gölgesinde kalıyordu. Sıra artık karnedekiyle aynı:
              önce ölçüler, sonra grafikler, sonra CEO, en sonda metin.
              Rakamı gören okuyucu metne inmek zorunda değil; inmek isteyen
              için metin zaten altında duruyor. */}
          <section id="report-figures" className={styles.figuresSection}>
            <Reveal>
              {/* BÖLÜM BAŞLIĞI PAYLAŞILAN KALIPTA (23 Eylül): üstünde dönem
                  künyesi ("3Ç FY2026"), sağında hiçbir yere götürmeyen 30
                  piksellik bir ok vardı. Dönem kapakta ve yapışkan çubukta
                  zaten yazılı; ok bir süstü. Başlık, sekme etiketiyle aynı
                  anahtar (gerekçe components/ui/ChapterHeading). */}
              <ChapterHeading title={t.analysis.chapterFigures} className={styles.reportChapter} />
              <MetricCards metrics={detailMetrics} locale={locale} />
            </Reveal>

          {(hasColumns || hasGuidance) && (
            /* YAN YANA KARTLAR AYNI HİZADA BİTER. Izgaranın varsayılanı olan
               gerilme burada bir süre `items-start` ile kapatılmıştı ve
               gerekçesi geçerliydi: gelir sütunlarının yüksekliği SABİTTİ,
               dolayısıyla gerilen alan grafiğe değil, dönem etiketleriyle alt
               künye arasına ölü boşluk olarak dağılıyordu.

               Doğru düzeltme gerilmeyi kapatmak değil, grafiği esnetmekti.
               `RevenueColumns` artık taban yükseklikli ve `flex-1`; fazla
               alanın tamamı çizime gidiyor, sütunlar uzuyor, delik kalmıyor.
               Öngörü kartı da satırlarını kartın boyuna yayıyor. */
            <Reveal>
            <div
              className={cn(
                "grid gap-4",
                hasColumns && hasGuidance
                  ? "lg:grid-cols-[repeat(2,minmax(0,1fr))]"
                  : "grid-cols-1",
              )}
            >
              {hasColumns && (
                <RevenueColumns
                  bars={row.quarterlyRevenue ?? []}
                  title={`${t.analysis.quarterlyRevenue} (${revenueUnit})`}
                  legendActual={t.analysis.legendActual}
                  legendProjected={t.analysis.legendProjected}
                  format={(value) =>
                    formatPrice(value / revenueScale, locale, {
                      digits: value / revenueScale >= 100 ? 0 : 2,
                    })
                  }
                  formatMoney={(value) => formatMoneyCompact(value, locale)}
                  labels={{
                    qoq: t.analysis.quarterOnQuarter,
                    yoy: t.analysis.yearOnYear,
                    missing: t.analysis.missingQuarter,
                  }}
                  footer={revenueFooter}
                  locale={locale}
                />
              )}
              {hasGuidance && (
                <GuidanceRanges
                  rows={row.guidance ?? []}
                  /* Öngörülen dönem artık AÇIKLANDIYSA başlık bunu söylüyor:
                     "2Ç FY27 Şirket Öngörüsü" 2Ç açıklanmışken geçmişi
                     gelecek gibi sunuyordu (gerekçe `nextPeriodReported`). */
                  title={
                    row.nextPeriodLabel
                      ? (nextPeriodReported
                          ? t.analysis.guidanceTitleReported
                          : t.analysis.guidanceTitle
                        ).replace("{period}", row.nextPeriodLabel)
                      : t.analysis.guidanceTitleFallback
                  }
                  legendRange={t.analysis.legendRange}
                  legendConsensus={t.analysis.legendConsensus}
                  axisNote={t.analysis.guidanceAxis}
                  howToRead={t.analysis.howToRead}
                  /* Eksen ucu bir ORAN, fiyat değil: tek ondalık yeter ve
                     işaret yazılmıyor (künye zaten "±" diyor). */
                  formatPercent={(value) =>
                    formatPercentPlain(value, locale, value < 10 ? 1 : 0)
                  }
                  verdictLabels={{
                    above: t.analysis.guidanceAbove,
                    below: t.analysis.guidanceBelow,
                    inline: t.analysis.guidanceInline,
                  }}
                  formatRange={(low, high, unit) =>
                    formatGuidanceRange(low, high, unit ?? undefined, locale)
                  }
                  formatEnds={(low, high, unit) =>
                    guidanceEnds(low, high, unit ?? undefined, locale)
                  }
                  footer={guidanceFooter}
                  locale={locale}
                />
              )}
            </div>
            </Reveal>
          )}
          {children}
          </section>
    </>
  );
}
