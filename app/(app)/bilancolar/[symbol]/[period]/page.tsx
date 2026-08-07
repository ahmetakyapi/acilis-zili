import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  Article,
  CalendarBlank,
  Scales,
  Star,
  TrendUp,
  Warning,
} from "@phosphor-icons/react/dist/ssr";
import { GuideHint } from "@/components/article/GuideHint";
import { Panel, SymbolBadge } from "@/components/ui/primitives";
import { ScoreRing } from "@/components/earnings/ScoreRing";
import { MetricCards } from "@/components/earnings/MetricCards";
import { RevenueColumns } from "@/components/earnings/RevenueColumns";
import { GuidanceRanges } from "@/components/earnings/GuidanceRanges";
import type { FooterStat } from "@/components/earnings/ChartFooter";
import { RichText } from "@/components/earnings/RichText";
import { toggleSymbolFavorite } from "@/app/actions/watchlist";
import { auth } from "@/auth";
import {
  getAnalysis,
  getEarningsBetween,
  getStatus,
  getSymbolNames,
  getUserSymbols,
} from "@/lib/data";
import { getQuotes } from "@/lib/providers";
import { addEtDays, todayEt } from "@/lib/market-hours";
import { getI18n, type Dictionary, type Locale } from "@/lib/i18n";
import {
  verdictLabel,
  verdictOf,
  verdictTextClass,
  type VerdictKey,
} from "@/lib/analysis";
import { sectorGroupLabel, sectorGroupOf } from "@/lib/sectors";
import {
  cn,
  formatCompact,
  formatEtDateCompact,
  formatEtDateLong,
  formatPercent,
  formatPercentPlain,
  formatPrice,
} from "@/lib/utils";
import type { EarningsAnalysisRow } from "@/lib/schema";

/**
 * Bilanço detayı — bir çeyreğin okunmuş hâli.
 *
 * Sıra karnedekiyle aynı ve bilinçli: görüş şeridi → altı metrik kartı →
 * çeyreklik gelir + öngörü aralıkları → CEO şeridi → özet → detaylı
 * değerlendirme → güçlü yönler/riskler/beklenen gelişmeler. Sayfa uzun
 * metinle açılıyordu ve çeyreğin rakamları dokuz paragrafın gölgesinde
 * kalıyordu; rakamı gören okuyucu artık metne inmek zorunda değil.
 *
 * Sağda sabit kalan referans kolonu yalnızca karne ve yaklaşan bilançolar
 * taşır. Metrikler ve CEO alıntısı oradan ANA kolona alındı: ikisi de
 * çeyreğin hikâyesinin parçası, kenarda duran birer referans değil.
 * Mobilde tek kolona düşer ve karne en üste çıkar.
 */

/**
 * Metin panellerinin sütun düzeni.
 *
 * Satır boyu okunur bandın (50-75 karakter) içinde kalsın diye sütun sayısı
 * genişlikle birlikte artıyor: telefonda tek, tablette iki, geniş ekranda
 * üç. Sabit bir `max-w` bunu yapamıyordu — dar ekranda gereksiz kısıtlıyor,
 * geniş ekranda panelin sağ yarısını boş bırakıyordu.
 */
const PROSE_COLUMNS =
  "columns-1 gap-x-8 md:columns-2 xl:columns-3 [column-rule:1px_solid_var(--line-soft)]";

/**
 * Küçük büyük-harf etiket — `.plate`'in rengi serbest bırakılmış hâli.
 *
 * `.plate` katmansız bir kural olduğu için yanına yazılan `text-primary`
 * uygulanmıyor (aynı tuzak `components/today/DayRail.tsx` içinde de anlatılı).
 */
const PLATE_LABEL =
  "text-[10px] font-bold uppercase leading-none tracking-[0.09em]";

/**
 * Panel başlığı — ikon karosu, başlık, sağda künye.
 *
 * Güçlü Yönler / Riskler kartlarıyla aynı dil: sayfadaki her panel aynı
 * biçimde açılıyor, çıplak bir `<h2>` kalanın yanında yarım duruyordu.
 */
function PanelHead({
  icon: Icon,
  title,
  meta,
}: {
  icon: typeof Article;
  title: string;
  meta?: string;
}) {
  return (
    /* flex-wrap: künye metni ("Açılış Zili Analiz Ekibi") telefonda başlığı
       iki satıra sıkıştırıyordu — sığmadığında kendi satırına düşer, başlık
       hep tek satır kalır. */
    <div className="mb-4 flex flex-wrap items-center gap-x-2.5 gap-y-1 border-b border-line-soft pb-3">
      <span
        aria-hidden
        className="flex size-7 shrink-0 items-center justify-center rounded-[9px] bg-primary-wash text-primary"
      >
        <Icon weight="duotone" size={15} />
      </span>
      <h2 className="whitespace-nowrap text-[15px] font-bold tracking-[-0.01em] text-strong">
        {title}
      </h2>
      {meta && (
        <span className="plate ml-auto shrink-0 text-[10px] tracking-[0.09em]">
          {meta}
        </span>
      )}
    </div>
  );
}

export async function generateMetadata(
  props: PageProps<"/bilancolar/[symbol]/[period]">,
): Promise<Metadata> {
  const { symbol, period } = await props.params;
  const { locale } = await getI18n();
  const row = await getAnalysis(symbol.toUpperCase(), period, locale);
  if (!row) return { title: "404" };
  return {
    title: `${row.company} ${row.periodLabel} — ${row.symbol}`,
    description: row.headline,
  };
}

