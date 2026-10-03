import "server-only";

import { cache } from "react";
import { and, desc, eq, gte } from "drizzle-orm";
import { indexMemberOf } from "@/db/seed/indices";
import { getConsensusTarget } from "@/lib/analyst-target-data";
import { getLatestTarget, getNextEarnings, getStatus } from "@/lib/data";
import { db } from "@/lib/db";
import { getStockInvestors } from "@/lib/investor-data";
import { addEtDays, boundedTtl, daysBetweenEt, todayEt } from "@/lib/market-hours";
import { getCompanyProfile, getQuote } from "@/lib/providers";
import { getPeriodChanges } from "@/lib/providers/alpaca";
import { getRecommendations } from "@/lib/providers/finnhub";
import { getInsiderSentiment, getMetricSeries, getRawMetrics } from "@/lib/providers/finnhub-depth";
import { getSharesSeries } from "@/lib/providers/sec-edgar";
import type { DataSource } from "@/lib/providers/types";
import { earningsAnalyses } from "@/lib/schema";
import {
  cagr,
  evaluate,
  SHARES_ANNUAL_MAX_AGE_DAYS,
  SHARES_MAX_AGE_DAYS,
  sharesChangeYoY,
  type ScreenInput,
  type ScreenResult,
} from "@/lib/screening";

/**
 * HİSSE SEÇİMİ — girdilerin toplandığı yer (3 Ekim). Kural motoru saf
 * (lib/screening.ts); burada yalnızca veri var.
 *
 * KAYNAKLAR (hepsi sitenin zaten kullandığı uçlar, yeni bir sağlayıcı yok):
 *  - Fiyat: `getQuote` (melez kotasyon, başlıktaki fiyatla aynı anahtar).
 *  - Büyüme, marj, cari oran, borç, 52 hafta, ortalama hacim, nakit ve
 *    serbest nakit akışı: Finnhub temel finansallar (`/stock/metric`,
 *    günlük önbellek; şirket sayfasının metrikleriyle aynı adres).
 *  - Altı aylık göreli güç: Alpaca günlük barları, hisse + SPY + GICS
 *    sektör fonu (skor kartının momentum ölçüsüyle aynı yöntem).
 *  - Sulandırma: SEC `EntityCommonStockSharesOutstanding`.
 *  - Ünlü fonlar: 13F takibi (`getStockInvestors`); içeriden işlemler:
 *    Finnhub MSPR; analist eğilimi: Finnhub öneri dağılımı.
 *  - Hedef: rutinin kaynaklı konsensüsü, yoksa son bilanço analizindeki
 *    hedef. Bilanço kalitesi: son analizin skoru (120 günden eskiyse yok).
 *
 * Her parça ayrı ayrı düşebilir; düşen parçanın kuralı "veri yok" der ve
 * puanın dışında kalır — tek bir kaynak sayfayı açılmaz yapmıyor.
 */

/** GICS sektörü → SPDR sektör fonu (lib/market-boards.ts ile aynı fonlar). */
export const SECTOR_ETF: Record<string, string> = {
  "Information Technology": "XLK",
  Financials: "XLF",
  "Health Care": "XLV",
  "Consumer Discretionary": "XLY",
  "Consumer Staples": "XLP",
  Energy: "XLE",
  Industrials: "XLI",
  Materials: "XLB",
  Utilities: "XLU",
  "Real Estate": "XLRE",
  "Communication Services": "XLC",
};

/** Göreli gücün penceresi — altı ay, skor kartının momentumu ile aynı. */
const STRENGTH_SESSIONS = 126;
/** Bilanço analizinin "güncel" sayıldığı en fazla yaş (bir çeyrek + pay). */
const ANALYSIS_MAX_AGE_DAYS = 120;

export type ScreenData = {
  symbol: string;
  name: string;
  logoUrl: string | null;
  sector: string | null;
  sectorEtf: string | null;
  industry: string | null;
  input: ScreenInput;
  result: ScreenResult;
  quote: { source: DataSource; fetchedAt: Date; stale: boolean } | null;
  /** Son bilanço analizinin adresi için. */
  analysis: { period: string; periodLabel: string } | null;
  /** Hedefin kaynağı: konsensüs (rutin) mü, analiz mi. */
  targetSource: "consensus" | "analysis" | null;
};

