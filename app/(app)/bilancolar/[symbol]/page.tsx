import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { auth } from "@/auth";
import { PageShare } from "@/components/article/PageShare";
import { AddToCalendar } from "@/components/earnings/AddToCalendar";
import { timingOf } from "@/components/earnings/EarningsCalendar";
import { SymbolAnalyses } from "@/components/earnings/SymbolAnalyses";
import { GuideRow } from "@/components/earnings/company/GuideRow";
import { LastReport, NoReportDate } from "@/components/earnings/company/LastReport";
import { QuarterLedger } from "@/components/earnings/company/QuarterLedger";
import { VoteThreshold } from "@/components/earnings/company/VoteThreshold";
import { CompanyIdentity } from "@/components/earnings/company/CompanyIdentity";
import { NextReport } from "@/components/earnings/company/NextReport";
import css from "@/components/earnings/company/CompanyEarnings.module.css";
import { EarningsVote } from "@/components/earnings/vote/EarningsVote";
import { LocaleLink as Link } from "@/components/layout/LocaleLink";
import { MotionExperience, ScrollProgress } from "@/components/motion/PremiumMotion";
import { BreadcrumbJsonLd } from "@/components/seo/JsonLd";
import {
  DataStamp,
  PageHeader,
  Panel,
  PanelHeader,
} from "@/components/ui/primitives";
import { buildPastQuarters } from "@/components/stock/past-quarters";
import { analysisHref, verdictLabel, verdictOf } from "@/lib/analysis";
import { companySector } from "@/lib/company-sector";
import {
  getAnalyses,
  getEarningsForSymbol,
  getHolidays,
  getStatus,
  getSymbolNames,
  isKnownSymbol,
} from "@/lib/data";
import { companyCopy, companyWhen, dayMonth, earningsHref, lockLabel } from "@/lib/earnings-company";
import { storyGuaranteed } from "@/lib/earnings-story";
import {
  accuracyPercent,
  beatQuarters,
  boardFor,
  buildVoteView,
  tallyTotal,
  voteOutcome,
} from "@/lib/earnings-vote";
import { getVoteAccuracy, getVoteBoard } from "@/lib/earnings-vote-data";
import {
  averageAbsMove,
  EXPECTED_MOVE_HORIZON_DAYS,
  historicalMoves,
  normalizeTiming,
  type HistoricalMove,
} from "@/lib/expected-move";
import { getExpectedMove, HISTORY_LOOKBACK_DAYS, pastReportEvents } from "@/lib/expected-move-data";
import { getI18n, type Dictionary, type Locale } from "@/lib/i18n";
import { addEtDays, daysBetweenEt, todayEt } from "@/lib/market-hours";
import { fittedTitle, missingMetadata } from "@/lib/page-meta";
import { zoneTag } from "@/lib/session-clock";
import { getDailyCloses } from "@/lib/providers/alpaca-options";
import { getEarningsSurprises } from "@/lib/providers/finnhub";
import { sectorLabel } from "@/lib/sectors";
import { pageAlternates } from "@/lib/site";
import type { EarningsRow } from "@/lib/schema";
import {
  formatEtDateCompact,
  formatEtDateLong,
  formatMoneyCompact,
  formatPercentPlain,
  formatPrice,
  isValidSymbol,
} from "@/lib/utils";

