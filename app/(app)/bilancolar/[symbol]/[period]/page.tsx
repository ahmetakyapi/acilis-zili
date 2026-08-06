import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Star } from "@phosphor-icons/react/dist/ssr";
import { GuideHint } from "@/components/article/GuideHint";
import { Panel, SymbolBadge } from "@/components/ui/primitives";
import { ScoreRing } from "@/components/earnings/ScoreRing";
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
  formatEtDateShort,
  formatPercent,
  formatPercentPlain,
  formatPrice,
} from "@/lib/utils";
import type { EarningsAnalysisRow } from "@/lib/schema";

/**
 * Bilanço detayı — bir çeyreğin okunmuş hâli.
 *
 * İki kolon: solda yargı ve gerekçesi (görüş şeridi → özet → detaylı
 * değerlendirme → güçlü yönler/riskler/beklenen gelişmeler), sağda sabit
 * kalan referans kolonu (karne, metrikler, CEO, yaklaşan bilançolar).
 * Mobilde tek kolona düşer ve karne en üste çıkar — paylaşılabilir tek
 * sayfalık özet, uzun metinden önce gelir.
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
      <header className="flex flex-wrap items-start gap-4">
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
        <div className="flex min-w-0 flex-col gap-[7px]">
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
            {row.sector && (
              <span className="text-xs font-medium text-muted">{row.sector}</span>
            )}
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
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-4">
          {row.price !== null && (
            <div className="flex flex-col items-end gap-[3px]">
              <span className="text-[10.5px] font-semibold text-muted">
                {t.analysis.closePrice} ·{" "}
                {formatEtDateShort(row.reportDate, locale)}
              </span>
              <div className="flex items-center gap-2">
                <span className="figure text-[26px] font-bold leading-none tracking-[-0.04em] text-strong">
                  {formatPrice(row.price, locale, { currency: true })}
                </span>
                {row.reactionPct !== null && (
                  <span
                    className={cn(
                      "figure rounded-md px-2 py-[3px] text-[11px] font-bold",
                      row.reactionPct >= 0
                        ? "bg-up-wash text-up"
                        : "bg-down-wash text-down",
                    )}
                  >
                    {row.reactionPct >= 0 ? "▲" : "▼"}{" "}
                    {formatPercentPlain(row.reactionPct, locale, 1)}{" "}
                    {t.analysis.afterHours}
                  </span>
                )}
              </div>
              {(row.marketCap !== null || row.return1yPct !== null) && (
                <span className="figure text-[10.5px] font-medium text-muted">
                  {row.marketCap !== null &&
                    `${t.market.marketCap} ≈${formatCompact(row.marketCap, locale)} $`}
                  {row.marketCap !== null && row.return1yPct !== null && " · "}
                  {row.return1yPct !== null &&
                    `${t.analysis.return1y} ${formatPercent(row.return1yPct, locale, 0)}`}
                </span>
              )}
            </div>
          )}
          {session?.user && (
            <form action={toggleSymbolFavorite}>
              <input type="hidden" name="symbol" value={symbol} />
              <button
                type="submit"
                className={cn(
                  "inline-flex min-h-10 items-center gap-[7px] rounded-[9px] border px-4 text-[13px] font-semibold transition-colors",
                  watched
                    ? "border-primary-faint bg-primary-wash text-primary"
                    : "border-line bg-surface text-body hover:border-line-strong hover:text-strong",
                )}
              >
                <Star weight={watched ? "fill" : "duotone"} size={15} />
                {watched ? t.stock.removeFromWatchlist : t.stock.addToWatchlist}
              </button>
            </form>
          )}
        </div>
      </header>

      {/* ---- İki kolon ---- */}
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_400px]">
        {/* Karne mobilde metinden ÖNCE gelir: paylaşılabilir tek sayfalık
            özet, dokuz paragraflık değerlendirmeden önce okunur. */}
        <div className="contents lg:hidden">
          <ReportCard row={row} t={t} />
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <VerdictStrip row={row} verdict={verdict} locale={locale} t={t} />

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
                <p key={index}>{paragraph}</p>
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
                    {section.body}
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

          {row.highlights && row.highlights.length > 0 && (
            <Panel className="p-4 sm:p-[18px]">
              <h2 className="mb-3 text-[13.5px] font-bold text-strong">
                {t.analysis.highlights}
              </h2>
              <dl className="flex flex-col">
                {row.highlights.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-baseline justify-between gap-3 border-b border-line-soft py-2 last:border-b-0"
                  >
                    <dt className="text-[12.5px] font-medium text-body">
                      {item.label}
                    </dt>
                    <dd className="figure shrink-0 text-[13.5px] font-bold text-strong">
                      {item.value}
                      {item.note && (
                        <span
                          className={cn(
                            "ml-1.5 text-[11px] font-bold",
                            item.tone === "up"
                              ? "text-up"
                              : item.tone === "down"
                                ? "text-down"
                                : "text-muted",
                          )}
                        >
                          {item.note}
                        </span>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </Panel>
          )}

          {row.ceoQuote && (
            <Panel className="p-4 sm:p-[18px]">
              <h2 className="mb-2.5 text-[13.5px] font-bold text-strong">
                {t.analysis.ceoMessage}
              </h2>
              <blockquote className="text-[12.5px] italic leading-[19px] text-body [text-wrap:pretty]">
                “{row.ceoQuote.quote}”
              </blockquote>
              <p className="mt-2 text-[11.5px] font-semibold text-muted">
                {row.ceoQuote.name} · {row.ceoQuote.title}
              </p>
            </Panel>
          )}

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

      <GuideHint
        label={t.guide.contextLabel}
        locale={locale}
        slugs={["bilanco", "degerleme"]}
      />
    </div>
  );
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
        <a
          href={row.cardImageUrl}
          download
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
        {/* A4 dikey oran — görsel yüklenirken düzen zıplamasın. */}
        <Image
          src={row.cardImageUrl}
          alt={`${row.symbol} ${row.periodLabel} ${t.analysis.reportCard}`}
          width={794}
          height={1123}
          className="h-auto w-full"
        />
      </a>
      <p className="mt-2.5 text-[11px] leading-4 text-muted [text-wrap:pretty]">
        {t.analysis.reportCardHint}
      </p>
    </Panel>
  );
}

/** Güçlü Yönler / Riskler / Beklenen Gelişmeler — 01/02/03 numaralı maddeler. */
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
  return (
    <section
      className={cn(
        "rounded-[16px] border p-4",
        tone === "up" && "border-up/25 bg-up-wash/50",
        tone === "down" && "border-down/25 bg-down-wash/50",
        tone === "primary" && "border-primary-faint bg-primary-tint",
      )}
    >
      <h3
        className={cn(
          "mb-2 text-[11px] font-bold tracking-[0.04em]",
          tone === "up" && "text-up",
          tone === "down" && "text-down",
          tone === "primary" && "text-primary",
        )}
      >
        {title}
      </h3>
      <ol className="flex flex-col gap-1.5">
        {points.map((point, index) => (
          <li
            key={index}
            className="flex gap-2 text-[11.5px] leading-[17px] text-body [text-wrap:pretty]"
          >
            <span
              className={cn(
                "figure shrink-0 font-bold",
                tone === "up" && "text-up",
                tone === "down" && "text-down",
                tone === "primary" && "text-primary",
              )}
            >
              {String(index + 1).padStart(2, "0")}
            </span>
            <span>{point}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
