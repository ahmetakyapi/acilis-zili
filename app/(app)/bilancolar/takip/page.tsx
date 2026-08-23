import Link from "next/link";
import { auth } from "@/auth";
import {
  ButtonLink,
  EmptyState,
  PageHeader,
  Panel,
  Segment,
  SegmentItem,
} from "@/components/ui/primitives";
import { AnalysisTable } from "@/components/earnings/AnalysisTable";
import { EarningsCalendar } from "@/components/earnings/EarningsCalendar";
import { EarningsTabs } from "@/components/earnings/EarningsTabs";
import {
  analysisTableLabels,
  toAnalysisRowView,
} from "@/lib/analysis";
import {
  getAnalyses,
  getAnalysisBadges,
  getEarningsBetween,
  getSymbolNames,
  getUserSymbols,
} from "@/lib/data";
import { addEtDays, todayEt } from "@/lib/market-hours";
import { getI18n } from "@/lib/i18n";
import { pageMetadata } from "@/lib/page-meta";
import { formatEtDateCompact } from "@/lib/utils";

/* Künye yoktu. Sayfa okuyucunun KENDİ listesine bağlı, yani herkese aynı
   şeyi göstermiyor: dizine girmesi anlamsız, `robots` kapalı. Başlık yine
   de gerekli — sekmede ve paylaşımda ana sayfanın başlığı görünüyordu. */
export const generateMetadata = pageMetadata({
  path: "/bilancolar/takip",
  robots: { index: false, follow: false },
  tr: {
    title: "Takip Ettiklerim",
    description: "Takip listendeki şirketlerin bilanço takvimi ve analizleri.",
  },
  en: {
    title: "Following",
    description: "Earnings dates and analyses for the companies you follow.",
  },
});

/**
 * Bilançolar · Takip Ettiklerim sekmesi.
 *
 * Takvimin ve analizlerin favori listesine daraltılmış hâli — iki sekmeyi
 * ayrı ayrı filtrelemek yerine tek ekran. Sıra bilinçli: önce YAYIMLANMIŞ
 * analizler, sonra takvim. Takip edilen bir şirketin bilançosu okunduysa
 * okuyucunun aradığı şey odur; takvim zaten ileriye bakıyor.
 *
 * Giriş yapmamış okuyucu yönlendirilmiyor, çünkü bu bir sekme: çubuğa
 * tıklayan kişinin sayfadan atılması gezinmeyi kırıyor. Sekme açılıyor ve
 * ne olduğunu anlatıp girişe davet ediyor.
 */

const RANGES = { hafta: 6, ay: 29 } as const;
type RangeKey = keyof typeof RANGES;

export default async function WatchedEarningsPage(
  props: PageProps<"/bilancolar/takip">,
) {
  const search = await props.searchParams;
  const range: RangeKey = search.aralik === "ay" ? "ay" : "hafta";

  const { locale, t } = await getI18n();
  const session = await auth();
  const today = todayEt();

  if (!session?.user?.id) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title={t.analysis.title} subtitle={t.analysis.subtitle} />
        <EarningsTabs active="watchlist" t={t} className="-mt-1" />
        <Panel>
          <EmptyState
            title={t.analysis.signedOut}
            hint={t.analysis.signedOutHint}
            action={
              <ButtonLink
                href="/giris?devam=/bilancolar/takip"
                variant="primary"
                size="sm"
              >
                {t.nav.signIn}
              </ButtonLink>
            }
          />
        </Panel>
      </div>
    );
  }

  const userSymbols = await getUserSymbols(session.user.id);
  const watchSet = new Set(userSymbols);
  /* Değişkene çıkarıldı: aralığın bitiş günü başlıktaki künyede de yazıyor. */
  const rangeEnd = addEtDays(today, RANGES[range]);

  const [analyses, allRows] = await Promise.all([
    userSymbols.length > 0
      ? getAnalyses(locale, { limit: 20, symbols: userSymbols })
      : Promise.resolve([]),
    getEarningsBetween(today, rangeEnd),
  ]);

  const rows = allRows.filter((row) => watchSet.has(row.symbol));
  const symbolList = [
    ...new Set([...rows.map((r) => r.symbol), ...analyses.map((r) => r.symbol)]),
  ];
  const [meta, badges] = await Promise.all([
    getSymbolNames(symbolList),
    /* Aralık VERİLMİYOR: bu ekranda rozet hem takvim satırlarına hem de
       geçmiş analiz listesine bağlanıyor, ikincisi takvim penceresinin
       dışında kalıyor. Sembol sayısı zaten takip listesiyle sınırlı. */
    getAnalysisBadges(symbolList, locale),
  ]);

  const analysisRows = analyses.map((analysis) =>
    toAnalysisRowView(analysis, meta[analysis.symbol], locale, t),
  );

  const rangeHref = (key: RangeKey) =>
    key === "ay" ? "/bilancolar/takip?aralik=ay" : "/bilancolar/takip";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t.analysis.title}
        subtitle={t.analysis.subtitle}
        action={
          /* Aralık künyesi takvim sekmesindekiyle aynı — iki ekran aynı
             segmenti kullanıyor, biri söyleyip öteki susmamalı. */
          <div className="flex flex-col items-start gap-1.5 sm:items-end">
            <Segment>
              {(["hafta", "ay"] as const).map((key) => (
                <SegmentItem
                  key={key}
                  href={rangeHref(key)}
                  active={range === key}
                >
                  {key === "hafta" ? t.earnings.rangeWeek : t.earnings.rangeMonth}
                </SegmentItem>
              ))}
            </Segment>
            <p className="figure text-tiny text-muted">
              {formatEtDateCompact(today, locale)} –{" "}
              {formatEtDateCompact(rangeEnd, locale)}
            </p>
          </div>
        }
      />

      <EarningsTabs active="watchlist" t={t} className="-mt-1" />

      {userSymbols.length === 0 ? (
        <Panel>
          <EmptyState
            title={t.earnings.emptyWatchlist}
            hint={t.analysis.emptyWatchlistHint}
            action={
              <Link
                href="/favoriler"
                className="text-small font-semibold text-primary"
              >
                {t.nav.watchlist} →
              </Link>
            }
          />
        </Panel>
      ) : (
        <>
          <section className="flex flex-col gap-3">
            <h2 className="display-ink display-ink-tight w-fit text-base font-bold">
              {t.analysis.watchlistAnalyses}
            </h2>
            {analyses.length === 0 ? (
              <Panel>
                <EmptyState
                  title={t.analysis.emptyWatchlist}
                  hint={t.analysis.emptyWatchlistHint}
                />
              </Panel>
            ) : (
              <AnalysisTable
                rows={analysisRows}
                labels={analysisTableLabels(t)}
              />
            )}
          </section>

          <section className="flex flex-col gap-4">
            <h2 className="display-ink display-ink-tight w-fit text-base font-bold">
              {t.analysis.watchlistCalendar}
            </h2>
            {rows.length === 0 ? (
              <Panel>
                <EmptyState
                  title={t.earnings.emptyWatchlist}
                  hint={t.earnings.emptyWatchlistHint}
                />
              </Panel>
            ) : (
              <EarningsCalendar
                rows={rows}
                meta={meta}
                watchSet={watchSet}
                badges={badges}
                today={today}
                locale={locale}
                t={t}
              />
            )}
          </section>
        </>
      )}
    </div>
  );
}