/**
 * Şirket bazlı bilanço sayfası — `/bilancolar/[symbol]` (24 Ekim).
 *
 * "[Şirket] bilançosu ne zaman" sorusunun cevabı: `<title>` soruyu sorar ve
 * cevabı taşır, `h1` altı tek cümleyle, panelin ilk paragrafı ayrıntıyla
 * cevaplar. Metin kuralları ve gerekçesi `lib/earnings-company.ts`; üç
 * metin tek fonksiyondan (`companyCopy`) çıkıyor ki birbirini tutsun.
 *
 * ESKİ KARAR DEĞİŞTİ. Bu adres bilinçli olarak yoktu
 * (lib/admin-data.ts → `ROUTE_READ`: "sayfası olmayan bir şablon uydurmak
 * olurdu"); artık sayfası var ve ölçüm şablonu `lib/analytics.ts`te.
 *
 * Ekran sırası (CLAUDE.md "Ekran düzeni"): başlık (künye şeridi — şirket,
 * hisse bağlantısı — 31 Ekim'den beri başlık kartının İÇİNDE) → kahraman
 * yüzey: Sıradaki Bilanço (yaprak + geri sayım çizgisi, beklentiler, metin,
 * künye) ya da, rapor yeni açıklandıysa, Son Bilanço (sonuç) → Beklenti
 * Karnesi (çeyrek defteri: EPS şeritleri, rapor sonrası tepki, beklenen
 * hareket) → oylama (oy kartları + eşik) → okunan çeyrekler → `DataStamp`
 * → rehber satırı.
 *
 * 14 KASIM (görsel tur, "Zil Defteri"): üç kat. Kahraman tek yüzey
 * (`--radius-feature`), karne ve oylama kutulu panel, rehber kutusuz açık
 * bölüm. Karne oylama panelinin sağ hücresinden çıkıp kendi paneline
 * geçti (gerekçe `QuarterLedger.tsx`); kahramanın üç hâli var (sıradaki /
 * yeni açıklanmış / tarihsiz; gerekçe `LastReport.tsx`).
 *
 * Event/FAQ yapılandırılmış verisi YOK — belgeli karar
 * (`components/seo/JsonLd.tsx` başında). Yalnız kırıntı.
 */

/** Takvim satırı geçmişi: sıradaki + son rapor için yeterli derinlik. */
const CALENDAR_DEPTH = 6;
/** Okunan çeyreklerden kaçı listelenir — iki yıl. */
const ANALYSES_LIMIT = 8;
/** Rapor bu kadar gün içinde açıklandıysa kahraman yüzey SONUCU gösterir
    (sıradaki rapor beklenen hareket ufkunda değilse). Bir hafta: raporun
    konuşulduğu süre; sonrasında okurun sorusu yine "sıradaki ne zaman". */
const RECENT_REPORT_DAYS = 7;

/**
 * Rapor sonrası fiyat tepkileri ve beklenen hareket. Hisse sayfasının
 * Beklenen Hareket paneliyle AYNI yükleyiciler (`lib/expected-move-data.ts`;
 * yeni sağlayıcı ucu yok): rapor ufuktaysa (`EXPECTED_MOVE_HORIZON_DAYS`,
 * hisse sayfasının eşiği) `getExpectedMove` (opsiyon fiyatlaması dahil),
 * değilse yalnız geçmiş raporların hareketi. Sağlayıcı düşerse defter
 * tepki sütunu olmadan çizilir.
 */
async function loadMoves(
  symbol: string,
  next: EarningsRow | null,
  daysLeft: number | null,
  today: string,
): Promise<{ history: HistoricalMove[]; average: { avg: number; count: number } | null; implied: number | null } | null> {
  try {
    if (next && daysLeft !== null && daysLeft <= EXPECTED_MOVE_HORIZON_DAYS) {
      const status = await getStatus();
      const data = await getExpectedMove(symbol, { date: next.reportDate, timing: normalizeTiming(next.hour) }, status);
      return { history: data.history, average: data.average, implied: data.implied?.ok ? data.implied.pct : null };
    }
    const [events, closes] = await Promise.all([
      pastReportEvents(symbol, today),
      getDailyCloses(symbol, addEtDays(today, -HISTORY_LOOKBACK_DAYS)),
    ]);
    const history = historicalMoves(events, closes.ok ? closes.data : [], today);
    return { history, average: averageAbsMove(history), implied: null };
  } catch {
    return null;
  }
}

/* Künye ve gövde aynı okumayı istiyor; istek içinde tek tur. */
const loadCompany = cache(async function loadCompany(symbol: string, locale: Locale) {
  const today = todayEt();
  const [meta, rows, known, analyses, holidays] = await Promise.all([
    getSymbolNames([symbol]),
    getEarningsForSymbol(symbol, CALENDAR_DEPTH),
    isKnownSymbol(symbol),
    getAnalyses(locale, { symbols: [symbol], limit: ANALYSES_LIMIT }),
    getHolidays(),
  ]);
  /* Satırlar yeniden eskiye; sıradaki bugünden (ET) itibaren EN YAKINI. */
  const upcoming = rows.filter((row) => row.reportDate >= today);
  const next = upcoming.at(-1) ?? null;
  const previous = rows.find((row) => row.reportDate < today) ?? null;
  const name = meta[symbol]?.name ?? analyses[0]?.company ?? symbol;
  return { meta: meta[symbol], rows, next, previous, known, analyses, holidays, name, today };
});