export default async function AnalysisDetailPage(
  props: PageProps<"/bilancolar/[symbol]/[period]">,
) {
  const params = await props.params;
  const symbol = params.symbol.toUpperCase();
  const period = params.period;

  const { locale, t } = await getI18n();
  const row = await getAnalysis(symbol, period, locale);
  if (!row) notFound();

  const session = await auth();
  const today = todayEt();
  const status = await getStatus();

  const [meta, userSymbols, upcomingRows, quotes] = await Promise.all([
    getSymbolNames([symbol]),
    session?.user?.id ? getUserSymbols(session.user.id) : Promise.resolve([]),
    getEarningsBetween(today, addEtDays(today, 30)),
    getQuotes([symbol], status),
  ]);

  /* ---- Canlı kotasyon ----
     Kayıttaki `price` bilanço GÜNÜNÜN kapanışı ve donuk; okuyucunun bir
     sonraki sorusu "peki şimdi kaçtan işlem görüyor". Kotasyon gelmezse
     (anahtar yok, sağlayıcı düştü) blok hiç basılmaz — sayfa çalışmaya
     devam eder, yerinde boş bir kutu durmaz. */
  const live =
    quotes.ok && quotes.data[symbol]
      ? { quote: quotes.data[symbol], stale: quotes.stale }
      : null;
  /* Bilanço gününden bugüne değişim: iki sayı da elimizde, aradaki oran
     yeni bir iddia değil. Aynı günse anlamsız, o zaman yazılmaz. */
  const sinceReportRaw =
    live && row.price !== null && row.price > 0
      ? ((live.quote.price - row.price) / row.price) * 100
      : null;
  /* Yuvarlandığında sıfıra düşüyorsa hiç yazılmıyor: hisse o kapanıştan beri
     işlem görmediyse "bilanço gününden bugüne %0,0" satırı bilgi değil
     gürültü, üstelik hata gibi okunuyor. */
  const sinceReportPct =
    sinceReportRaw !== null && Math.abs(sinceReportRaw) >= 0.05
      ? sinceReportRaw
      : null;

  const symbolMeta = meta[symbol];
  const watched = userSymbols.includes(symbol);
  const verdict = verdictOf(row.verdict);
  const group = sectorGroupOf(symbolMeta?.industry);

  /* Sağ kolondaki "Yaklaşan Bilançolar": aynı sektörden en büyük üç şirket.
     Rastgele bir liste değil — okuyucu bu şirketin sonucunu okuduktan sonra
     doğal olarak rakiplerine bakıyor. */
  const peerMeta = await getSymbolNames([
    ...new Set(upcomingRows.map((r) => r.symbol)),
  ]);
  const peers = upcomingRows
    .filter(
      (r) =>
        r.symbol !== symbol &&
        sectorGroupOf(peerMeta[r.symbol]?.industry).key === group.key,
    )
    .sort(
      (a, b) =>
        (peerMeta[b.symbol]?.marketCap ?? 0) -
        (peerMeta[a.symbol]?.marketCap ?? 0),
    )
    .slice(0, 3);

  const langNote = row.locale === locale ? null : t.analysis.fallbackNote;
  const sources = row.sources ?? [];
  const hasColumns = (row.quarterlyRevenue?.length ?? 0) > 0;
  /* Sütun grafiğinin ölçeği: birim BAŞLIKTA bir kez söyleniyor, sütunlarda
     çıplak sayı kalıyor. Eşik en büyük çeyreğe bakıyor — bir şirketin geliri
     milyar bandındaysa hepsi milyar yazılır, milyon bandındaysa hepsi
     milyon; aynı grafikte iki farklı birim olmaz. */
  const revenueMax = Math.max(
    0,
    ...(row.quarterlyRevenue ?? []).map((bar) => bar.value),
  );
  const revenueScale = revenueMax >= 1e9 ? 1e9 : 1e6;
  const revenueUnit =
    revenueScale === 1e9 ? t.analysis.unitBillionUsd : t.analysis.unitMillionUsd;
  const hasGuidance = (row.guidance?.length ?? 0) > 0;

  /* ---- Grafik künyeleri ----
     Karnede grafiklerin altında üçer mini ölçü duruyor ve kartı tamamlayan
     şey o; onsuz kart "işte bir grafik" diyor. Alanlar sonradan eklendiği
     için analizlerin çoğunda boş — o zaman künye KAYITTAKİ sayılardan
     kuruluyor. Uydurma değil: üçü de gövdede zaten duran, sayfanın başka
     yerinde de basılan ölçüler; burada grafiğin bağlamı olarak
     tekrarlanıyorlar.

     Sütun grafiğinin altına çeyreğin GERÇEKLEŞEN üç ölçüsü, öngörü kartının
     altına GELECEĞE dair üç künye — her kart kendi zamanına bakıyor. */
  const toneOf = (value: number) => (value >= 0 ? "up" : "down");
  const arrow = (value: number) => (value >= 0 ? "▲" : "▼");
  const revenueFooter: FooterStat[] = row.revenueFooter?.length
    ? row.revenueFooter
    : ([
        row.revenueYoyPct !== null && {
          label: t.analysis.revenueGrowthYoy,
          value: `${arrow(row.revenueYoyPct)} ${formatPercentPlain(row.revenueYoyPct, locale, 0)}`,
          tone: toneOf(row.revenueYoyPct),
        },
        row.epsSurprisePct !== null && {
          label: t.analysis.epsSurprise,
          value: `${arrow(row.epsSurprisePct)} ${formatPercentPlain(row.epsSurprisePct, locale, 0)}`,
          tone: toneOf(row.epsSurprisePct),
        },
        row.reactionPct !== null && {
          label: t.analysis.stockReaction,
          value: `${arrow(row.reactionPct)} ${formatPercentPlain(row.reactionPct, locale, 1)}`,
          tone: toneOf(row.reactionPct),
        },
      ].filter(Boolean) as FooterStat[]);
  const guidanceFooter: FooterStat[] = row.guidanceFooter?.length
    ? row.guidanceFooter
    : ([
        row.nextPeriodLabel && {
          label: t.analysis.nextPeriod,
          value: row.nextPeriodLabel,
        },
        row.nextReportEstimate && {
          label: t.analysis.nextEarnings,
          value: row.nextReportEstimate,
        },
        row.targetPrice !== null && {
          label: row.analystCount
            ? t.analysis.analystTargetCount.replace(
                "{count}",
                String(row.analystCount),
              )
            : t.analysis.analystTarget,
          value: formatPrice(row.targetPrice, locale, { currency: true }),
        },
      ].filter(Boolean) as FooterStat[]);

  /* Kapanış şeridinde kaç kart basılacak: karne yalnızca görsel varsa,
     rakip takvimi yalnızca aynı sektörden yaklaşan bilanço varsa çıkıyor;
     rehber şeridi her zaman var. */
  const bottomCards =
    1 + (row.cardImageUrl ? 1 : 0) + (peers.length > 0 ? 1 : 0);

  return (
    <div className="flex flex-col gap-5">
      {/* ---- Künye ---- */}
      <nav
        aria-label="breadcrumb"
        className="flex flex-wrap items-center gap-2 text-[12.5px] text-muted"
      >
        <Link href="/bilancolar/analizler" className="hover:text-primary">
          {t.analysis.title}
        </Link>
        <span aria-hidden>›</span>
        <Link
          href={`/bilancolar/analizler?filtre=${group.key}`}
          className="hover:text-primary"
        >
          {sectorGroupLabel(group, locale)}
        </Link>
        <span aria-hidden>›</span>
        <span className="font-semibold text-strong">
          {row.company} · {row.periodLabel}
        </span>
      </nav>

      {/* ---- Şirket başlığı ----
          İKİ SATIR: üstte kimlik, altta ölçüler.

          Bir süre kimlik SOLDA, ölçüler SAĞDA iki sütun hâlindeydi. Ölçü
          sütunu üç katmana çıkınca (bilanço günü → bugün → büyüklük) sol
          sütundan iki kat uzun oldu; kimlik kısa bir bloktur ve altındaki
          çipler `mt-auto` ile tabana yapıştığı için aralarında kocaman bir
          delik kaldı. Sütunları eşit uzunlukta içerikle doldurmanın yolu
          yok — biri iki satır, öteki altı.

          Ölçüler alt satıra alınıp yatay bir şeride dönüşünce delik
          kapanıyor, her ölçü kendi sütununda okunuyor ve şerit kartın
          genişliğini gerçekten kullanıyor. */}
      <header className="flex flex-col gap-4 rounded-[16px] border border-line bg-surface p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
          <div className="flex min-w-0 flex-1 flex-col gap-3.5">
            <div className="flex min-w-0 items-start gap-3.5 sm:gap-4">
              {symbolMeta?.logoUrl ? (
                <Image
                  src={symbolMeta.logoUrl}
                  alt=""
                  width={56}
                  height={56}
                  className="size-14 shrink-0 rounded-[13px] border border-line bg-white object-contain p-1"
                />
              ) : (
                <SymbolBadge symbol={symbol} />
              )}
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="display-ink w-fit text-[24px] font-bold tracking-[-0.035em]">
                    {row.company}
                  </h1>
                  <Link
                    href={`/hisse/${symbol}`}
                    className="rounded-md border border-primary-faint bg-primary-wash px-2 py-[3px] text-[11px] font-bold text-primary hover:bg-primary-tint"
                  >
                    {symbol}
                    {row.exchange ? ` · ${row.exchange}` : ""}
                  </Link>
                </div>
                {row.sector && (
                  <p className="text-xs font-medium text-muted">{row.sector}</p>
                )}
              </div>
            </div>

            {/* Künye çipleri ve takip düğmesi AYNI satırda: düğme kendi
                satırında dururken sol sütunun tabanında yetim kalıyordu ve
                blok dört gevşek satıra yayılıyordu. `sm:ml-auto` onu ayracın
                dibine yaslıyor — satır artık sol sütunu boydan boya
                kapatıyor ve blok iki sıkı satıra iniyor. Yükseklikleri de
                aynı, yan yana bir aile gibi duruyorlar. */}
            <div className="flex flex-wrap items-center gap-1.5">
              {/* Bu künye bir süre dolu siyah bir kutuydu. Sayfadaki en koyu
                  yüzey oydu ve gözü ilk oraya çekiyordu — oysa taşıdığı bilgi
                  bir tarih, sayfanın en önemli şeyi değil. Komşusuyla aynı
                  aileye alındı: ikisi de kenarlıklı çip, biri nötr (olmuş
                  olan), öteki accent (olacak olan). */}
              <span className="inline-flex min-h-7 items-center gap-1.5 rounded-md border border-line bg-surface-solid px-2.5 text-[10.5px] font-bold text-body">
                <CalendarBlank weight="duotone" size={12} className="text-muted" />
                {t.analysis.earningsOf.replace("{period}", row.periodLabel)} ·{" "}
                {formatEtDateLong(row.reportDate, locale)}
              </span>
              {row.nextPeriodLabel && (
                <span className="inline-flex min-h-7 items-center rounded-md border border-primary-faint bg-primary-wash px-2.5 text-[10.5px] font-bold text-primary">
                  {t.analysis.nextEarnings}: {row.nextPeriodLabel}
                  {row.nextReportEstimate ? ` · ${row.nextReportEstimate}` : ""}
                </span>
              )}
              {langNote && (
                <span className="inline-flex min-h-7 items-center rounded-md bg-surface-elevated px-2.5 text-[10.5px] font-semibold text-muted">
                  {langNote}
                </span>
              )}

              {session?.user && (
                <form action={toggleSymbolFavorite} className="sm:ml-auto">
                  <input type="hidden" name="symbol" value={symbol} />
                  <button
                    type="submit"
                    className={cn(
                      "inline-flex min-h-7 items-center gap-1.5 rounded-md border px-2.5 text-[10.5px] font-bold transition-colors",
                      watched
                        ? "border-primary-faint bg-primary-wash text-primary"
                        : "border-line bg-surface-solid text-body hover:border-line-strong hover:text-strong",
                    )}
                  >
                    <Star weight={watched ? "fill" : "duotone"} size={12} />
                    {watched ? t.stock.removeFromWatchlist : t.stock.addToWatchlist}
                  </button>
                </form>
              )}
            </div>
          </div>

        </div>

        {/* ---- Ölçü şeridi ----
            Dört ölçü yan yana, aralarında dikey hairline: bilanço günü ne
            oldu → bugün nerede → şirket ne büyüklükte → yıl nasıl geçti.
            Sıra bilinçli; okuyucu soldan sağa giderek zaman içinde
            ilerliyor. Dar ekranda ikişerli, telefonda alt alta. */}
        {row.price !== null && (
          <dl className="grid gap-x-5 gap-y-4 border-t border-line pt-4 sm:grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-line">
            <div className="min-w-0 lg:pr-5">
              <dt className="flex items-baseline justify-between gap-2">
                <span className={cn(PLATE_LABEL, "text-body")}>
                  {t.analysis.closePrice}
                </span>
                <span className="shrink-0 text-[10.5px] font-medium text-muted">
                  {formatEtDateCompact(row.reportDate, locale)}
                </span>
              </dt>
              <dd className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <span className="figure text-[26px] font-bold leading-none tracking-[-0.04em] text-strong">
                  {formatPrice(row.price, locale, { currency: true })}
                </span>
                {row.reactionPct !== null && (
                  /* Tepki bir süre 11px'lik bir rozetti ve yanındaki büyük
                     fiyatın gölgesinde kalıyordu — oysa "bilanço hisseyi ne
                     yaptı" sorusunun cevabı o. */
                  <span
                    className={cn(
                      "figure inline-flex items-baseline gap-1 rounded-md px-2 py-[3px] text-[14px] font-bold leading-none",
                      row.reactionPct >= 0
                        ? "bg-up-wash text-up"
                        : "bg-down-wash text-down",
                    )}
                  >
                    {row.reactionPct >= 0 ? "▲" : "▼"}
                    {formatPercentPlain(row.reactionPct, locale, 1)}
                  </span>
                )}
              </dd>
              {row.reactionPct !== null && (
                <p className="mt-1.5 text-[10.5px] text-muted">
                  {t.analysis.reactionNote}
                </p>
              )}
            </div>

            {live && (
              /* ---- Bugün nerede? ----
                 Sayfa açıklanmış bir çeyreği anlatıyor ve soldaki fiyat o
                 günün kapanışı — okuyucunun bir sonraki sorusu her zaman
                 "peki şimdi kaçtan işlem görüyor". İki fiyat TANIMI GEREĞİ
                 farklı, o yüzden ayrı sütunda ve ikisinin de ne olduğu
                 adıyla yazılı (bkz. CLAUDE.md → veri dürüstlüğü, "aynı sayı
                 iki yerde"). */
              <div className="min-w-0 lg:px-5">
                <dt className="flex items-baseline justify-between gap-2">
                  <span className={cn(PLATE_LABEL, "text-primary")}>
                    {t.analysis.livePrice}
                  </span>
                  {/* Seans dışında sağlayıcının verdiği fiyat canlı bir
                      kotasyon değil, ÖNCEKİ KAPANIŞ. "Canlı" yazmak onu
                      olduğundan taze gösterirdi — bayat veriyi taze
                      etiketlemek bu projede kaldırılmış bir metriğin
                      sebebiydi (bkz. CLAUDE.md → veri dürüstlüğü). */}
                  <span className="shrink-0 text-[10.5px] font-medium text-muted">
                    {status.session === "regular" && !live.stale
                      ? t.market.live
                      : t.market.prevClose}
                  </span>
                </dt>
                <dd className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  <span className="figure text-[26px] font-bold leading-none tracking-[-0.04em] text-strong">
                    {formatPrice(live.quote.price, locale, { currency: true })}
                  </span>
                  <span
                    className={cn(
                      "figure text-[14px] font-bold",
                      live.quote.changePct >= 0 ? "text-up" : "text-down",
                    )}
                  >
                    {formatPercent(live.quote.changePct, locale)}
                  </span>
                </dd>
                {sinceReportPct !== null && (
                  <p className="mt-1.5 text-[10.5px] text-muted">
                    {t.analysis.sinceReport}{" "}
                    <span
                      className={cn(
                        "figure font-bold",
                        sinceReportPct >= 0 ? "text-up" : "text-down",
                      )}
                    >
                      {formatPercent(sinceReportPct, locale, 1)}
                    </span>
                  </p>
                )}
              </div>
            )}

            {row.marketCap !== null && (
              <div className="min-w-0 lg:px-5">
                <dt className={cn(PLATE_LABEL, "text-body")}>
                  {t.market.marketCap}
                </dt>
                <dd className="figure mt-1.5 text-[20px] font-bold leading-none tracking-[-0.03em] text-strong">
                  ≈{formatCompact(row.marketCap, locale)} $
                </dd>
              </div>
            )}

            {row.return1yPct !== null && (
              <div className="min-w-0 lg:pl-5">
                <dt className={cn(PLATE_LABEL, "text-body")}>
                  {t.analysis.return1y}
                </dt>
                <dd
                  className={cn(
                    "figure mt-1.5 text-[20px] font-bold leading-none tracking-[-0.03em]",
                    row.return1yPct >= 0 ? "text-up" : "text-down",
                  )}
                >
                  {formatPercent(row.return1yPct, locale, 0)}
                </dd>
              </div>
            )}
          </dl>
        )}
      </header>

      {/* ---- Tek kolon ----
          Sağda karne + yaklaşan bilançolar + rehber taşıyan yapışkan bir
          kolon vardı ve içeriğin genişliğini 340px kısıyordu. Grafikler
          asıl anlatan parça; onlara yer açmak için kolon kaldırıldı, oradaki
          üç kart sayfanın altına indi. Metin panellerinde satır uzunluğu
          `max-w` ile sınırlı — 1300px'lik bir paragraf okunmuyor. */}
      <div className="flex min-w-0 flex-col gap-4">
          <VerdictStrip row={row} verdict={verdict} locale={locale} t={t} />

          {/* ---- Görsel katman ----
              Sayfa uzun metinle açılıyordu ve çeyreğin rakamları dokuz
              paragrafın gölgesinde kalıyordu. Sıra artık karnedekiyle aynı:
              önce ölçüler, sonra grafikler, sonra CEO, en sonda metin.
              Rakamı gören okuyucu metne inmek zorunda değil; inmek isteyen
              için metin zaten altında duruyor. */}
          <MetricCards metrics={row.highlights ?? []} locale={locale} />

          {(hasColumns || hasGuidance) && (
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
                  footer={revenueFooter}
                  locale={locale}
                />
              )}
              {hasGuidance && (
                <GuidanceRanges
                  rows={row.guidance ?? []}
                  title={
                    row.nextPeriodLabel
                      ? t.analysis.guidanceTitle.replace(
                          "{period}",
                          row.nextPeriodLabel,
                        )
                      : t.analysis.guidanceTitleFallback
                  }
                  legendRange={t.analysis.legendRange}
                  legendConsensus={t.analysis.legendConsensus}
                  verdictLabels={{
                    above: t.analysis.guidanceAbove,
                    below: t.analysis.guidanceBelow,
                    inline: t.analysis.guidanceInline,
                  }}
                  formatRange={(low, high, unit) =>
                    formatGuidanceRange(low, high, unit ?? undefined, locale)
                  }
                  footer={guidanceFooter}
                  locale={locale}
                />
              )}
            </div>
          )}

          {row.ceoQuote && (
            /* CEO şeridi: solda kim, ortada ne dediği, sağda çağrıda
               vurguladığı başlıklar. Bir ara baş harflerden bir avatar
               halkası denendi ve kaldırıldı — kimsenin tanımadığı iki harf
               bir portre yerine geçmiyor, yalnızca yer kaplıyordu.

               Dev tırnak dekoratif ve `aria-hidden`: metnin alıntı olduğunu
               blockquote zaten söylüyor. */
            <section className="relative overflow-hidden rounded-[16px] border border-line bg-surface p-4 sm:p-5">
              <span
                aria-hidden
                className="pointer-events-none absolute -top-8 right-5 select-none font-serif text-[140px] leading-none text-primary opacity-[0.06]"
              >
                &rdquo;
              </span>
              <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-6">
                <div className="flex shrink-0 flex-col gap-px lg:w-44">
                  <span className="plate text-[10px] tracking-[0.09em]">
                    {t.analysis.ceoMessage}
                  </span>
                  <span className="text-[15px] font-bold tracking-[-0.02em] text-strong">
                    {row.ceoQuote.name}
                  </span>
                  <span className="text-[11.5px] text-muted">
                    {row.ceoQuote.title}
                  </span>
                </div>

                <span
                  aria-hidden
                  className="hidden w-px self-stretch bg-line lg:block"
                />

                <blockquote className="min-w-0 flex-1 border-t border-line pt-3.5 text-[14px] italic leading-[22px] text-body [text-wrap:pretty] lg:border-t-0 lg:pt-0">
                  “{row.ceoQuote.quote}”
                </blockquote>

                {row.ceoQuote.topics && row.ceoQuote.topics.length > 0 && (
                  /* Rozetler karnedeki gibi: dar ekranda yan yana saran
                     hap, genis ekranda alt alta TAM GENISLIK seritler.
                     Yuvarlak haplar sag kolonda farkli genislikte kirpinti
                     gibi duruyordu; ayni genislikteki seritler bir liste
                     olarak okunuyor. */
                  <ul className="flex shrink-0 flex-wrap gap-1.5 lg:w-64 lg:flex-col lg:flex-nowrap lg:gap-2">
                    {row.ceoQuote.topics.map((topic) => (
                      <li
                        key={topic}
                        className="rounded-[10px] border border-primary-faint bg-primary-wash px-3 py-2 text-[11.5px] font-semibold leading-[15px] text-primary lg:text-center"
                      >
                        {topic}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          )}

          {/* ---- Metin katmanı ----
              İkisi de sayfanın tam genişliğinde bir panelken metin `max-w`
              ile ~92 karaktere kısılıyordu: sol tarafta bir metin bloğu,
              sağ tarafta 400 piksellik boşluk. Sütunlaştırma iki sorunu
              birden çözüyor — genişlik gerçekten kullanılıyor ve satır boyu
              her kırılma noktasında okunur bandın içinde kalıyor (1300px'te
              üç sütun ≈ 58 karakter, tek sütunda 100'ün üstündeydi).

              Bloklar `break-inside-avoid`: bir paragrafın ortasından
              bölünüp iki sütuna yayılması, sayfayı gazete değil bozuk bir
              düzen gibi gösteriyordu. */}
          <Panel className="p-5 sm:p-6">
            <PanelHead
              icon={Article}
              title={t.analysis.summary}
              meta={t.analysis.readMinutes.replace(
                "{count}",
                String(readMinutes(row)),
              )}
            />
            <div className={PROSE_COLUMNS}>
              {row.summary.map((paragraph, index) => (
                <p
                  key={index}
                  className="mb-3 break-inside-avoid text-[13.5px] leading-[22px] text-body [text-wrap:pretty] last:mb-0"
                >
                  <RichText text={paragraph} />
                </p>
              ))}
            </div>
          </Panel>

          {row.analysis.length > 0 && (
            <Panel className="p-5 sm:p-6">
              <PanelHead
                icon={Scales}
                title={t.analysis.detailed}
                meta={t.analysis.byTeam}
              />
              {/* ---- Bölümler: ızgara, sütun AKIŞI değil ----
                  Bir süre çok sütunlu (multicol) dizildi ve okuma sırası
                  sütun sütun aşağı iniyordu: soldaki bölüm 1'i okuyup
                  ortadaki 2 ile 3'e, sonra sağdaki 4'e geçmek gerekiyordu.
                  Göz satır satır soldan sağa okumaya çalışınca bölümler
                  birbirinin üstüne biniyor gibi duruyordu — sıra numaraları
                  bile kurtarmıyordu.

                  Izgarada sıra beklenen yönde: soldan sağa, sonra alt satır.
                  Sütun sayısı genişlikle artıyor, böylece satır boyu her
                  kırılmada okunur bantta kalıyor (1300px'te üç sütun ≈ 52
                  karakter). Her hücrenin üstündeki hairline bölümleri
                  birbirinden ayırıyor ve aynı satırdakiler hizalı başlıyor. */}
              <div className="grid gap-x-8 gap-y-6 md:grid-cols-2 xl:grid-cols-3">
                {row.analysis.map((section, index) => (
                  <section key={index} className="border-t border-line pt-3.5">
                    <h3 className="mb-2 flex items-start gap-2.5">
                      <span
                        aria-hidden
                        className="numeral mt-px flex size-[20px] shrink-0 items-center justify-center rounded-[6px] bg-primary-wash text-[10.5px] font-bold text-primary"
                      >
                        {index + 1}
                      </span>
                      <span className="text-[13.5px] font-bold leading-[19px] tracking-[-0.01em] text-strong [text-wrap:balance]">
                        {section.title}
                      </span>
                    </h3>
                    <p className="text-[13px] leading-[21px] text-body [text-wrap:pretty]">
                      <RichText text={section.body} />
                    </p>
                  </section>
                ))}
              </div>
            </Panel>
          )}

          <div className="grid gap-3 sm:grid-cols-[repeat(3,minmax(0,1fr))]">
            <PointsCard
              title={t.analysis.strengths}
              points={row.strengths ?? []}
              tone="up"
            />
            <PointsCard
              title={t.analysis.risks}
              points={row.risks ?? []}
              tone="down"
            />
            <PointsCard
              title={t.analysis.upcomingDev}
              points={row.upcoming ?? []}
              tone="primary"
            />
          </div>
      </div>

      {/* ---- Kapanış şeridi ----
          Karne, rakip takvimi ve rehber bağlantıları yapışkan yan kolondaydı;
          o kolon içeriğin genişliğini kısıyordu. Üçü de "okudun, şimdi ne
          var" sorusuna ait — metnin sonunda yan yana duruyorlar.

          Izgara SABİT üç sütun değil, BASILAN kart sayısına göre kuruluyor:
          karne çoğu kayıtta yok ve üç sütunluk bir ızgarada üçüncü göz
          bomboş kalıyordu — sayfa "bir şey yüklenemedi" gibi bitiyordu.
          Rehber kartları da aynı sebeple: tek sütuna sıkışmışken alt alta
          diziliyor, yarım genişlikte yan yana geçiyorlar. */}
      <div
        className={cn(
          "grid items-start gap-4",
          bottomCards === 3
            ? "lg:grid-cols-[repeat(3,minmax(0,1fr))]"
            : bottomCards === 2
              ? // Eşit iki yarıda referans kartı gereğinden geniş kalıyor,
                // rehber kartlarının açıklaması ise üç noktaya kırpılıyordu.
                "lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]"
              : "",
        )}
      >
        <ReportCard row={row} t={t} />

        {peers.length > 0 && (
          <Panel className="p-4 sm:p-[18px]">
            <h2 className="mb-3 flex items-center gap-2.5 text-[13.5px] font-bold text-strong">
              <span
                aria-hidden
                className="flex size-7 shrink-0 items-center justify-center rounded-[9px] bg-primary-wash text-primary"
              >
                <CalendarBlank weight="duotone" size={15} />
              </span>
              {t.analysis.upcomingEarnings}
            </h2>
            <div className="flex flex-col">
              {peers.map((peer) => (
                <Link
                  key={peer.id}
                  href={`/hisse/${peer.symbol}`}
                  prefetch={false}
                  className="flex items-center gap-2.5 border-b border-line-soft py-2 last:border-b-0 hover:opacity-75"
                >
                  {/* Logo, satırı bir sembol listesi olmaktan çıkarıp
                      sayfanın geri kalanıyla aynı dile sokuyor (mercek
                      künyeleri ve analiz tablosu da logodan besleniyor). */}
                  {peerMeta[peer.symbol]?.logoUrl ? (
                    <Image
                      src={peerMeta[peer.symbol].logoUrl!}
                      alt=""
                      width={22}
                      height={22}
                      className="size-[22px] shrink-0 rounded-[6px] bg-white object-contain"
                    />
                  ) : (
                    <span
                      aria-hidden
                      className="flex size-[22px] shrink-0 items-center justify-center rounded-[6px] bg-primary-wash text-[9px] font-bold text-primary"
                    >
                      {peer.symbol.slice(0, 2)}
                    </span>
                  )}
                  <span className="shrink-0 text-[12.5px] font-bold text-strong">
                    {peer.symbol}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs text-body">
                    {peerMeta[peer.symbol]?.name ?? ""}
                  </span>
                  <span className="numeral shrink-0 text-[11px] text-muted">
                    {formatEtDateCompact(peer.reportDate, locale)}
                  </span>
                </Link>
              ))}
            </div>
          </Panel>
        )}

        <GuideHint
          label={t.guide.contextLabel}
          locale={locale}
          slugs={["bilanco", "degerleme"]}
          layout={bottomCards === 3 ? "stack" : "row"}
        />
      </div>

      {/* ---- Alt bilgi ---- */}
      <footer className="flex flex-col gap-2 border-t border-line pt-3.5">
        <p className="text-[11px] text-muted">{t.analysis.disclaimer}</p>
        {sources.length > 0 && (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted">
            <span className="font-semibold">{t.analysis.sourcesLabel}:</span>
            {sources.map((source, index) => (
              <span key={`${source.label}-${index}`}>
                {source.url ? (
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="text-primary hover:underline"
                  >
                    {source.label}
                  </a>
                ) : (
                  source.label
                )}
                {index < sources.length - 1 && <span aria-hidden> ·</span>}
              </span>
            ))}
          </p>
        )}
      </footer>
    </div>
  );
}

/**
 * Öngörü aralığının tam metni: "10,3 – 10,8 Mr $" · "%83 – %85".
 *
 * İki ayrıntı burada karara bağlanıyor:
 *
 * ONDALIK HANE ölçeğe göre. Aynı kartta gelir (10,3 milyar), hisse başı kâr
 * (44 $) ve marj (%83) yan yana duruyor; hepsine iki hane vermek "10,30 Mr $"
 * gibi sahte bir hassasiyet üretiyor, hepsine sıfır vermek 44 ile 46
 * arasındaki farkı siliyordu.
 *
 * YÜZDE İŞARETİ dile göre yer değiştirir ve aralığın İKİ ucuna da yazılır:
 * Türkçede "%83 – %85", İngilizcede "83% – 85%". Birim ise aralığın yalnızca
 * SONUNDA durur — "10,3 Mr $ – 10,8 Mr $" aynı bilgiyi iki kez söylüyordu.
 */
function formatGuidanceRange(
  low: number,
  high: number,
  unit: string | undefined,
  locale: Locale,
): string {
  const digits = (value: number) => {
    const abs = Math.abs(value);
    if (abs >= 100) return 0;
    if (abs >= 10) return 1;
    return 2;
  };
  /* İki uç da tam sayıysa ondalık yazılmaz: "%83,0 – %85,0" şirketin
     vermediği bir hassasiyeti uyduruyor, yönetim "%83–85" dedi. */
  const scale = Math.max(Math.abs(low), Math.abs(high));
  const d =
    Number.isInteger(low) && Number.isInteger(high) ? 0 : digits(scale);
  const a = formatPrice(low, locale, { digits: d });
  const b = formatPrice(high, locale, { digits: d });

  if (unit === "%") {
    return locale === "tr" ? `%${a} – %${b}` : `${a}% – ${b}%`;
  }
  return `${a} – ${b}${unit ? ` ${unit}` : ""}`;
}

/** Gövde metninden okuma süresi — kayıtta ayrı alan tutmaya değmez. */
function readMinutes(row: EarningsAnalysisRow): number {
  const words = [
    ...row.summary,
    ...row.analysis.map((section) => `${section.title} ${section.body}`),
  ]
    .join(" ")
    .trim()
    .split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}

/**
 * Genel Görüş şeridi — skor, karar, iki cümlelik gerekçe ve analist hedefi
 * tek satırda. Sayfanın en üstünde duruyor çünkü okuyucunun ilk sorusu bu;
 * altındaki her şey bu satırın gerekçesi.
 *
 * Potansiyel yüzdesi kayıtta yoksa hedef ile kapanış fiyatından TÜRETİLİYOR.
 * Uydurma değil: iki sayı da aynı gövdede duruyor, aradaki bölme yeni bir
 * iddia üretmiyor. Ajan bu alanı ara sıra boş bırakıyor ve şeridin sağ ucu
 * hedefi yazıp "ne kadar yukarısı" sorusunu cevapsız bırakıyordu.
 */
function VerdictStrip({
  row,
  verdict,
  locale,
  t,
}: {
  row: EarningsAnalysisRow;
  verdict: VerdictKey;
  locale: Locale;
  t: Dictionary;
}) {
  const upsidePct =
    row.upsidePct ??
    (row.targetPrice !== null && row.price !== null && row.price > 0
      ? ((row.targetPrice - row.price) / row.price) * 100
      : null);

  return (
    <section className="flex flex-wrap items-center gap-4 rounded-[16px] border border-primary-faint bg-gradient-to-br from-primary-wash to-primary-tint p-4 sm:gap-[18px] sm:px-[22px]">
      <ScoreRing score={row.score} verdict={verdict} size={64} showDenominator />
      <div className="flex shrink-0 flex-col items-center gap-1">
        <span className="text-[11px] font-bold tracking-[0.04em] text-body">
          {t.analysis.verdictLabel}
        </span>
        <span
          className={cn(
            "text-[30px] font-bold leading-none tracking-[-0.03em]",
            verdictTextClass(verdict),
          )}
        >
          {verdictLabel(verdict, t)}
        </span>
      </div>
      <span
        aria-hidden
        className="hidden w-px self-stretch bg-primary-faint sm:block"
      />
      <p className="min-w-[16rem] flex-1 text-[14px] font-medium leading-[22px] text-strong [text-wrap:pretty]">
        {row.headline}
      </p>
      {row.targetPrice !== null && (
        /* Analist hedefi serbest akışta üç satırdı ve şeridin sağ ucunda
           yetim duruyordu: etiket, sayı ve potansiyel aynı hizada üst üste,
           aralarında hiçbir yüzey yok. Kendi kutusuna alınınca şeridin
           parçası olmayı bırakıp bir ÖLÇÜ oluyor — solundaki skor halkasının
           sağdaki karşılığı. */
        <div className="shrink-0 rounded-[12px] border border-primary-faint bg-surface-solid px-3.5 py-2.5 text-right">
          <span className={cn(PLATE_LABEL, "block text-muted")}>
            {row.analystCount
              ? t.analysis.analystTargetCount.replace(
                  "{count}",
                  String(row.analystCount),
                )
              : t.analysis.analystTarget}
          </span>
          <span className="figure mt-1.5 block text-[24px] font-bold leading-none tracking-[-0.035em] text-strong">
            {formatPrice(row.targetPrice, locale, { currency: true })}
          </span>
          {upsidePct !== null && (
            <span
              className={cn(
                "figure mt-1.5 inline-flex items-baseline gap-1 rounded-md px-1.5 py-[2px] text-[11.5px] font-bold",
                upsidePct >= 0 ? "bg-up-wash text-up" : "bg-down-wash text-down",
              )}
            >
              {upsidePct >= 0 ? "▲" : "▼"}
              {formatPercentPlain(upsidePct, locale, 0)}{" "}
              {t.analysis.upsidePotential}
            </span>
          )}
        </div>
      )}
    </section>
  );
}

/**
 * Karne kartı — yalnızca görsel VARSA basılır.
 *
 * Boş bir çerçeve göstermek "burada bir şey olmalıydı" hissi veriyor;
 * yokluğu sessizce geçmek dürüst. Görselin etrafında kenarlık yok: kutunun
 * kendisi görsel (`overflow-hidden` + kendi köşe yarıçapı).
 */
function ReportCard({
  row,
  t,
}: {
  row: EarningsAnalysisRow;
  t: Dictionary;
}) {
  if (!row.cardImageUrl) return null;
  return (
    <Panel className="p-4 sm:p-[18px]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-[13.5px] font-bold text-strong">
          {t.analysis.reportCard}
        </h2>
        {/* `?indir=1` rotaya Content-Disposition ekletir. `download`
            özniteliği tek başına yetmiyor: aynı kaynaktan gelse de rota bir
            dosya değil, tarayıcı adı uzantıdan tahmin ediyordu. */}
        <a
          href={`${row.cardImageUrl}?indir=1`}
          className="text-[11.5px] font-semibold text-primary hover:text-primary-hover"
        >
          ↓ {t.analysis.downloadPng}
        </a>
      </div>
      <a
        href={row.cardImageUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block overflow-hidden rounded-[10px]"
      >
        {/* A4 dikey oran — görsel yüklenirken düzen zıplamasın. Karne 2x
            çözünürlükte üretiliyor ve yan kolonda ~340px'e sığıyor;
            `sizes` bunu söyleyip gereksiz büyük dosya indirilmesini önler. */}
        <Image
          src={row.cardImageUrl}
          alt={`${row.symbol} ${row.periodLabel} ${t.analysis.reportCard}`}
          width={1654}
          height={2339}
          sizes="(min-width: 1024px) 380px, 100vw"
          className="h-auto w-full"
        />
      </a>
      <p className="mt-2.5 text-[11px] leading-4 text-muted [text-wrap:pretty]">
        {t.analysis.reportCardHint}
      </p>
    </Panel>
  );
}

/**
 * Güçlü Yönler / Riskler / Beklenen Gelişmeler.
 *
 * Üçü de aynı biçimde altı maddelik bir liste ve düz metin olarak yan yana
 * durduklarında hangisinin ne olduğu ancak başlık okununca anlaşılıyordu.
 * Artık her kart başlıkta bir ikon karosu ve madde sayısı taşıyor, madde
 * numaraları da çıplak rakam değil kendi tonundaki küçük kareler — göz
 * karta bakar bakmaz "bu iyi taraf / bu risk" diyor.
 */
function PointsCard({
  title,
  points,
  tone,
}: {
  title: string;
  points: string[];
  tone: "up" | "down" | "primary";
}) {
  if (points.length === 0) return null;

  const Icon = tone === "up" ? TrendUp : tone === "down" ? Warning : CalendarBlank;
  const accent =
    tone === "up" ? "text-up" : tone === "down" ? "text-down" : "text-primary";

  return (
    <section
      className={cn(
        "flex min-w-0 flex-col rounded-[16px] border p-4",
        tone === "up" && "border-up/25 bg-up-wash/40",
        tone === "down" && "border-down/25 bg-down-wash/40",
        tone === "primary" && "border-primary-faint bg-primary-tint",
      )}
    >
      <div className="mb-3 flex items-center gap-2.5">
        <span
          aria-hidden
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-[9px]",
            tone === "up" && "bg-up-wash",
            tone === "down" && "bg-down-wash",
            tone === "primary" && "bg-primary-wash",
            accent,
          )}
        >
          <Icon weight="duotone" size={15} />
        </span>
        <h3 className={cn("text-[13px] font-bold tracking-[-0.01em]", accent)}>
          {title}
        </h3>
        <span className="figure ml-auto text-[11px] font-bold text-muted">
          {points.length}
        </span>
      </div>

      <ol className="flex flex-col gap-2.5">
        {points.map((point, index) => (
          <li
            key={index}
            className="flex gap-2.5 text-[12px] leading-[18px] text-body [text-wrap:pretty]"
          >
            <span
              aria-hidden
              className={cn(
                "figure mt-px flex size-[18px] shrink-0 items-center justify-center rounded-[5px] text-[9.5px] font-bold",
                tone === "up" && "bg-up-wash",
                tone === "down" && "bg-down-wash",
                tone === "primary" && "bg-primary-wash",
                accent,
              )}
            >
              {index + 1}
            </span>
            <span>
              <RichText text={point} />
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

