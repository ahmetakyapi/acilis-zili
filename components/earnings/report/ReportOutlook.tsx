import { AddToCalendar } from "@/components/earnings/AddToCalendar";
import { ChapterHeading } from "@/components/ui/ChapterHeading";
import styles from "@/components/earnings/EarningsReport.module.css";
import type { Dictionary, Locale } from "@/lib/i18n";
import type { EarningsAnalysisRow } from "@/lib/schema";
import { cn } from "@/lib/utils";
import { PointsCard } from "./PointsCard";
import type { AutoLinker } from "@/lib/autolink";

/** Görünüm bölümü — güçlü yönler, riskler, beklenen gelişmeler. */
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
    <>
          {/* Maddeler de analizin dilinde; başlıklar arayüz dilinde ama
              kart içindeki metin kayıttan geliyor. */}
          <section id="report-outlook" className="flex min-w-0 flex-col gap-5">
          <ChapterHeading title={t.analysis.reportOutlook} />
          {/* Üç kart yan yana yalnızca 1101 ve üstünde (kapak ızgarasının
              eşiği); altında tek sütun ve liste iki sütun (gerekçe modülde,
              `.pointsCard ol`). 1024'te yan yana üç kart zaman çizgisinin
              altında 107 piksel boşluk bırakıyordu. */}
          <div
            className={cn(styles.pointsGrid, "grid gap-3 min-[1101px]:grid-cols-[repeat(3,minmax(0,1fr))]")}
            lang={row.locale}
          >
            <PointsCard
              linker={linker}
              title={t.analysis.strengths}
              points={row.strengths ?? []}
              tone="up"
            />
            <PointsCard
              linker={linker}
              title={t.analysis.risks}
              points={row.risks ?? []}
              tone="down"
            />
            <PointsCard
              linker={linker}
              title={t.analysis.upcomingDev}
              points={row.upcoming ?? []}
              tone="primary"
              /* Kartın dibinde sonraki bilanço — kapaktaki çiple aynı
                 hesap (`nextReportText`): takvim tarihi, yoksa henüz
                 geçmemiş kayıt tahmini; geçmiş bir tarih hiçbir zaman. */
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
          </div>
          </section>
    </>
  );
}