type Loaded = Awaited<ReturnType<typeof loadCompany>>;

function textsOf(data: Loaded, symbol: string, locale: Locale, t: Dictionary) {
  const names = {
    afterClose: t.earnings.afterClose,
    beforeOpen: t.earnings.beforeOpen,
    duringMarket: t.earnings.duringMarket,
  };
  const next = data.next ? { date: data.next.reportDate, hour: data.next.hour?.trim() || null } : null;
  const when = companyWhen(next, data.holidays, locale, names);
  const lower = (text: string | null) =>
    text ? text.toLocaleLowerCase(locale === "tr" ? "tr-TR" : "en-US") : null;
  const copy = companyCopy({
    name: data.name,
    symbol,
    when,
    dateLong: next ? formatEtDateLong(next.date, locale) : null,
    dateShort: next ? dayMonth(next.date, locale) : null,
    labels: t.earningsSeason.company,
    windowLower: lower(when.windowName),
  });
  return { when, copy };
}

function symbolOf(raw: string): string {
  return decodeURIComponent(raw).toUpperCase();
}

export async function generateMetadata(
  props: PageProps<"/bilancolar/[symbol]">,
): Promise<Metadata> {
  const symbol = symbolOf((await props.params).symbol);
  const { locale, t } = await getI18n();
  if (!isValidSymbol(symbol)) return missingMetadata(locale);
  const data = await loadCompany(symbol, locale);
  if (!data.known && data.analyses.length === 0 && !data.next) return missingMetadata(locale);
  const { copy } = textsOf(data, symbol, locale, t);
  return {
    /* 14 Kasım: tam kalıp 90 karaktere çıkıyordu; ekle sığan ilk aday
       ("NVIDIA Bilançosu Ne Zaman? 20 Kasım, ~00:00 TR"), o da sığmazsa
       marka eki düşer (`fittedTitle`). */
    title: fittedTitle([copy.metaTitle, copy.metaTitleShort], locale),
    description: copy.description,
    alternates: pageAlternates(earningsHref(symbol), locale),
    /* İNCE SAYFA DİZİNE GİRMEZ: takvimde tarihi de okunmuş çeyreği de
       olmayan şirketin sayfası yalnız "henüz yok" diyor. Site haritası da
       aynı ölçütle listeliyor (app/sitemap.ts). `follow` açık. */
    ...(data.next || data.analyses.length > 0 ? {} : { robots: { index: false, follow: true } }),
  };
}

