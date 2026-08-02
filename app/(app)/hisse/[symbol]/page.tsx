import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { Heart } from "@phosphor-icons/react/dist/ssr";
import { and, eq, inArray } from "drizzle-orm";
import { auth } from "@/auth";
import { toggleSymbolFavorite } from "@/app/actions/watchlist";
import { NewsImage } from "@/components/news/NewsImage";
import { PriceChart } from "@/components/stock/PriceChart";
import { chartLabels } from "@/lib/chart-labels";
import {
  ChangePill,
  DataError,
  DataStamp,
  EmptyState,
  Panel,
  PanelHeader,
  PanelLink,
  Skeleton,
} from "@/components/ui/primitives";
import { db } from "@/lib/db";
import { news, watchlistItems, watchlists } from "@/lib/schema";
import {
  getEarningsForSymbol,
  getNextEarnings,
  getGenericImageUrls,
  getStatus,
  getSymbolNames,
  isKnownSymbol,
} from "@/lib/data";
import { rateLimit, requestKey } from "@/lib/rate-limit";
import { getI18n, type Dictionary, type Locale } from "@/lib/i18n";
import { getCompanyProfile, getQuote, getQuotes } from "@/lib/providers";
import { COMPLIANCE_THRESHOLD, screenCompliance } from "@/lib/compliance";
import { industryLabel, sectorLabel } from "@/lib/sectors";
import { indexMemberOf, peersOf } from "@/db/seed/indices";
import { fundMetaOf } from "@/db/seed/symbols";
import { subIndustryName } from "@/db/seed/sub-industries";
import {
  getCompanyNews,
  getEarningsCalendar,
  getEarningsSurprises,
  getKeyMetrics,
  getRecommendations,
} from "@/lib/providers/finnhub";
import { addEtDays, todayEt } from "@/lib/market-hours";
import { describeSymbol } from "@/db/seed/descriptions";
import {
  cn,
  directionOf,
  formatChange,
  formatCompact,
  formatEtDateLong,
  formatEtDateShort,
  formatPrice,
  formatVolume,
  isValidSymbol,
  safeExternalUrl,
  timeAgo,
} from "@/lib/utils";

/* --------------------------------------------------------------------------
   Sağlayıcı kotasını koruyan süzgeç

   YALNIZCA TANINMAYAN SEMBOLLER SINIRLANIR.

   Bir süre tanınan sembollere de dakikada 40'lık bir tavan konmuştu ve bu,
   siteyi kullanılamaz hale getirdi: Next, görüş alanına giren `<Link>`leri
   kendiliğinden ön yüklüyor ve her ön yükleme sunucuda gerçek bir sayfa
   render'ı demek. 500 satırlık Şirketler dizininde biraz aşağı kaydırmak
   tavanı tek başına tüketiyordu; sonrasında kullanıcının GERÇEK tıklamaları
   "Biraz Yavaşla" ekranına düşüyordu. Yani sınır, korumaya çalıştığı
   kullanıcıyı dışarıda bırakıyordu.

   Doğru ayrım kota değil KARDİNALİTE. Tanınan evren `symbols` tablosundaki
   ~500 sembolle sınırlı ve hepsinin sağlayıcı yanıtı önbellekli; ne kadar
   gezilirse gezilsin sağlayıcıya giden istek sayısının bir tavanı var.
   Sayım saldırısının işlemesi için ise TANINMAYAN sembol gerekiyor — sonsuz
   uzay orası. O yüzden tavan yalnızca oraya konuyor.

   Kendi kendini onaran taraf duruyor: gerçek bir hissenin sayfası
   açıldığında `getCompanyProfile` profili `symbols` tablosuna yazıyor, yani
   sembol bir sonraki ziyarette tanınan tarafa geçiyor ve sınırdan çıkıyor.
   Uydurma semboller hiçbir zaman geçmiyor.
   -------------------------------------------------------------------------- */
const UNKNOWN_LIMIT = 10;
const WINDOW_MS = 60_000;

async function allowStockRender(symbol: string): Promise<boolean> {
  if (await isKnownSymbol(symbol)) return true;
  return rateLimit(await requestKey("stock-unknown"), UNKNOWN_LIMIT, WINDOW_MS)
    .allowed;
}