const num = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

/** Serinin en yeni değeri (Finnhub serileri en yeniden eskiye). */
function latestOf(list: { period: string; v: number }[] | undefined, offset = 0): number | null {
  if (!list || list.length <= offset) return null;
  const sorted = [...list].sort((a, b) => b.period.localeCompare(a.period));
  return num(sorted[offset]?.v);
}

async function latestAnalysis(symbol: string) {
  try {
    const since = addEtDays(todayEt(), -ANALYSIS_MAX_AGE_DAYS);
    const [row] = await db
      .select({
        score: earningsAnalyses.score,
        period: earningsAnalyses.period,
        periodLabel: earningsAnalyses.periodLabel,
      })
      .from(earningsAnalyses)
      .where(and(eq(earningsAnalyses.symbol, symbol), gte(earningsAnalyses.reportDate, since)))
      .orderBy(desc(earningsAnalyses.reportDate))
      .limit(1);
    return row ?? null;
  } catch {
    return null;
  }
}

export const loadScreen = cache(async function loadScreen(rawSymbol: string, locale: string): Promise<ScreenData | null> {
  const symbol = rawSymbol.toUpperCase();
  const status = await getStatus();
  const member = indexMemberOf(symbol);
  const sector = member?.sector ?? null;
  const sectorEtf = sector ? (SECTOR_ETF[sector] ?? null) : null;
  const today = todayEt();

  const [quote, profile, raw, series, changes, shares, investors, sentiment, recos, consensus, analysisTarget, analysis, next] =
    await Promise.all([
      getQuote(symbol, status),
      getCompanyProfile(symbol),
      getRawMetrics(symbol),
      getMetricSeries(symbol),
      getPeriodChanges(
        [symbol, "SPY", ...(sectorEtf ? [sectorEtf] : [])],
        STRENGTH_SESSIONS,
        boundedTtl(60 * 60, status),
      ),
      getSharesSeries(symbol),
      getStockInvestors(symbol),
      getInsiderSentiment(symbol, addEtDays(today, -190), today),
      getRecommendations(symbol),
      getConsensusTarget(symbol),
      getLatestTarget(symbol, locale),
      latestAnalysis(symbol),
      getNextEarnings(symbol),
    ]);

  /* Fiyat ya da profil yoksa değerlendirilecek bir hisse yok. */
  if (!quote.ok && !profile.ok) return null;
  const price = quote.ok ? quote.data.price : null;
  const metric = raw.ok ? raw.data : {};
  const m = (key: string) => num(metric[key]);

  /* Hisse sayısı profilden (adet — sağlayıcının milyon cinsini
     `getProfile` çeviriyor); piyasa değeri canlı fiyatla. */
  const sharesOut = profile.ok && profile.data.shareOutstanding ? profile.data.shareOutstanding : null;
  const marketCap =
    sharesOut !== null && price !== null ? sharesOut * price : profile.ok ? profile.data.marketCap : null;
  const industry = profile.ok ? profile.data.industry : null;
  /* Banka ve sigortada cari oran raporlanmıyor, borç/özsermaye işin
     doğası gereği yüksek, serbest nakit akışı mevduat hareketiyle oynuyor:
     sağlık kuralları orada ölçü değil (motor `financial` ile atlıyor). */
  const financial = sector === "Financials" || /bank|insurance|financial services|capital markets/i.test(industry ?? "");

  const annual = series.ok ? series.data.annual : {};
  const quarterly = series.ok ? series.data.quarterly : {};
  const epsGrowth3Y = m("epsGrowth3Y") ?? cagr(latestOf(annual.eps), latestOf(annual.eps, 3));
  const fcfPerShare = latestOf(quarterly.fcfPerShareTTM) ?? latestOf(annual.fcfPerShareTTM);
  const cashPerShare = m("cashPerSharePerShareQuarterly") ?? m("cashPerSharePerShareAnnual");

  const ch = changes.ok ? changes.data : {};

  let funds: ScreenInput["funds"] = null;
  if (investors) {
    const holding = investors.holders.filter((holder) => !holder.exited);
    funds = {
      holders: holding.length,
      added: investors.holders.filter((holder) => holder.move === "new" || holder.move === "increased").length,
      trimmed: investors.holders.filter((holder) => holder.move === "decreased" || holder.move === "soldOut").length,
    };
  }

  const msprs = sentiment.ok ? sentiment.data.map((row) => num(row.mspr)).filter((v): v is number => v !== null) : [];
  const insiderMspr = msprs.length ? msprs.reduce((a, b) => a + b, 0) / msprs.length : null;

  let buyShareNow: number | null = null;
  let buyShare3mAgo: number | null = null;
  if (recos.ok) {
    const sorted = [...recos.data].sort((a, b) => b.period.localeCompare(a.period));
    const share = (row: (typeof sorted)[number] | undefined) => {
      if (!row) return null;
      const total = row.strongBuy + row.buy + row.hold + row.sell + row.strongSell;
      return total > 0 ? ((row.strongBuy + row.buy) / total) * 100 : null;
    };
    buyShareNow = share(sorted[0]);
    buyShare3mAgo = share(sorted[3]);
  }

  const target = consensus?.mean ?? analysisTarget?.targetPrice ?? null;
  const upside = target !== null && price !== null && price > 0 ? (target / price - 1) * 100 : null;

  const input: ScreenInput = {
    price,
    marketCap,
    avgVolume: m("3MonthAverageTradingVolume") !== null ? m("3MonthAverageTradingVolume")! * 1e6 : null,
    epsGrowthQ: m("epsGrowthQuarterlyYoy"),
    salesGrowthQ: m("revenueGrowthQuarterlyYoy"),
    epsGrowth3Y,
    epsTTM: m("epsTTM") ?? m("epsBasicExclExtraItemsTTM"),
    grossMargin: m("grossMarginTTM"),
    operatingMargin: m("operatingMarginTTM"),
    netMargin: m("netProfitMarginTTM"),
    currentRatio: m("currentRatioQuarterly") ?? m("currentRatioAnnual"),
    debtToEquity: m("totalDebt/totalEquityQuarterly") ?? m("totalDebt/totalEquityAnnual"),
    cash: cashPerShare !== null && sharesOut !== null ? cashPerShare * sharesOut : null,
    freeCashFlow: fcfPerShare !== null && sharesOut !== null ? fcfPerShare * sharesOut : null,
    high52: m("52WeekHigh"),
    low52: m("52WeekLow"),
    return6m: num(ch[symbol]),
    market6m: num(ch.SPY),
    sector6m: sectorEtf ? num(ch[sectorEtf]) : null,
    sharesYoY: shares
      ? sharesChangeYoY(shares.rows, new Date(), shares.kind === "annual" ? SHARES_ANNUAL_MAX_AGE_DAYS : SHARES_MAX_AGE_DAYS)
      : null,
    funds,
    insiderMspr,
    buyShareNow,
    buyShare3mAgo,
    upside,
    analysisScore: analysis?.score ?? null,
    earningsInDays: next?.reportDate ? daysBetweenEt(today, next.reportDate) : null,
    forwardPE: m("forwardPE"),
    financial,
  };

  return {
    symbol,
    name: profile.ok ? profile.data.name : (member?.name ?? symbol),
    logoUrl: profile.ok ? profile.data.logoUrl : null,
    sector,
    sectorEtf,
    industry,
    input,
    result: evaluate(input),
    quote: quote.ok ? { source: quote.source, fetchedAt: quote.fetchedAt, stale: Boolean(quote.stale) } : null,
    analysis: analysis ? { period: analysis.period, periodLabel: analysis.periodLabel } : null,
    targetSource: consensus ? "consensus" : analysisTarget ? "analysis" : null,
  };
});
