import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  CalendarBlank,
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
import { RichText } from "@/components/earnings/RichText";
import { toggleSymbolFavorite } from "@/app/actions/watchlist";
import { auth } from "@/auth";
import {
  getAnalysis,
  getEarningsBetween,
  getSymbolNames,
  getUserSymbols,
} from "@/lib/data";
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

  const [meta, userSymbols, upcomingRows] = await Promise.all([
    getSymbolNames([symbol]),
    session?.user?.id ? getUserSymbols(session.user.id) : Promise.resolve([]),
    getEarningsBetween(today, addEtDays(today, 30)),
  ]);

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
  const hasGuidance = (row.guidance?.length ?? 0) > 0;

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

      {/* ---- Şirket başlığı ---- */}
      {/* ---- Şirket başlığı ----
          Kimlik solda, ölçü sağda, ikisi TEK bir yüzeyin içinde ve arada
          dikey bir hairline. Önceki hâlinde ikisi serbest akışta iki uca
          yaslanıyordu ve aralarında kocaman bir ölü alan kalıyordu; ayraç
          o boşluğu bir karar hâline getiriyor. Takip düğmesi de artık
          şirket adının arasına sıkışmıyor, sol sütunun tabanında duruyor. */}
      <header className="rounded-[16px] border border-line bg-surface p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch lg:gap-6">
          <div className="flex min-w-0 flex-1 flex-col gap-3.5">
            <div className="flex min-w-0 items-start gap-3.5 sm:gap-4">
              {symbolMeta?.logoUrl ? (
                <Image
                  src={symbolMeta.logoUrl}
                  alt=""
                  width={56}
                  height={56}
                  className="size-14 shrink-0 rounded-[12px] bg-white object-contain"
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

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded-md bg-strong px-2.5 py-1 text-[10.5px] font-bold text-page">
                {t.analysis.earningsOf.replace("{period}", row.periodLabel)} ·{" "}
                {formatEtDateLong(row.reportDate, locale)}
              </span>
              {row.nextPeriodLabel && (
                <span className="rounded-md border border-primary-faint bg-primary-wash px-2.5 py-1 text-[10.5px] font-bold text-primary">
                  {t.analysis.nextEarnings}: {row.nextPeriodLabel}
                  {row.nextReportEstimate ? ` · ${row.nextReportEstimate}` : ""}
                </span>
              )}
              {langNote && (
                <span className="rounded-md bg-surface-elevated px-2.5 py-1 text-[10.5px] font-semibold text-muted">
                  {langNote}
                </span>
              )}
            </div>

            {session?.user && (
              /* mt-auto: sol sütun sağdaki ölçü sütunundan kısa kaldığında
                 düğme havada asılı kalmıyor, bloğun tabanına oturuyor. */
              <form action={toggleSymbolFavorite} className="mt-auto">
                <input type="hidden" name="symbol" value={symbol} />
                <button
                  type="submit"
                  className={cn(
                    "inline-flex min-h-9 items-center gap-[7px] rounded-[9px] border px-3.5 text-[12.5px] font-semibold transition-colors",
                    watched
                      ? "border-primary-faint bg-primary-wash text-primary"
                      : "border-line bg-surface-solid text-body hover:border-line-strong hover:text-strong",
                  )}
                >
                  <Star weight={watched ? "fill" : "duotone"} size={14} />
                  {watched ? t.stock.removeFromWatchlist : t.stock.addToWatchlist}
                </button>
              </form>
            )}
          </div>

          {row.price !== null && (
            <>
              <span
                aria-hidden
                className="hidden w-px self-stretch bg-line lg:block"
              />
              {/* Ölçü sütunu artık kendi kenarlığını taşımıyor: kapsayıcı
                  zaten bir yüzey, kutu içinde kutu iki kat çerçeve demekti.
                  Dar ekranda dikey ayraç yatay bir hairline'a dönüşür. */}
              <section className="shrink-0 border-t border-line pt-3.5 lg:w-[244px] lg:border-t-0 lg:pt-0">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="plate text-[10px] tracking-[0.09em]">
                    {t.analysis.closePrice}
                  </span>
                  <span className="text-[10.5px] font-medium text-muted">
                    {formatEtDateCompact(row.reportDate, locale)}
                  </span>
                </div>

                <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  <span className="figure text-[28px] font-bold leading-none tracking-[-0.04em] text-strong">
                    {formatPrice(row.price, locale, { currency: true })}
                  </span>
                  {row.reactionPct !== null && (
                    <span className="flex flex-col gap-px">
                      <span
                        className={cn(
                          "figure w-fit rounded-md px-[7px] py-[2px] text-[11px] font-bold",
                          row.reactionPct >= 0
                            ? "bg-up-wash text-up"
                            : "bg-down-wash text-down",
                        )}
                      >
                        {row.reactionPct >= 0 ? "▲" : "▼"}{" "}
                        {formatPercentPlain(row.reactionPct, locale, 1)}
                      </span>
                      {/* Ölçünün altındaki mikro künye — cümle değil, Title
                          Case almaz (bkz. CLAUDE.md yazım kuralı). */}
                      <span className="text-[10px] text-muted">
                        {t.analysis.afterHours}
                      </span>
                    </span>
                  )}
                </div>

                {(row.marketCap !== null || row.return1yPct !== null) && (
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 border-t border-line pt-2.5">
                    {row.marketCap !== null && (
                      <div className="min-w-0">
                        <dt className="truncate text-[10px] font-medium text-muted">
                          {t.market.marketCap}
                        </dt>
                        <dd className="figure text-[13px] font-bold text-strong">
                          ≈{formatCompact(row.marketCap, locale)} $
                        </dd>
                      </div>
                    )}
                    {row.return1yPct !== null && (
                      <div className="min-w-0">
                        <dt className="truncate text-[10px] font-medium text-muted">
                          {t.analysis.return1y}
                        </dt>
                        <dd
                          className={cn(
                            "figure text-[13px] font-bold",
                            row.return1yPct >= 0 ? "text-up" : "text-down",
                          )}
                        >
                          {formatPercent(row.return1yPct, locale, 0)}
                        </dd>
                      </div>
                    )}
                  </dl>
                )}
              </section>
            </>
          )}
        </div>
      </header>

      {/* ---- İki kolon ---- */}
      {/* Yan kolon YAPIŞKAN (`lg:sticky`): sol kolon dört ekran sürerken
          referanslar görüş alanında kalır. Bu yüzden kısa olması sorun
          değil — okuyucu kaydırdıkça onunla birlikte iniyor. */}
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]">
        {/* Karne mobilde metinden ÖNCE gelir: paylaşılabilir tek sayfalık
            özet, dokuz paragraflık değerlendirmeden önce okunur. */}
        <div className="contents lg:hidden">
          <ReportCard row={row} t={t} />
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <VerdictStrip row={row} verdict={verdict} locale={locale} t={t} />

          {/* ---- Görsel katman ----
              Sayfa uzun metinle açılıyordu ve çeyreğin rakamları dokuz
              paragrafın gölgesinde kalıyordu. Sıra artık karnedekiyle aynı:
              önce ölçüler, sonra grafikler, sonra CEO, en sonda metin.
              Rakamı gören okuyucu metne inmek zorunda değil; inmek isteyen
              için metin zaten altında duruyor. */}
          <MetricCards metrics={row.highlights ?? []} />

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
                  title={t.analysis.quarterlyRevenue}
                  legendActual={t.analysis.legendActual}
                  legendProjected={t.analysis.legendProjected}
                  format={(value) => `${formatCompact(value, locale)} $`}
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
                  formatRange={(low, high, unit) =>
                    formatGuidanceRange(low, high, unit ?? undefined, locale)
                  }
                />
              )}
            </div>
          )}

          {row.ceoQuote && (
            /* CEO şeridi yan kolondan ana kolona alındı: alıntı bir referans
               değil, çeyreğin hikâyesinin parçası — grafiklerle metin
               arasında duruyor.

               Tırnak işareti dev ve dekoratif: şeridin sayfadaki başka hiçbir
               şeye benzemeyen tek görsel imzası o. `aria-hidden` çünkü metnin
               alıntı olduğunu blockquote zaten söylüyor. */
            <section className="relative overflow-hidden rounded-[16px] border border-line bg-surface p-4 sm:p-5">
              <span
                aria-hidden
                className="pointer-events-none absolute -top-6 right-4 select-none font-serif text-[120px] leading-none text-primary opacity-[0.07]"
              >
                &rdquo;
              </span>
              <div className="relative flex flex-col gap-4 sm:flex-row sm:gap-5">
                <div className="flex shrink-0 items-center gap-3 sm:w-44 sm:flex-col sm:items-start sm:justify-center sm:gap-1">
                  {/* Fotoğraf yok (proje kuralı); baş harfler aynı işi telifsiz
                      görüyor ve her şirkette tutarlı. */}
                  <span
                    aria-hidden
                    className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-wash text-[13px] font-bold text-primary sm:mb-1"
                  >
                    {initialsOf(row.ceoQuote.name)}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="plate text-[10px] tracking-[0.09em]">
                      {t.analysis.ceoMessage}
                    </span>
                    <span className="text-[13.5px] font-bold text-strong">
                      {row.ceoQuote.name}
                    </span>
                    <span className="text-[11px] text-muted">
                      {row.ceoQuote.title}
                    </span>
                  </span>
                </div>

                <span
                  aria-hidden
                  className="hidden w-px self-stretch bg-line sm:block"
                />

                <blockquote className="min-w-0 flex-1 border-t border-line pt-3 text-[13px] italic leading-[20px] text-body [text-wrap:pretty] sm:border-t-0 sm:pt-0">
                  “{row.ceoQuote.quote}”
                </blockquote>

                {row.ceoQuote.topics && row.ceoQuote.topics.length > 0 && (
                  <ul className="flex shrink-0 flex-wrap gap-1.5 sm:w-56 sm:flex-col sm:content-start">
                    {row.ceoQuote.topics.map((topic) => (
                      <li
                        key={topic}
                        className="rounded-full border border-primary-faint bg-primary-wash px-2.5 py-1 text-[11px] font-semibold text-primary"
                      >
                        {topic}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          )}

          <Panel className="p-5 sm:p-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-[15px] font-bold text-strong">
                {t.analysis.summary}
              </h2>
              <span className="text-[11px] font-semibold text-muted">
                {t.analysis.readMinutes.replace(
                  "{count}",
                  String(readMinutes(row)),
                )}
              </span>
            </div>
            <div className="flex flex-col gap-3 text-[13.5px] leading-[22px] text-body [text-wrap:pretty]">
              {row.summary.map((paragraph, index) => (
                <p key={index}>
                  <RichText text={paragraph} />
                </p>
              ))}
            </div>
          </Panel>

          {row.analysis.length > 0 && (
            <Panel className="p-5 sm:p-6">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-[15px] font-bold text-strong">
                  {t.analysis.detailed}
                </h2>
                <span className="text-[11px] font-semibold text-muted">
                  {t.analysis.byTeam}
                </span>
              </div>
              <div className="flex flex-col gap-3 text-[13.5px] leading-[22px] text-body [text-wrap:pretty]">
                {row.analysis.map((section, index) => (
                  <p key={index}>
                    <b className="font-bold text-strong">{section.title}</b>{" "}
                    <RichText text={section.body} />
                  </p>
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

        <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-5">
          <div className="hidden lg:block">
            <ReportCard row={row} t={t} />
          </div>

          {peers.length > 0 && (
            <Panel className="p-4 sm:p-[18px]">
              <h2 className="mb-3 text-[13.5px] font-bold text-strong">
                {t.analysis.upcomingEarnings}
              </h2>
              <div className="flex flex-col">
                {peers.map((peer) => (
                  <Link
                    key={peer.id}
                    href={`/hisse/${peer.symbol}`}
                    prefetch={false}
                    className="flex items-center gap-2.5 border-b border-line-soft py-[7px] last:border-b-0 hover:opacity-75"
                  >
                    <span className="w-[52px] shrink-0 text-[12.5px] font-bold text-strong">
                      {peer.symbol}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs text-body">
                      {peerMeta[peer.symbol]?.name ?? ""}
                    </span>
                    <span className="shrink-0 text-[11px] text-muted">
                      {formatEtDateCompact(peer.reportDate, locale)}
                    </span>
                  </Link>
                ))}
              </div>
            </Panel>
          )}

          {/* Rehber bağlantıları sayfanın en altından yan kolona alındı:
              orada dokuz paragraf metnin ardından geliyordu ve kimse o
              noktada "bilanço nedir" sorusunu sormuyordu. Yanda, metrikleri
              okurken duruyor. */}
          <GuideHint
            label={t.guide.contextLabel}
            locale={locale}
            slugs={["bilanco", "degerleme"]}
            layout="stack"
          />
        </aside>
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
      <p className="min-w-[16rem] flex-1 text-[13.5px] font-medium leading-[21px] text-strong [text-wrap:pretty]">
        {row.headline}
      </p>
      {row.targetPrice !== null && (
        <div className="flex shrink-0 flex-col items-end gap-[2px]">
          <span className="text-[10.5px] font-semibold text-muted">
            {row.analystCount
              ? t.analysis.analystTargetCount.replace(
                  "{count}",
                  String(row.analystCount),
                )
              : t.analysis.analystTarget}
          </span>
          <span className="figure text-[22px] font-bold leading-none tracking-[-0.03em] text-strong">
            {formatPrice(row.targetPrice, locale, { currency: true })}
          </span>
          {row.upsidePct !== null && (
            <span
              className={cn(
                "figure text-[11.5px] font-bold",
                row.upsidePct >= 0 ? "text-up" : "text-down",
              )}
            >
              {row.upsidePct >= 0 ? "▲" : "▼"}{" "}
              {formatPercentPlain(row.upsidePct, locale, 0)}{" "}
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
        <h3 className={cn("text-[12.5px] font-bold tracking-[-0.01em]", accent)}>
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
            className="flex gap-2.5 text-[11.5px] leading-[17px] text-body [text-wrap:pretty]"
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

/** "David Goeckeler" → "DG". Tek kelimelik adlarda ilk iki harf. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toLocaleUpperCase("tr-TR");
  return (parts[0][0] + parts[parts.length - 1][0]).toLocaleUpperCase("tr-TR");
}
