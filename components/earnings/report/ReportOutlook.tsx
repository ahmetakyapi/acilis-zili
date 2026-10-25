import { AddToCalendar } from "@/components/earnings/AddToCalendar";
import { ChapterHeading } from "@/components/ui/ChapterHeading";
import type { Dictionary, Locale } from "@/lib/i18n";
import type { EarningsAnalysisRow } from "@/lib/schema";
import { OutlookBalance, UpcomingTrack } from "./OutlookCards";
import type { AutoLinker } from "@/lib/autolink";

/**
 * Görünüm bölümü — güçlü yönler ile riskler karşılaştırmalı tek kartta,
 * beklenen gelişmeler altında bir zaman çizgisi (25 Ekim görsel zirve;
 * gerekçe `OutlookCards.tsx`). Üç eşit kart yan yana duruyordu ve
 * başlıkları yön renginde yazılıydı.
 */
export function ReportOutlook({
  row,
  symbol,
  locale,
  t,
  nextReport,
  nextReportText,
  nextPeriodReported,
  linker,
}: {
  row: EarningsAnalysisRow;
  symbol: string;
  locale: Locale;
  t: Dictionary;
  nextReport: { date: string; hour: string | null } | null;
  nextReportText: string | null;
  nextPeriodReported: boolean;
  /** Sayfanın tek bağlayıcısı — gerekçe `RichText`te. */
  linker: AutoLinker;
}) {
  return (
    /* Maddeler analizin dilinde; başlıklar arayüz dilinde ama kart
       içindeki metin kayıttan geliyor. */
    <section id="report-outlook" className="flex min-w-0 flex-col gap-4">
      <ChapterHeading title={t.analysis.reportOutlook} />
      <OutlookBalance
        title={t.analysisVisuals.balanceTitle}
        strengths={row.strengths ?? []}
        risks={row.risks ?? []}
        labels={{
          strengths: t.analysis.strengths,
          risks: t.analysis.risks,
          count: t.analysisVisuals.balanceCount,
        }}
        linker={linker}
        lang={row.locale}
      />
      <UpcomingTrack
        title={t.analysis.upcomingDev}
        points={row.upcoming ?? []}
        linker={linker}
        lang={row.locale}
        /* Kartın dibinde sonraki bilanço — kapaktaki çiple aynı hesap
           (`nextReportText`): takvim tarihi, yoksa henüz geçmemiş kayıt
           tahmini; geçmiş bir tarih hiçbir zaman. */
        footer={
          nextReportText ? (
            <p className="flex flex-wrap items-center gap-x-2 text-small">
              <span className="font-bold text-strong" lang={locale}>
                {t.analysis.nextEarnings}
              </span>
              <span className="numeral font-semibold text-primary-ink">
                {!nextPeriodReported && row.nextPeriodLabel ? `${row.nextPeriodLabel} · ` : ""}
                {nextReportText}
              </span>
              {nextReport && (
                <AddToCalendar
                  symbol={symbol}
                  date={nextReport.date}
                  label={t.earnings.addToCalendar}
                  compact
                  className="-my-2 ml-auto"
                />
              )}
            </p>
          ) : null
        }
      />
    </section>
  );
}