export default async function CompanyEarningsPage(props: PageProps<"/bilancolar/[symbol]">) {
  const symbol = symbolOf((await props.params).symbol);
  if (!isValidSymbol(symbol)) notFound();
  const { locale, t } = await getI18n();
  const data = await loadCompany(symbol, locale);
  if (!data.known && data.analyses.length === 0 && !data.next) notFound();

  const c = t.earningsSeason.company;
  const v = t.earningsSeason.vote;
  const { when, copy } = textsOf(data, symbol, locale, t);
  const href = earningsHref(symbol);
  const session = await auth();
  const userId = session?.user?.id ?? null;

  /* Oy tahtası son rapordan sıradakine — iki hedef, tek sorgu çifti. */
  const voteTargets = [data.previous, data.next].filter((row): row is EarningsRow => row !== null);
  /* Beklenti karnesi hisse sayfasının Geçmiş Bilançolar tablosuyla AYNI
     uçtan (`getEarningsSurprises`, altı saat önbellekli; iki sayfa tek
     tur). Sağlayıcı düşerse karne basılmaz, panel yine çizilir. */
  const daysLeft = data.next ? daysBetweenEt(data.today, data.next.reportDate) : null;
  const [board, record, surprises, moves] = await Promise.all([
    voteTargets.length > 0
      ? getVoteBoard(userId, voteTargets[0].reportDate, voteTargets.at(-1)!.reportDate, [symbol])
      : Promise.resolve(null),
    userId ? getVoteAccuracy(userId, Number(data.today.slice(0, 4))) : Promise.resolve(null),
    getEarningsSurprises(symbol).catch(() => null),
    loadMoves(symbol, data.next, daysLeft, data.today),
  ]);
  /* `beatQuarters`: son çeyreğin gerçekleşen EPS'i (aşağıda, beklentinin
     yanındaki şerit) oyun sonucuyla aynı eşikten. 14 Kasım'a dek karne
     hücreleri de bu diziden kuruluyordu (`BeatRecordCard`, kalktı); karne
     artık `QuarterLedger`da, hisse sayfasının dizisinden. */
  const quarters = surprises?.ok ? beatQuarters(surprises.data) : [];
  const money = data.meta?.currency || true;
  /* DEFTERİN SATIRLARI hisse sayfasının tablosu ve iziyle AYNI dizi
     (`buildPastQuarters`: sürpriz ucu + takvim + analiz; dönem adı ve rapor
     günü oradan). Takvim tarafı yerel tablonun satırları; açıklanmamış
     gelecek satır karışmaz. Tepkiler rapor gününe göre eşlenir. */
  const pastQuarters = surprises?.ok
    ? buildPastQuarters(
        surprises.data,
        data.rows.filter((row) => row.reportDate <= data.today || row.epsActual !== null),
        data.analyses,
        locale,
        data.today,
      )
    : [];
  const ledgerRows = pastQuarters.filter((row) => row.epsActual !== null && row.epsEstimate !== null);
  const reactions = new Map<string, number>();
  for (const move of moves?.history ?? []) {
    if (move.movePct !== null) reactions.set(move.date, move.movePct);
  }
  /* Son çeyreğin gerçekleşen EPS'i karnenin EN YENİ hücresiyle aynı satır —
     beklentinin yanındaki çubuk ile karnedeki sayı aynı kaynaktan (CLAUDE.md
     "Veri Dürüstlüğü" 3). Gelir sürpriz listesinde yok; son raporun takvim
     satırından. */
  const lastQuarter = quarters.at(-1)?.row ?? null;
  const now = new Date();
  /* `boardFor`: tarih anahtarı kaymış eski oylar da aynı rapora sayılır
     (gerekçe `lib/earnings-vote.ts`, "TARİH ANAHTARI KAYABİLİR"). */
  const viewOf = (row: EarningsRow) =>
    buildVoteView({ row, holidays: data.holidays, now, ...(board ? boardFor(board, row) : { mine: null, tally: null }) });
  const nextView = board?.available && data.next ? viewOf(data.next) : null;
  /* Son raporun sonucu ancak gösterecek bir şey varsa: okurun oyu ya da
     topluluğun dağılımı. Kimsenin oy vermediği geçmiş rapor panelde yer
     tutmaz. */
  const previousView = board?.available && data.previous ? viewOf(data.previous) : null;
  const showPrevious =
    previousView !== null && (previousView.mine !== null || (previousView.tally !== null && tallyTotal(previousView.tally) > 0));
  const currency = data.meta?.currency || true;
  const epsLine = (row: EarningsRow) =>
    row.epsActual !== null && row.epsEstimate !== null
      ? v.epsLine
          .replace("{actual}", formatPrice(row.epsActual, locale, { currency }))
          .replace("{estimate}", formatPrice(row.epsEstimate, locale, { currency }))
      : null;
  /* Karnesiz panelin sağ hücresi: açık oylamanın eşiği (sıradaki çeyreğin
     EPS beklentisi). Oylama açık değilse ya da beklenti yoksa basılmaz. */
  const voteThreshold =
    nextView && data.next && data.next.epsEstimate !== null ? formatPrice(data.next.epsEstimate, locale, { currency }) : null;
  const accuracy = record?.available ? record.accuracy : null;
  const accuracyPct = accuracy ? accuracyPercent(accuracy) : null;

  const tag = zoneTag(locale);
  const timing = data.next ? timingOf(data.next.hour?.trim() || null, t) : null;
  const clockLine =
    when.window === "amc" && when.closeClock
      ? `~${when.closeClock} ${tag.primary} · ${when.secondaryClock} ${tag.secondary}`
      : when.window === "bmo" && when.openClock
        ? `${c.openLabel} ${when.openClock} ${tag.primary} · ${when.secondaryClock} ${tag.secondary}`
        : null;
  const latest = data.analyses[0] ?? null;
  const p = t.calendarVisuals.companyPage;
  /* KAHRAMANIN ÜÇ HÂLİ (gerekçe `LastReport.tsx`). Yeni açıklanmış rapor,
     sıradaki rapor beklenen hareket ufkunda değilken sonucu gösterir. */
  const sinceLast = data.previous ? daysBetweenEt(data.previous.reportDate, data.today) : null;
  const nextIsNear = daysLeft !== null && daysLeft <= EXPECTED_MOVE_HORIZON_DAYS;
  const heroMode: "next" | "last" | "none" =
    data.previous && data.previous.epsActual !== null && sinceLast !== null && sinceLast <= RECENT_REPORT_DAYS && !nextIsNear
      ? "last"
      : data.next && daysLeft !== null
        ? "next"
        : "none";
  const lastOutcome = data.previous ? voteOutcome(data.previous.epsActual, data.previous.epsEstimate) : null;
  const lastTiming = data.previous ? timingOf(data.previous.hour?.trim() || null, t) : null;
  /* SEKTÖR ÇEVRİLİ (14 Kasım): künye şeridi ham GICS adını basıyordu
     ("Information Technology"); hisse sayfası aynı şirkete "Bilgi
     Teknolojileri" diyor. Aynı yardımcı (`companySector`), aynı sonuç;
     endekste olmayan sembolde sağlayıcının alt sektörü, o da çevrilmiş. */
  const sector =
    companySector(symbol, data.meta?.industry, locale) ?? sectorLabel(data.meta?.sector, locale);

  return (
    <MotionExperience className={css.page}>
      <ScrollProgress />
      <BreadcrumbJsonLd
        locale={locale}
        items={[
          { name: c.breadcrumb, path: "/bilancolar" },
          { name: data.name, path: href },
        ]}
      />

      <nav aria-label={t.common.breadcrumb} className="flex flex-wrap items-center gap-2 text-small text-muted">
        <Link href="/bilancolar" className="tap-44 -my-2 inline-flex min-h-8 items-center py-2 hover:text-primary">
          {c.breadcrumb}
        </Link>
        <span aria-hidden>›</span>
        <span className="font-semibold text-strong">{data.name}</span>
      </nav>

      {/* PAYLAŞ BAŞLIĞIN SAĞINDA — sitenin öteki sayfalarının kalıbı
          (`/teknik-analiz`, `/bilancolar`, `/rehber`: `PageHeader share=`). Yol
          satırında başlık kartının DIŞINDA duruyordu (24 Ekim denetimi). */}
      <PageHeader
        title={copy.title}
        subtitle={copy.answer}
        share={<PageShare compactOnMobile align="right" path={href} title={copy.title} locale={locale} t={t} />}
        /* KÜNYE ŞERİDİ BAŞLIK KARTININ İÇİNDE (31 Ekim). Kartın altında,
           sayfa zemininde ayrı bir satırdı; kartlarla hizasız duruyor ve
           "logo dışta kalmış" diye okunuyordu (sahibinin itirazı). */
        strip={
          /* Künyeler (10 Kasım): gerekçe `CompanyIdentity.tsx`. */
          <CompanyIdentity
            symbol={symbol}
            name={data.name}
            logoUrl={data.meta?.logoUrl}
            facts={[
              data.meta?.marketCap
                ? { label: t.calendarVisuals.companyPage.marketCap, value: formatMoneyCompact(data.meta.marketCap, locale) }
                : null,
              sector ? { label: t.calendarVisuals.companyPage.sector, value: sector } : null,
            ].filter((fact): fact is { label: string; value: string } => fact !== null)}
            latest={
              latest
                ? {
                    label: t.calendarVisuals.companyPage.latestRead,
                    period: latest.periodLabel,
                    href: analysisHref(latest.symbol, latest.period),
                    verdict: verdictOf(latest.verdict),
                    verdictLabel: verdictLabel(verdictOf(latest.verdict), t),
                    score: latest.score,
                  }
                : null
            }
            stock={{ href: `/hisse/${symbol}`, label: c.stockPage }}
          />
        }
      />

      {/* ---- Kahraman yüzey: sıradaki / yeni açıklanmış / tarihsiz ---- */}
      <Panel className={css.hero} data-mode={heroMode}>
        <PanelHeader
          title={heroMode === "next" ? c.nextTitle : heroMode === "last" ? p.lastTitle : c.noneTitle}
          meta={heroMode === "next" && when.estimated ? c.estimatedTag : undefined}
        />
        <div className={css.body}>
          {heroMode === "next" && data.next && daysLeft !== null && (
            <NextReport
              date={data.next.reportDate}
              previousDate={data.previous?.reportDate ?? null}
              today={data.today}
              daysLeft={daysLeft}
              estimated={when.estimated}
              timing={timing}
              clockLine={clockLine}
              eps={
                data.next.epsEstimate !== null
                  ? {
                      estimate: {
                        text: formatPrice(data.next.epsEstimate, locale, { currency }),
                        value: data.next.epsEstimate,
                      },
                      last:
                        lastQuarter?.epsActual != null
                          ? { text: formatPrice(lastQuarter.epsActual, locale, { currency }), value: lastQuarter.epsActual }
                          : null,
                    }
                  : null
              }
              revenue={
                data.next.revenueEstimate !== null
                  ? {
                      estimate: {
                        text: formatMoneyCompact(data.next.revenueEstimate, locale, data.meta?.currency),
                        value: data.next.revenueEstimate,
                      },
                      last:
                        data.previous?.revenueActual != null
                          ? {
                              text: formatMoneyCompact(data.previous.revenueActual, locale, data.meta?.currency),
                              value: data.previous.revenueActual,
                            }
                          : null,
                    }
                  : null
              }
              locale={locale}
              labels={{ ...c, vsLastQuarter: t.calendarVisuals.companyPage.vsLastQuarter }}
            >
              {/* Açıklama çizimin SOL SÜTUNUNDA (10 Kasım; gerekçe
                  `NextReport.tsx` → "TEK KOMPOZİSYON"). Takvim düğmesi 14
                  Kasım'da panelin dip satırına indi (aşağıda). */}
              <p className={css.lead}>{copy.lead}</p>
            </NextReport>
          )}

          {heroMode === "last" && data.previous && sinceLast !== null && (
            <LastReport
              date={data.previous.reportDate}
              daysAgo={sinceLast}
              timing={lastTiming}
              outcome={lastOutcome}
              eps={
                data.previous.epsActual !== null
                  ? {
                      actual: { text: formatPrice(data.previous.epsActual, locale, { currency }), value: data.previous.epsActual },
                      estimate:
                        data.previous.epsEstimate !== null
                          ? { text: formatPrice(data.previous.epsEstimate, locale, { currency }), value: data.previous.epsEstimate }
                          : null,
                    }
                  : null
              }
              revenue={
                data.previous.revenueActual !== null
                  ? {
                      actual: {
                        text: formatMoneyCompact(data.previous.revenueActual, locale, data.meta?.currency),
                        value: data.previous.revenueActual,
                      },
                      estimate:
                        data.previous.revenueEstimate !== null
                          ? {
                              text: formatMoneyCompact(data.previous.revenueEstimate, locale, data.meta?.currency),
                              value: data.previous.revenueEstimate,
                            }
                          : null,
                    }
                  : null
              }
              reactionPct={reactions.get(data.previous.reportDate) ?? null}
              next={data.next ? { date: data.next.reportDate, estimated: when.estimated } : null}
              today={data.today}
              locale={locale}
              labels={{
                reported: p.lastReported,
                today: p.lastToday,
                yesterday: p.lastYesterday,
                daysAgo: p.lastDaysAgo,
                beat: p.lastBeat,
                miss: p.lastMiss,
                inline: p.lastInline,
                eps: p.lastEps,
                revenue: p.lastRevenue,
                actual: p.ledgerActual,
                estimate: p.ledgerEstimate,
                vsEstimate: p.lastVsEstimate,
                reaction: p.lastReaction,
                lastReport: c.lastReport,
                reportDay: c.reportDay,
                cycleAria: c.cycleAria,
              }}
            >
              <p className={css.lead}>
                {(data.previous.epsEstimate !== null ? p.lastLead : p.lastLeadPlain)
                  .replace("{name}", data.name)
                  .replace("{symbol}", symbol)
                  .replace("{date}", formatEtDateLong(data.previous.reportDate, locale))
                  .replace("{actual}", formatPrice(data.previous.epsActual, locale, { currency }))
                  .replace("{estimate}", formatPrice(data.previous.epsEstimate, locale, { currency }))}
              </p>
            </LastReport>
          )}

          {/* Takvimde tarih yokken çizim de yok; kesik kenarlı yaprak ve
              açıklama (gerekçe `LastReport.tsx` → `NoReportDate`). */}
          {heroMode === "none" && (
            <NoReportDate
              leafLabel={p.noneLeaf}
              last={
                data.previous
                  ? { label: p.noneLast, date: formatEtDateLong(data.previous.reportDate, locale) }
                  : null
              }
            >
              <p className={css.lead}>{copy.lead}</p>
            </NoReportDate>
          )}

          {/* DİP SATIR: künye solda, takvim düğmesi sağda, tek hatta (14
              Kasım). Yeni açıklanmış raporda künyenin yerinde sıradaki
              raporun tarihi durur. */}
          {data.next && (
            <div className={css.heroFoot}>
              {heroMode === "last" ? (
                <p className={css.heroNext}>
                  <span>{p.lastNext}</span>
                  <b className="figure">{formatEtDateLong(data.next.reportDate, locale)}</b>
                  {when.estimated && <span className={css.heroNextTag}>{p.lastNextEstimated}</span>}
                </p>
              ) : (
                <p>{c.sourceNote}</p>
              )}
              <AddToCalendar
                symbol={symbol}
                date={data.next.reportDate}
                label={t.earnings.addToCalendar}
                className="mb-0 w-fit shrink-0"
              />
            </div>
          )}
        </div>
      </Panel>

      {/* ---- Beklenti Karnesi: çeyrek defteri ---- */}
      {ledgerRows.length > 0 && (
        <Panel>
          <PanelHeader title={p.ledgerTitle} meta={p.ledgerMeta.replace("{n}", String(Math.min(ledgerRows.length, 8)))} />
          <QuarterLedger
            quarters={pastQuarters}
            reactions={reactions}
            move={
              moves && (moves.implied !== null || moves.average)
                ? { implied: nextIsNear ? moves.implied : null, average: moves.average }
                : null
            }
            currency={money}
            locale={locale}
            labels={{
              beats: p.ledgerBeats,
              avgSurprise: p.ledgerAvgSurprise,
              colQuarter: p.ledgerColQuarter,
              colEps: p.ledgerColEps,
              colSurprise: p.ledgerColSurprise,
              colReaction: p.ledgerColReaction,
              estimate: p.ledgerEstimate,
              actual: p.ledgerActual,
              reactionShort: p.ledgerReactionShort,
              note: p.ledgerNote,
              aria: p.ledgerAria,
              moveTitle: p.moveTitle,
              moveImplied: p.moveImplied,
              moveAverage: p.moveAverage,
              moveCount: p.moveCount,
              moveIndicative: p.moveIndicative,
            }}
          />
        </Panel>
      )}

      {/* ---- Beklentiyi Geçer mi? ----
          Tablo yoksa (`available: false`) panel hiç basılmıyor. */}
      {(nextView || showPrevious) && (
        <Panel>
          <PanelHeader title={v.title} />
          <div className={css.body}>
            {/* İKİ KOLON: solda oy (düğmeler ya da sonuç çizgisi), sağda oyun
                eşiği. 14 Kasım'a dek sağ hücre beklenti karnesiydi (dört
                küçük hücre); karne bir üstteki panelde çeyrek defterine
                dönüştü (`QuarterLedger`), burada sorunun EŞİĞİ kaldı. */}
            {/* KARNE YOKSA EŞİK (10 Kasım, ikinci tur): tek kolonda oy
                kartlarının sağı ~700 piksel boş kalıyordu. Karnesiz panelin
                sağ hücresi oyun sorusunun eşiği (`VoteThreshold`); beklenti
                de yoksa tek kolon. */}
            <div className={voteThreshold ? css.voteGrid : undefined}>
              <div className={css.voteMain}>
                {nextView && (
                  <EarningsVote
                    view={nextView}
                    signedIn={userId !== null}
                    labels={v}
                    lock={lockLabel(new Date(nextView.lockAt), locale)}
                    variant="panel"
                    signInHref={`/giris?devam=${encodeURIComponent(href)}`}
                    signInLabel={p.signInCta}
                    locale={locale}
                    outcomeLine={data.next ? epsLine(data.next) : null}
                  />
                )}
                {showPrevious && previousView && data.previous && (
                  <div className={nextView ? css.previous : undefined}>
                    <p className={css.previousTitle}>
                      {v.previousTitle} · {formatEtDateCompact(data.previous.reportDate, locale)}
                    </p>
                    <EarningsVote
                      view={previousView}
                      signedIn={userId !== null}
                      labels={v}
                      lock={lockLabel(new Date(previousView.lockAt), locale)}
                      variant="panel"
                      signInHref={`/giris?devam=${encodeURIComponent(href)}`}
                      signInLabel={p.signInCta}
                      locale={locale}
                      outcomeLine={epsLine(data.previous)}
                    />
                  </div>
                )}
              </div>
              {voteThreshold && (
                <VoteThreshold
                  title={v.thresholdTitle}
                  value={voteThreshold}
                  note={v.thresholdNote}
                  labels={{ beat: v.beat, miss: v.miss }}
                />
              )}
            </div>
            {accuracy && accuracy.scored > 0 && (
              <p className={css.record}>
                <span className="text-muted">
                  {v.accuracy.replace("{year}", data.today.slice(0, 4))}
                </span>{" "}
                <span className="figure font-semibold text-strong">
                  {v.accuracyValue
                    .replace("{correct}", String(accuracy.correct))
                    .replace("{scored}", String(accuracy.scored))}
                  {accuracyPct !== null && ` · ${formatPercentPlain(accuracyPct, locale, 0)}`}
                </span>
                {accuracy.pending > 0 && (
                  <span className="text-muted"> · {v.accuracyNote.replace("{pending}", String(accuracy.pending))}</span>
                )}
              </p>
            )}
            <div className={css.notes}>
              <p>
                <strong>{v.disclaimer}.</strong> {v.disclaimerNote}
              </p>
            </div>
          </div>
        </Panel>
      )}

      {/* HİKÂYE GİRİŞİ ANALİZ PANELİNİN İÇİNDE, son satır olarak — paneller
          arasında tek başına bir bağlantı satırıydı ve bir panelin künyesi
          gibi değil sayfanın boşluğunda yüzen bir satır gibi okunuyordu
          (24 Ekim denetimi). Hikâye o analizin görünümü; yeri de o panel. */}
      <SymbolAnalyses
        rows={data.analyses}
        locale={locale}
        t={t}
        footer={
          latest && storyGuaranteed({ eps: latest.eps, epsSurprisePct: latest.epsSurprisePct, guidance: null }) ? (
            <Link href={`${analysisHref(latest.symbol, latest.period)}/hikaye`} className={css.storyEntry}>
              <span aria-hidden className={css.storyStack}>
                <span />
                <span />
                <span />
              </span>
              <span className={css.storyText}>
                <span className={css.storyTitle}>
                  {latest.periodLabel} · {c.storyLink}
                </span>
                <span className={css.storyHint}>{t.earningsSeason.story.linkHint}</span>
              </span>
              <ArrowUpRight size={16} weight="bold" aria-hidden className={css.storyArrow} />
            </Link>
          ) : null
        }
      />

      {data.next && (
        <DataStamp source="finnhub" at={data.next.updatedAt} locale={locale} labels={t.data} />
      )}
      {/* Kutusuz açık bölüm, tam genişlikte tek satır (gerekçe `GuideRow.tsx`). */}
      <GuideRow slug="bilanco" label={t.guide.contextLabel} cta={p.guideRead} locale={locale} />
    </MotionExperience>
  );
}