export default async function StockPage(
  props: PageProps<"/hisse/[symbol]">,
) {
  const { symbol: raw } = await props.params;
  const symbol = decodeURIComponent(raw).toUpperCase();
  const { locale, t } = await getI18n();

  if (!isValidSymbol(symbol)) {
    return (
      <EmptyState title={t.stock.notFound} hint={t.stock.notFoundHint} />
    );
  }

  /* Sağlayıcı kotasının en pahalı yüzeyi burası: tanınmayan bir sembolün tam
     sayfası altı ayrı Finnhub ucuna gidiyor (profil, metrik, tavsiye, bilanço
     sürprizi, takvim, haber) ve Finnhub ücretsiz katmanı dakikada 60 istek
     kabul ediyor — yani dakikada ~10 yeni sembol kotayı bitiriyordu. Grafik
     ucundaki iki kademeli sınırın aynısı, aynı gerekçeyle. */
  if (!(await allowStockRender(symbol))) {
    return (
      <EmptyState title={t.stock.throttled} hint={t.stock.throttledHint} />
    );
  }

  /* Fon sayfası ayrı kurgudur: metrikler, analist tavsiyeleri, katılım taraması
     ve sektör benzerleri bir ETF için anlamsızdır — sağlayıcı da bu uçlarda
     boş döner. Yerine fonun künyesi ve izlediği piyasa anlatılır. */
  const fund = fundMetaOf(symbol);
  if (fund) {
    return (
      <div className="flex flex-col gap-5">
        <Suspense fallback={<HeaderSkeleton />}>
          <StockHeader symbol={symbol} locale={locale} t={t} />
        </Suspense>

        <div className="grid gap-5 lg:grid-cols-3">
          <Panel className="min-w-0 p-4 sm:p-5 lg:col-span-2">
            <Suspense fallback={<Skeleton className="h-[300px] w-full sm:h-[430px]" />}>
              <ChartSection symbol={symbol} locale={locale} t={t} />
            </Suspense>
          </Panel>

          <Suspense fallback={<Skeleton className="h-96 w-full rounded-(--radius-xl)" />}>
            <FundCard symbol={symbol} locale={locale} t={t} />
          </Suspense>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <Suspense fallback={<HeaderSkeleton />}>
        <StockHeader symbol={symbol} locale={locale} t={t} />
      </Suspense>

      {/* Üst blok — grafik solda geniş, şirketin kimliği sağda */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Panel className="min-w-0 p-4 sm:p-5 lg:col-span-2">
          <Suspense fallback={<Skeleton className="h-[300px] w-full sm:h-[430px]" />}>
            <ChartSection symbol={symbol} locale={locale} t={t} />
          </Suspense>
        </Panel>

        {/* Sağ kolon grafiğin boyuna geriliyor (ızgara varsayılanı) ama
            kartlar doğal boyunda kaldığı için altta tırtıklı bir boşluk
            kalıyordu. Profil kartı artık artan yeri kendi içine alıyor:
            satırlar boşluğa yayılıyor, kartın alt kenarı grafiğinkiyle
            hizalanıyor. Veri çoksa `flex-1` zaten bağlayıcı olmuyor ve kart
            eskisi gibi içeriği kadar yer kaplıyor. */}
        <div className="flex min-w-0 flex-col gap-5">
          <Panel className="flex flex-1 flex-col">
            <PanelHeader title={t.stock.profile} />
            <Suspense fallback={<ListSkeleton rows={5} />}>
              <ProfileCard symbol={symbol} locale={locale} t={t} />
            </Suspense>
          </Panel>

          <Suspense fallback={<Skeleton className="h-24 w-full rounded-(--radius-xl)" />}>
            <UpcomingEarnings symbol={symbol} locale={locale} t={t} />
          </Suspense>
        </div>
      </div>

      {/* Ölçüler şeridi — üç kart yan yana; dar ekranda kendiliğinden alt alta.
          Eskiden bunlar tek sütuna dizildiği için sağ kolon uzayıp sol taraf
          boş kalıyordu; artık sayfanın tam genişliğini kullanıyorlar. */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(17rem,1fr))] gap-5">
        <Panel>
          <PanelHeader title={t.stock.metrics} />
          <Suspense fallback={<ListSkeleton rows={5} />}>
            <MetricsCard symbol={symbol} locale={locale} t={t} />
          </Suspense>
        </Panel>

        <Panel>
          <PanelHeader title={t.stock.analysts} />
          <Suspense fallback={<ListSkeleton rows={3} />}>
            <AnalystCard symbol={symbol} locale={locale} t={t} />
          </Suspense>
        </Panel>

        <Suspense fallback={<Skeleton className="h-56 w-full rounded-(--radius-xl)" />}>
          <ComplianceCard symbol={symbol} locale={locale} t={t} />
        </Suspense>
      </div>

      {/* Bilanço tablosu tam genişlikte — kolonlar sıkışmadan okunur */}
      <Panel>
        <PanelHeader title={t.stock.pastEarnings} />
        <Suspense fallback={<ListSkeleton rows={4} />}>
          <PastEarnings symbol={symbol} locale={locale} t={t} />
        </Suspense>
      </Panel>

      <Suspense fallback={<Skeleton className="h-48 w-full rounded-(--radius-xl)" />}>
        <PeersCard symbol={symbol} locale={locale} t={t} />
      </Suspense>

      {/* Haberler en altta — mobilde de masaüstünde de son durak */}
      <Panel>
        <PanelHeader title={t.stock.companyNews} />
        <Suspense fallback={<ListSkeleton rows={4} />}>
          <CompanyNews symbol={symbol} locale={locale} t={t} />
        </Suspense>
      </Panel>
    </div>
  );
}

/* ==========================================================================
   Başlık: fiyat + favori yıldızı
   ========================================================================== */

async function StockHeader({
  symbol,
  locale,
  t,
}: {
  symbol: string;
  locale: Locale;
  t: Dictionary;
}) {
  const status = await getStatus();
  const [quoteResult, profileResult, session] = await Promise.all([
    getQuote(symbol, status),
    getCompanyProfile(symbol),
    auth(),
  ]);

  const profile = profileResult.ok ? profileResult.data : null;
  // Fonlarda sağlayıcı profili boş döner — ad ve künye yerel kayıttan gelir.
  const fund = fundMetaOf(symbol);

  let isFavorite = false;
  if (session?.user?.id) {
    try {
      const rows = await db
        .select({ id: watchlistItems.id })
        .from(watchlistItems)
        .innerJoin(watchlists, eq(watchlistItems.watchlistId, watchlists.id))
        .where(
          and(
            eq(watchlists.userId, session.user.id),
            eq(watchlistItems.symbol, symbol),
          ),
        )
        .limit(1);
      isFavorite = rows.length > 0;
    } catch {
      // veri yoksa yıldız pasif kalır
    }
  }

  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-center gap-3">
        {profile?.logoUrl ? (
          <Image
            src={profile.logoUrl}
            alt=""
            width={56}
            height={56}
            className="rounded-(--radius-lg) border border-line bg-white object-contain p-1.5"
          />
        ) : fund ? (
          // Fonun logosu yok; ülke/piyasa bayrağı kimliği taşır
          <span
            aria-hidden
            className="flex size-14 shrink-0 items-center justify-center rounded-(--radius-lg) border border-line bg-surface-elevated text-2xl"
          >
            {fund.flag}
          </span>
        ) : null}
        <div>
          {/* Künye şeridi — borsa · sektör · alt sektör */}
          {(profile?.exchange || profile?.industry) && (
            <p className="text-xs font-semibold uppercase leading-tight tracking-[0.02em] text-muted">
              {[profile?.exchange, industryLabel(profile?.industry, locale)]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
          <div className="mt-[7px] flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="display-ink text-[26px] font-bold tracking-[-0.03em] sm:text-[38px]">
              {profile?.name || fund?.name || symbol}
            </h1>
            <span className="text-base font-semibold text-muted sm:text-[19px]">
              {symbol}
            </span>
            {session?.user && (
              <form action={toggleSymbolFavorite}>
                <input type="hidden" name="symbol" value={symbol} />
                <button
                  type="submit"
                  aria-label={
                    isFavorite ? t.stock.removeFromWatchlist : t.stock.addToWatchlist
                  }
                  title={
                    isFavorite ? t.stock.removeFromWatchlist : t.stock.addToWatchlist
                  }
                  className={cn(
                    "inline-flex size-8 items-center justify-center rounded-(--radius-sm) transition-colors",
                    isFavorite
                      ? "text-primary hover:bg-primary-wash"
                      : "text-muted hover:bg-surface-elevated hover:text-soft",
                  )}
                >
                  <Heart weight={isFavorite ? "fill" : "duotone"} size={17} />
                </button>
              </form>
            )}
          </div>
          {fund && (
            <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] leading-tight text-muted">
              <span className="font-semibold text-soft">
                {locale === "tr" ? fund.labelTr : fund.labelEn}
              </span>
              <span aria-hidden>·</span>
              <span>{locale === "tr" ? fund.tracksTr : fund.tracksEn}</span>
            </p>
          )}
        </div>
      </div>

      {quoteResult.ok ? (
        <div className="w-full text-left sm:w-auto sm:text-right">
          <p className="tote text-[32px] leading-none tracking-[-0.04em] sm:text-[40px]">
            {formatPrice(quoteResult.data.price, locale, { currency: true })}
          </p>
          <div className="mt-1.5 flex items-center justify-start gap-2 sm:justify-end">
            <span
              className={cn(
                "numeral text-sm",
                directionOf(quoteResult.data.change) === "up"
                  ? "text-up"
                  : directionOf(quoteResult.data.change) === "down"
                    ? "text-down"
                    : "text-muted",
              )}
            >
              {formatChange(quoteResult.data.change, locale)}
            </span>
            <ChangePill changePct={quoteResult.data.changePct} locale={locale} />
          </div>
          <DataStamp
            source={quoteResult.source}
            at={quoteResult.fetchedAt}
            stale={quoteResult.stale}
            locale={locale}
            className="mt-1.5 justify-start sm:justify-end"
          />
        </div>
      ) : (
        <div className="text-right">
          <p className="text-sm text-muted">{t.data.failed}</p>
        </div>
      )}
    </header>
  );
}

function HeaderSkeleton() {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-center gap-3">
        <Skeleton className="size-11 rounded-(--radius-md)" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>
      <div className="flex flex-col items-end gap-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-5 w-24" />
      </div>
    </div>
  );
}

/* ==========================================================================
   Grafik — yön rengi günün değişiminden gelir
   ========================================================================== */

function ChartSection({
  symbol,
  locale,
  t,
}: {
  symbol: string;
  locale: Locale;
  t: Dictionary;
}) {
  return (
    <PriceChart symbol={symbol} locale={locale} labels={chartLabels(t)} />
  );
}

/* ==========================================================================
   Profil / metrikler / analistler / bilançolar / haberler
   ========================================================================== */

/** Bilanço kayıtlarının ortak biçimi — DB satırı da sağlayıcı girdisi de buna iner. */
type EarningsItem = {
  reportDate: string;
  hour: string | null;
  epsEstimate: number | null;
  epsActual: number | null;
  revenueEstimate: number | null;
  revenueActual: number | null;
  quarter: number | null;
  year: number | null;
  /** Çeyreğin bittiği tarih — dönem etiketi bunu kullanır (varsa). */
  periodEnd?: string;
};

/**
 * Sembolün bilanço geçmişi + geleceği. Yerel takvim tablosu yalnızca yakın
 * aralığı tutar; kapsam dışı kalan sembollerde Finnhub'ın sembol bazlı
 * takvimi devreye girer (geçmiş ~13 ay, gelecek ~4 ay — 6 saat önbellekli).
 */
async function symbolEarnings(symbol: string): Promise<EarningsItem[]> {
  const today = todayEt();
  const result = await getEarningsCalendar(
    addEtDays(today, -400),
    addEtDays(today, 120),
    symbol,
  );
  return result.ok ? result.data : [];
}

/**
 * Yaklaşan bilanço — sağ kolonun tepesinde pirinç vurgulu kart.
 * Tarih, seans zamanı ve analistlerin EPS + gelir beklentisi bir arada.
 */
async function UpcomingEarnings({
  symbol,
  locale,
  t,
}: {
  symbol: string;
  locale: Locale;
  t: Dictionary;
}) {
  let next: EarningsItem | null = await getNextEarnings(symbol);
  if (!next) {
    const today = todayEt();
    next =
      (await symbolEarnings(symbol))
        .filter((row) => row.reportDate >= today)
        .sort((a, b) => a.reportDate.localeCompare(b.reportDate))[0] ?? null;
  }
  if (!next) return null;

  const earningsHourLabel: Record<string, string> = {
    bmo: t.earnings.beforeOpen,
    amc: t.earnings.afterClose,
    dmh: t.earnings.duringMarket,
  };

  return (
    <Panel className="border-primary-faint bg-primary-tint p-4 sm:p-5">
      <p className="plate text-[9px]">{t.stock.nextEarnings}</p>
      <p className="numeral mt-1.5 text-lg font-bold text-strong">
        {formatEtDateLong(next.reportDate, locale)}
      </p>
      <p className="mt-0.5 text-xs text-soft">
        {next.hour
          ? (earningsHourLabel[next.hour] ?? t.earnings.timeUnknown)
          : t.earnings.timeUnknown}
      </p>
      {(next.epsEstimate !== null || next.revenueEstimate !== null) && (
        <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-line-soft pt-3">
          {next.epsEstimate !== null && (
            <div>
              <dt className="text-[10px] uppercase tracking-wider text-muted">
                {t.earnings.epsEstimate}
              </dt>
              <dd className="numeral mt-0.5 text-sm font-semibold text-strong">
                {formatPrice(next.epsEstimate, locale, { currency: true })}
              </dd>
            </div>
          )}
          {next.revenueEstimate !== null && (
            <div>
              <dt className="text-[10px] uppercase tracking-wider text-muted">
                {t.earnings.revenueEstimate}
              </dt>
              <dd className="numeral mt-0.5 text-sm font-semibold text-strong">
                ${formatCompact(next.revenueEstimate, locale)}
              </dd>
            </div>
          )}
        </dl>
      )}
    </Panel>
  );
}

/**
 * Fon künyesi — ETF'ler için profil kartının karşılığı.
 *
 * Sağlayıcı fonlar hakkında hiçbir şey döndürmediğinden içeriğin tamamı
 * yerel kayıttan gelir: ne izlediği, kim çıkardığı ve fiyatının yerel
 * endeksten nasıl ayrıştığı. Bu ayrım kartın altında açıkça yazılır.
 */
async function FundCard({
  symbol,
  locale,
  t,
}: {
  symbol: string;
  locale: Locale;
  t: Dictionary;
}) {
  const fund = fundMetaOf(symbol);
  if (!fund) return null;

  const about = await describeSymbol(symbol, locale);
  const rows: [string, React.ReactNode][] = [
    [t.stock.fundKind, t.stock.fundKindLabel],
    [t.stock.fundTracks, locale === "tr" ? fund.tracksTr : fund.tracksEn],
    [t.stock.fundIssuer, fund.issuer],
  ];

  return (
    <Panel>
      <PanelHeader title={t.stock.fundProfile} />
      <div className="px-4 py-3 sm:px-5">
        {about && (
          <p className="border-b border-line-soft pb-3 text-[13px] leading-relaxed text-body">
            {about}
          </p>
        )}
        <dl className="divide-y divide-line-soft">
          {rows.map(([label, value]) => (
            <div
              key={label}
              className="flex items-start justify-between gap-3 py-2"
            >
              <dt className="shrink-0 text-xs text-muted">{label}</dt>
              <dd className="text-right text-sm text-body">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 border-t border-line-soft pt-2.5 text-[11px] leading-relaxed text-muted">
          {fund.kind === "country"
            ? t.stock.fundNoteCountry
            : t.stock.fundNoteIndex}
        </p>
      </div>
    </Panel>
  );
}

async function ProfileCard({
  symbol,
  locale,
  t,
}: {
  symbol: string;
  locale: Locale;
  t: Dictionary;
}) {
  const result = await getCompanyProfile(symbol);
  if (!result.ok) {
    return <DataError message={t.data.failed} hint={t.data.failedHint} />;
  }
  const profile = result.data;
  const member = indexMemberOf(symbol);
  const about = await describeSymbol(symbol, locale);
  const websiteHref = safeExternalUrl(profile.weburl);

  const rows: [string, React.ReactNode][] = [
    // GICS sınıflandırması varsa o gösterilir — sağlayıcının serbest metinli
    // sektör alanından daha tutarlıdır.
    [
      t.stock.sector,
      sectorLabel(member?.sector, locale) ??
        industryLabel(profile.industry, locale) ??
        "—",
    ],
    ...(member?.sub
      ? ([[t.stock.industry, subIndustryName(member.sub, locale)]] as [
          string,
          React.ReactNode,
        ][])
      : []),
    [t.stock.exchange, profile.exchange ?? "—"],
    [
      t.market.marketCap,
      profile.marketCap ? (
        <span className="numeral">${formatCompact(profile.marketCap, locale)}</span>
      ) : (
        "—"
      ),
    ],
    [
      t.stock.ipoDate,
      profile.ipoDate ? (
        <span className="numeral">
          {formatEtDateShort(profile.ipoDate, locale)}
        </span>
      ) : (
        "—"
      ),
    ],
  ];

  return (
    <div className="flex flex-1 flex-col px-4 py-3 sm:px-5">
      {/* Şirket ne iş yapar — sektör satırından önce düz cümleyle anlatılır */}
      {about && (
        <p className="border-b border-line-soft pb-3 text-[13px] leading-relaxed text-body">
          {about}
        </p>
      )}
      {/* Satırlar artan yere yayılır: kart grafiğin boyuna gerildiğinde
          altta ölü boşluk yerine nefes alan bir liste kalıyor. İçerik
          kartı zaten dolduruyorsa `justify-between`in etkisi olmuyor. */}
      <dl className="flex flex-1 flex-col justify-between divide-y divide-line-soft">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-3 py-2">
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="text-right text-sm text-body">{value}</dd>
          </div>
        ))}
        {/* Adres sağlayıcıdan geliyor; şeması süzülmeden href'e konmaz. */}
        {websiteHref && (
          <div className="flex items-center justify-between gap-3 py-2">
            <dt className="text-xs text-muted">{t.stock.website}</dt>
            <dd className="min-w-0 text-right text-sm">
              <a
                href={websiteHref}
                target="_blank"
                rel="noopener noreferrer"
                className="block truncate text-primary hover:underline"
              >
                {websiteHref.replace(/^https?:\/\/(www\.)?/, "")}
              </a>
            </dd>
          </div>
        )}
      </dl>
      <DataStamp
        source={result.source}
        at={result.fetchedAt}
        stale={result.stale}
        locale={locale}
        className="mt-2"
      />
    </div>
  );
}

async function MetricsCard({
  symbol,
  locale,
  t,
}: {
  symbol: string;
  locale: Locale;
  t: Dictionary;
}) {
  const status = await getStatus();
  const [metricsResult, quoteResult] = await Promise.all([
    getKeyMetrics(symbol),
    getQuote(symbol, status),
  ]);

  if (!metricsResult.ok) {
    return <DataError message={t.data.failed} />;
  }
  const m = metricsResult.data;
  const quote = quoteResult.ok ? quoteResult.data : null;

  const rows: [string, string][] = [
    [t.stock.peRatio, m.peRatio ? formatPrice(m.peRatio, locale) : "—"],
    [t.stock.eps, m.eps ? formatPrice(m.eps, locale, { currency: true }) : "—"],
    [
      t.stock.dividend,
      m.dividendYield ? `${formatPrice(m.dividendYield, locale)}%` : "—",
    ],
    [t.stock.beta, m.beta ? formatPrice(m.beta, locale) : "—"],
    [
      t.stock.high52,
      m.high52 ? formatPrice(m.high52, locale, { currency: true }) : "—",
    ],
    [
      t.stock.low52,
      m.low52 ? formatPrice(m.low52, locale, { currency: true }) : "—",
    ],
    [t.market.volume, quote?.volume ? formatVolume(quote.volume, locale) : "—"],
  ];

  return (
    <div className="px-4 py-3 sm:px-5">
      <dl className="divide-y divide-line-soft">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-3 py-2">
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="numeral text-sm text-body">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

async function AnalystCard({
  symbol,
  locale,
  t,
}: {
  symbol: string;
  locale: Locale;
  t: Dictionary;
}) {
  const result = await getRecommendations(symbol);
  if (!result.ok) {
    return <DataError message={t.common.noData} />;
  }

  const latest = result.data[0];
  const total =
    latest.strongBuy + latest.buy + latest.hold + latest.sell + latest.strongSell;
  if (total === 0) return <DataError message={t.common.noData} />;

  const segments = [
    { label: t.stock.strongBuy, value: latest.strongBuy, cls: "bg-up" },
    { label: t.stock.buy, value: latest.buy, cls: "bg-up/60" },
    { label: t.stock.hold, value: latest.hold, cls: "bg-flat" },
    { label: t.stock.sell, value: latest.sell, cls: "bg-down/60" },
    { label: t.stock.strongSell, value: latest.strongSell, cls: "bg-down" },
  ];

  return (
    <div className="px-4 py-4 sm:px-5">
      <div className="flex h-2.5 w-full gap-px overflow-hidden rounded-full">
        {segments.map(
          (segment) =>
            segment.value > 0 && (
              <span
                key={segment.label}
                className={segment.cls}
                style={{ width: `${(segment.value / total) * 100}%` }}
                title={`${segment.label}: ${segment.value}`}
              />
            ),
        )}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
        {segments.map((segment) => (
          <li
            key={segment.label}
            className="flex items-center justify-between gap-2 text-xs"
          >
            <span className="flex items-center gap-1.5 text-muted">
              <span aria-hidden className={cn("size-2 rounded-full", segment.cls)} />
              {segment.label}
            </span>
            <span className="numeral text-body">{segment.value}</span>
          </li>
        ))}
      </ul>
      <p className="numeral mt-2 text-[10px] text-muted">
        {new Intl.DateTimeFormat(locale === "tr" ? "tr-TR" : "en-US", {
          month: "long",
          year: "numeric",
          timeZone: "UTC",
        }).format(new Date(`${latest.period}T12:00:00Z`))}
      </p>
    </div>
  );
}

/**
 * Geçmiş bilançolar — dönem başına EPS beklentisi/gerçekleşeni ve sapma;
 * gelir verisi varsa ikinci satırda okunur. Açıklanmamış (gelecek) kayıtlar
 * bu listede yer almaz, onlar Yaklaşan Bilanço kartındadır.
 */
async function PastEarnings({
  symbol,
  locale,
  t,
}: {
  symbol: string;
  locale: Locale;
  t: Dictionary;
}) {
  const today = todayEt();

  // Takvim satırları (yerel tablo, yoksa sağlayıcı) — gelir alanlarını taşır.
  let calRows: EarningsItem[] = (await getEarningsForSymbol(symbol, 12)).filter(
    (row) => row.reportDate < today || row.epsActual !== null,
  );
  if (calRows.length === 0) {
    calRows = (await symbolEarnings(symbol)).filter(
      (row) => row.reportDate < today || row.epsActual !== null,
    );
  }

  /* Kanonik EPS kaynağı earnings surprises'tır: çeyrek başına TEK kayıt ve
     rapor günündeki nihai beklentiyi taşır. Takvim beslemesi aynı çeyrek için
     revizyon kopyaları düşürebiliyor (AAPL'da iki farklı beklenti görüldü) —
     bu yüzden takvim yalnızca gelir/rapor-tarihi zenginleştirmesi yapar. */
  let rows: EarningsItem[];
  const surprises = await getEarningsSurprises(symbol);
  if (surprises.ok) {
    rows = surprises.data.map((s) => {
      const periodMs = new Date(`${s.period}T12:00:00Z`).getTime();
      // Rapor, çeyrek bitiminden ~2-10 hafta sonra gelir; o penceredeki takvim
      // kaydı bu çeyreğe aittir.
      const cal = calRows.find((row) => {
        const diffDays =
          (new Date(`${row.reportDate}T12:00:00Z`).getTime() - periodMs) /
          86400000;
        return diffDays > 0 && diffDays <= 100;
      });
      return {
        reportDate: cal?.reportDate ?? s.period,
        hour: cal?.hour ?? null,
        epsEstimate: s.epsEstimate,
        epsActual: s.epsActual,
        revenueEstimate: cal?.revenueEstimate ?? null,
        revenueActual: cal?.revenueActual ?? null,
        quarter: s.quarter,
        year: s.year,
        periodEnd: s.period,
      };
    });
  } else {
    // Surprises yoksa takvimden devam: aynı güne düşen kopyaları tekille.
    const byDate = new Map<string, EarningsItem>();
    for (const row of calRows) {
      const current = byDate.get(row.reportDate);
      if (!current || (row.epsActual !== null && current.epsActual === null)) {
        byDate.set(row.reportDate, row);
      }
    }
    rows = [...byDate.values()];
  }
  rows.sort((a, b) => b.reportDate.localeCompare(a.reportDate));

  if (rows.length === 0) {
    return <EmptyState title={t.common.noData} />;
  }

  // Dönem etiketi çeyreğin bittiği ayı söyler — mali yıl etiketleri (ör.
  // NVDA'nın FY2027'si) okuyucuyu yanıltır, ay+yıl yanıltmaz.
  const periodLabel = new Intl.DateTimeFormat(
    locale === "tr" ? "tr-TR" : "en-US",
    { month: "short", year: "numeric", timeZone: "UTC" },
  );

  const hasRevenue = rows.some(
    (row) => row.revenueActual !== null || row.revenueEstimate !== null,
  );

  return (
    <div>
      {/* Tablo dar ekranda kendi kabında kayar — sayfa yana kaymaz. */}
      <div className="scroll-x">
        <table className="w-full min-w-[560px] text-sm">
        <thead>
          <tr className="border-b border-line-soft text-left text-[10px] uppercase tracking-wider text-muted">
            <th className="px-4 py-2.5 font-medium sm:px-5">
              {t.earnings.period}
            </th>
            {/* Tablo tam genişlikte olduğu için rapor tarihi kendi kolonunda
                durur; dar ekranda dönem hücresinin altına iner. */}
            <th className="hidden px-3 py-2.5 font-medium md:table-cell">
              {t.earnings.reportDate}
            </th>
            <th className="px-2 py-2.5 text-right font-medium sm:px-3">
              EPS · {t.calendar.forecast}
            </th>
            <th className="px-2 py-2.5 text-right font-medium sm:px-3">
              EPS · {t.calendar.actual}
            </th>
            <th className="px-2 py-2.5 text-right font-medium sm:px-3">
              {t.earnings.surprise}
            </th>
            {hasRevenue && (
              <>
                {/* Gelir beklentisi EPS kadar önemli: piyasa çoğu zaman kârı
                    tutturup geliri ıskalayan şirketi de satar. Beklenen ve
                    gerçekleşen ayrı kolonlarda durur ki karşılaştırılabilsin.
                    Dar ekranda ikisi de gizlenir — tablo kaydırmadan sığar. */}
                <th className="hidden px-2 py-2.5 text-right font-medium sm:px-3 lg:table-cell">
                  {t.earnings.revenueShort} · {t.calendar.forecast}
                </th>
                <th className="hidden px-4 py-2.5 text-right font-medium sm:table-cell sm:px-5">
                  {t.earnings.revenueShort} · {t.calendar.actual}
                </th>
              </>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-line-soft">
          {rows.slice(0, 8).map((row) => {
            const surprise =
              row.epsActual !== null &&
              row.epsEstimate !== null &&
              row.epsEstimate !== 0
                ? ((row.epsActual - row.epsEstimate) /
                    Math.abs(row.epsEstimate)) *
                  100
                : null;
            return (
              <tr key={row.reportDate}>
                <td className="px-4 py-2.5 sm:px-5">
                  <span className="numeral block text-sm font-semibold text-strong">
                    {periodLabel.format(
                      new Date(`${row.periodEnd ?? row.reportDate}T12:00:00Z`),
                    )}
                  </span>
                  <span className="numeral block text-[11px] text-muted md:hidden">
                    {formatEtDateShort(row.reportDate, locale)}
                  </span>
                </td>
                <td className="numeral hidden px-3 py-2.5 text-sm text-body md:table-cell">
                  {formatEtDateShort(row.reportDate, locale)}
                </td>
                <td className="numeral px-2 py-2.5 text-right text-muted sm:px-3">
                  {row.epsEstimate !== null
                    ? formatPrice(row.epsEstimate, locale, { currency: true })
                    : "—"}
                </td>
                <td className="numeral px-2 py-2.5 text-right font-semibold text-strong sm:px-3">
                  {row.epsActual !== null
                    ? formatPrice(row.epsActual, locale, { currency: true })
                    : "—"}
                </td>
                <td className="px-2 py-2.5 text-right sm:px-3">
                  {surprise !== null ? (
                    <ChangePill changePct={surprise} locale={locale} size="sm" />
                  ) : (
                    <span className="text-xs text-muted">—</span>
                  )}
                </td>
                {hasRevenue && (
                  <>
                    <td className="numeral hidden px-2 py-2.5 text-right text-muted sm:px-3 lg:table-cell">
                      {row.revenueEstimate !== null
                        ? `$${formatCompact(row.revenueEstimate, locale)}`
                        : "—"}
                    </td>
                    <td className="numeral hidden px-4 py-2.5 text-right text-body sm:table-cell sm:px-5">
                      {row.revenueActual !== null ? (
                        <span className="font-semibold text-strong">
                          ${formatCompact(row.revenueActual, locale)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
        </table>
      </div>

      {/* Tablo kısaltmalarının karşılığı — EPS ne demek, sapma neye göre.
          Rakamı okuyanın sözlüğe gitmesi gerekmesin. */}
      <p className="mt-3 border-t border-line-soft px-4 pt-3 text-[12.5px] leading-relaxed text-muted sm:px-5">
        <b className="font-semibold text-soft">{t.earnings.epsFull}</b>{" "}
        {t.earnings.epsExplainer}
      </p>
    </div>
  );
}

/**
 * Katılım taraması — faaliyet alanı + AAOIFI finansal eşikleri.
 * Sonuç bir fetva değil, ön elemedir; kartın altındaki not bunu söyler.
 */
async function ComplianceCard({
  symbol,
  locale,
  t,
}: {
  symbol: string;
  locale: Locale;
  t: Dictionary;
}) {
  const status = await getStatus();
  const [metricsResult, quoteResult] = await Promise.all([
    getKeyMetrics(symbol),
    getQuote(symbol, status),
  ]);

  const metrics = metricsResult.ok ? metricsResult.data : null;
  const price = quoteResult.ok ? quoteResult.data.price : null;

  const result = screenCompliance({
    symbol,
    price,
    bookValuePerShare: metrics?.bookValuePerShare ?? null,
    debtToEquity: metrics?.debtToEquity ?? null,
    cashPerShare: metrics?.cashPerShare ?? null,
  });

  const verdictLabel =
    result.verdict === "pass"
      ? t.stock.compliancePass
      : result.verdict === "fail"
        ? t.stock.complianceFail
        : t.stock.complianceReview;

  const verdictClass =
    result.verdict === "pass"
      ? "bg-up-wash text-up"
      : result.verdict === "fail"
        ? "bg-down-wash text-down"
        : "bg-surface-elevated text-body";

  const ratios: [string, number | null][] = [
    [t.stock.complianceDebt, result.debtRatio],
    [t.stock.complianceCash, result.cashRatio],
  ];

  return (
    <Panel>
      <PanelHeader title={t.stock.compliance} />
      <div className="px-4 py-4 sm:px-5">
        <span
          className={cn(
            "inline-flex rounded-full px-3 py-1 text-xs font-semibold",
            verdictClass,
          )}
        >
          {verdictLabel}
        </span>

        {result.businessReasonKey && (
          <p className="mt-2.5 text-xs leading-relaxed text-body">
            {t.stock.complianceReasons[result.businessReasonKey]}
          </p>
        )}

        {result.ratiosKnown ? (
          <dl className="mt-3 flex flex-col gap-2.5">
            {ratios.map(([label, value]) => {
              const over = value !== null && value >= COMPLIANCE_THRESHOLD;
              const width =
                value === null
                  ? 0
                  : Math.min((value / COMPLIANCE_THRESHOLD) * 100, 100);
              return (
                <div key={label}>
                  <div className="flex items-baseline justify-between gap-2">
                    <dt className="text-[11px] leading-tight text-muted">
                      {label}
                    </dt>
                    <dd
                      className={cn(
                        "numeral shrink-0 text-xs font-semibold",
                        over ? "text-down" : "text-strong",
                      )}
                    >
                      {value !== null
                        ? `${formatPrice(value, locale, { digits: 1 })}%`
                        : "—"}
                    </dd>
                  </div>
                  {/* Eşiğe ne kadar yakın — çubuk %33'te dolar */}
                  <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-surface-sunken">
                    <div
                      className={cn("h-full", over ? "bg-down" : "bg-up")}
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
              );
            })}
            <p className="numeral text-[10px] text-muted">
              {t.stock.complianceLimit}: %{COMPLIANCE_THRESHOLD}
            </p>
          </dl>
        ) : (
          <p className="mt-3 text-xs text-muted">{t.stock.complianceUnknown}</p>
        )}

        <p className="mt-3 border-t border-line-soft pt-2.5 text-[10px] leading-relaxed text-muted">
          {t.stock.complianceMissing}
        </p>
        <p className="mt-1.5 text-[10px] leading-relaxed text-muted">
          {t.stock.complianceDisclaimer}
        </p>
      </div>
    </Panel>
  );
}

/**
 * Aynı alt sektördeki şirketler — piyasa değerine göre en büyük sekiz isim,
 * sayfanın tam genişliğinde kart ızgarası olarak. Sınıflandırma GICS'ten
 * gelir; fiyatlar canlı. Aynı şirketin ikinci hisse sınıfı listeye girmez.
 */
async function PeersCard({
  symbol,
  locale,
  t,
}: {
  symbol: string;
  locale: Locale;
  t: Dictionary;
}) {
  const member = indexMemberOf(symbol);
  const peers = peersOf(symbol);
  if (peers.length === 0) return null;

  const meta = await getSymbolNames(peers.map((peer) => peer.symbol));
  const ranked = [...peers]
    .sort(
      (a, b) =>
        (meta[b.symbol]?.marketCap ?? 0) - (meta[a.symbol]?.marketCap ?? 0),
    )
    .slice(0, 8);

  const status = await getStatus();
  const result = await getQuotes(
    ranked.map((peer) => peer.symbol),
    status,
  );
  const quotes = result.ok ? result.data : {};

  /* Karşılaştırma bağlantısı buraya konuyor çünkü soru tam burada doğuyor:
     benzer dört şirketi yan yana gören biri "hangisi" diye sorar. Sembol
     listesi bu hissenin kendisiyle başlar ve en büyük üç rakiple dolar. */
  const compareSymbols = [symbol, ...ranked.map((peer) => peer.symbol)]
    .filter((entry, index, list) => list.indexOf(entry) === index)
    .slice(0, 4);

  return (
    <Panel>
      <PanelHeader
        title={t.stock.peers}
        action={
          <PanelLink href={`/karsilastir?semboller=${compareSymbols.join(",")}`}>
            {t.compare.addCta} →
          </PanelLink>
        }
      />
      {member?.sub && (
        <p className="border-b border-line-soft px-4 py-2 text-[11px] text-muted sm:px-5">
          {t.stock.peersHint}:{" "}
          <span className="text-soft">
            {subIndustryName(member.sub, locale)}
          </span>
        </p>
      )}
      <ul className="grid grid-cols-2 gap-2.5 p-4 lg:grid-cols-4 sm:px-5">
        {ranked.map((peer) => {
          const quote = quotes[peer.symbol];
          return (
            <li key={peer.symbol} className="min-w-0">
              <Link
                href={`/hisse/${peer.symbol}`}
                className="flex h-full flex-col justify-between gap-2.5 rounded-(--radius-lg) border border-line-soft bg-surface-elevated px-3.5 py-3 transition-colors hover:border-line-strong hover:bg-primary-tint"
              >
                <span className="min-w-0">
                  <span className="numeral block text-sm font-bold text-strong">
                    {peer.symbol}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-muted">
                    {peer.name}
                  </span>
                </span>
                {quote ? (
                  <span className="flex flex-wrap items-center justify-between gap-1.5">
                    <span className="numeral text-sm text-body">
                      {formatPrice(quote.price, locale)}
                    </span>
                    <ChangePill
                      changePct={quote.changePct}
                      locale={locale}
                      size="sm"
                    />
                  </span>
                ) : (
                  <span className="text-xs text-muted">—</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

async function CompanyNews({
  symbol,
  locale,
  t,
}: {
  symbol: string;
  locale: Locale;
  t: Dictionary;
}) {
  const to = todayEt();
  const from = addEtDays(to, -14);
  const result = await getCompanyNews(symbol, from, to);

  if (!result.ok || result.data.length === 0) {
    return <EmptyState title={t.news.empty} />;
  }

  const shown = result.data.slice(0, 8);

  /* Haber önce SİTE İÇİNDE okunur; kaynak bağlantısı detay sayfasındadır.
     Şirket haberleri canlı uçtan gelir ve genel akış tablosunda olmayabilir —
     görüntülendiği anda tabloya işlenir, bağlantı kalıcı id ile kurulur. */
  let idByProvider = new Map<string, string>();
  /* Şirket haberleri canlı uçtan İngilizce geliyor; günlük senkron ise
     tabloya Türkçe başlığı yazıyor. Aynı okumada çeviriyi de alıp varsa onu
     gösteriyoruz — yoksa liste, akış sayfasında Türkçe olan bir haberi
     burada İngilizce göstermeye devam ederdi. */
  let trByProvider = new Map<string, string>();
  try {
    await db
      .insert(news)
      .values(
        shown.map((item) => ({
          providerId: item.providerId,
          headline: item.headline,
          summary: item.summary,
          url: item.url,
          imageUrl: item.imageUrl,
          source: item.source,
          category: item.category,
          symbols: item.symbols,
          publishedAt: item.publishedAt,
        })),
      )
      .onConflictDoNothing();
    const rows = await db
      .select({
        id: news.id,
        providerId: news.providerId,
        headlineTr: news.headlineTr,
      })
      .from(news)
      .where(
        inArray(
          news.providerId,
          shown.map((item) => item.providerId),
        ),
      );
    idByProvider = new Map(rows.map((row) => [row.providerId, row.id]));
    trByProvider = new Map(
      rows
        .filter((row) => row.headlineTr)
        .map((row) => [row.providerId, row.headlineTr as string]),
    );
  } catch {
    // DB yazılamazsa haberler kaynağa bağlanır — liste yine çalışır.
  }

  /* Küçük resim burada da var artık: haber akışı ve ana sayfa listesi
     gösteriyordu, şirket sayfası göstermiyordu ve aynı haber iki ekranda
     farklı görünüyordu. Jenerik görseller (kaynak logosu) elenir — aynı
     logonun sekiz satırda tekrar etmesi listeyi taranabilir yapmıyor,
     bozuyor. */
  const genericImages = await getGenericImageUrls(
    shown.map((item) => item.imageUrl),
  );

  return (
    <ul className="divide-y divide-line-soft">
      {shown.map((item) => {
        const newsId = idByProvider.get(item.providerId);
        const inner = (
          <span className="flex items-start gap-3">
            <span className="min-w-0 flex-1">
              <span className="line-clamp-2 block text-sm font-medium leading-snug text-strong">
                {(locale === "tr" && trByProvider.get(item.providerId)) ||
                  item.headline}
              </span>
              <span className="mt-1 flex items-center gap-1.5 text-[11px] text-muted">
                {item.source && <span>{item.source}</span>}
                <span aria-hidden>·</span>
                <span>{timeAgo(item.publishedAt, locale)}</span>
              </span>
            </span>
            <NewsImage
              src={
                item.imageUrl && !genericImages.has(item.imageUrl)
                  ? item.imageUrl
                  : null
              }
              symbol={symbol}
              sizeClass="size-14"
            />
          </span>
        );
        // Kaynak adresi sağlayıcıdan; şeması süzülmezse href'e konmaz.
        const sourceHref = safeExternalUrl(item.url);
        return (
          <li key={item.providerId}>
            {newsId ? (
              <Link
                href={`/haberler/${newsId}`}
                className="block px-4 py-3 transition-colors hover:bg-primary-tint sm:px-5"
              >
                {inner}
              </Link>
            ) : sourceHref ? (
              <a
                href={sourceHref}
                target="_blank"
                rel="noopener noreferrer"
                className="block px-4 py-3 transition-colors hover:bg-surface-elevated sm:px-5"
              >
                {inner}
              </a>
            ) : (
              <div className="block px-4 py-3 sm:px-5">{inner}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function ListSkeleton({ rows }: { rows: number }) {
  return (
    <div className="flex flex-col gap-2 px-4 py-3 sm:px-5">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-8 w-full" />
      ))}
    </div>
  );
}
