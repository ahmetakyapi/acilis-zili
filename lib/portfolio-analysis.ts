import "server-only";
import { createHash } from "node:crypto";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { and, gt, inArray, isNull, lte } from "drizzle-orm";
import { indexMemberOf, isSecondaryShareClass } from "@/db/seed/indices";
import { getStatus, getSymbolNames } from "@/lib/data";
import { db } from "@/lib/db";
import { addEtDays } from "@/lib/market-hours";
import { barDate } from "@/lib/period-returns";
import { getPortfolioPositions } from "@/lib/portfolio-data";
import {
  analyzePortfolio,
  DIVIDEND_LOOKBACK_DAYS,
  EARNINGS_WINDOW_DAYS,
  EXAMPLES_PER_SECTOR,
  sectorGaps,
  WINDOW_RETURNS,
  type AnalysisInput,
  type BenchmarkSectors,
  type DailyClose,
  type PortfolioRisk,
  type SectorFund,
  type SectorGap,
} from "@/lib/portfolio-risk";
import { getChartBarsMulti } from "@/lib/providers";
import { getCashDividends } from "@/lib/providers/alpaca-corporate";
import { getSsgaHoldings } from "@/lib/providers/etf-holdings";
import { getUsdTryAt } from "@/lib/providers/fx-history";
import { earningsCalendar } from "@/lib/schema";
import { SECTOR_ETF } from "@/lib/screening-data";
import { expectedLastSession } from "@/lib/stock-insights";
import { canonicalSymbol } from "@/lib/symbols";

/**
 * PORTFÖY ANALİZİ — VERİ TOPLAMA (24 Ekim). Hesap saf modülde
 * (lib/portfolio-risk.ts); burada yalnız girdiler:
 *
 *  - Günlük barlar: pozisyonlar + SPY (gösterge) + on bir SPDR sektör fonu,
 *    "1Y" aralığı, TEK toplu istek (`getChartBarsMulti`). Sektör fonları
 *    senaryo için; aynı istekte gelmeleri fazladan tur açmıyor.
 *  - S&P 500 sektör ağırlıkları: SPY'nin günlük içerik dosyası (State
 *    Street, fon içeriği panelinin kaynağı — lib/etf-holdings-data.ts) ×
 *    endeks tohumunun GICS sektörü (db/seed/indices.ts). Tohumda
 *    olmayan kalem (nakit, yeni giren şirket) dışarıda kalır, kalan 100'e
 *    ölçeklenir; eşlenemeyen pay künyeye yazılır.
 *  - Bilanço: `earnings_calendar`, önümüzdeki 30 gün, açıklanmamışlar.
 *  - Temettü: Alpaca kurumsal işlemler, son 12 ay, olağan ödemeler.
 *  - Kur: TCMB döviz alış, pencerenin ilk ve son günü.
 *
 * Her parça ayrı düşebilir; düşen parçanın ölçüsü null olur, ekran o paneli
 * "ölçülemedi" diye kapatır, gerisi çizilir.
 */

export const BENCHMARK = "SPY";

/** Senaryo ve eksik sektör paneli için sektör fonları (GICS sektörü → fon). */
export const SECTOR_FUND_LIST: readonly SectorFund[] = Object.entries(SECTOR_ETF).map(([sector, symbol]) => ({ symbol, sector }));
const FUND_SECTOR = new Map(SECTOR_FUND_LIST.map((fund) => [fund.symbol, fund.sector]));

const PERCENT = 100;
/** Eşlenemeyen pay bundan büyükse ağırlıklar güvenilmez sayılır. */
const MAX_UNMAPPED_SHARE = 10;

export type BenchmarkTable = BenchmarkSectors & { unmapped: number };

/**
 * SPY'nin içeriğinden S&P 500 sektör ağırlıkları. İstekler arası önbellek,
 * yalnız başarı (CLAUDE.md "hata önbelleğin DIŞINDA"): içerideki fonksiyon
 * düşünce fırlatır, dışarıdaki `try` null'a çevirir.
 */
const loadBenchmarkTable = unstable_cache(
  async function loadBenchmarkTable(): Promise<BenchmarkTable> {
    const file = await getSsgaHoldings(BENCHMARK);
    if (!file.ok) throw new Error(`SPY: ${file.message}`);
    const raw = new Map<string, number>();
    const members = new Map<string, { symbol: string; name: string; weight: number }[]>();
    let total = 0;
    let mapped = 0;
    for (const row of file.data.rows) {
      total += row.weight;
      const symbol = row.ticker ? canonicalSymbol(row.ticker) : null;
      const member = symbol ? indexMemberOf(symbol) : null;
      if (!symbol || !member?.sector) continue;
      mapped += row.weight;
      raw.set(member.sector, (raw.get(member.sector) ?? 0) + row.weight);
      if (isSecondaryShareClass(symbol)) continue;
      const list = members.get(member.sector) ?? [];
      list.push({ symbol, name: member.name, weight: row.weight });
      members.set(member.sector, list);
    }
    if (!(mapped > 0)) throw new Error("SPY: eşlenen kalem yok");
    const weights: Record<string, number> = {};
    for (const [sector, weight] of raw) weights[sector] = (weight / mapped) * PERCENT;
    const leaders: BenchmarkSectors["leaders"] = {};
    for (const [sector, list] of members)
      leaders[sector] = list
        .sort((a, b) => b.weight - a.weight)
        .slice(0, EXAMPLES_PER_SECTOR)
        .map(({ symbol, name }) => ({ symbol, name }));
    return { asOf: file.data.asOf, weights, leaders, unmapped: total > 0 ? ((total - mapped) / total) * PERCENT : 0 };
  },
  ["spx-sector-weights-v1"],
  { revalidate: 12 * 3600 },
);

async function benchmarkTable(): Promise<BenchmarkTable | null> {
  try {
    const table = await loadBenchmarkTable();
    return table.unmapped <= MAX_UNMAPPED_SHARE ? table : null;
  } catch (error) {
    console.error(`[portföy analizi] S&P 500 sektörleri: ${error instanceof Error ? error.message : "?"}`);
    return null;
  }
}

export type AnalysisHolding = { symbol: string; quantity: number };

export type PortfolioAnalysis = {
  input: AnalysisInput;
  risk: PortfolioRisk | null;
  gaps: SectorGap[];
  benchmark: BenchmarkTable | null;
  names: Record<string, { name: string; logoUrl: string | null }>;
  /** Pozisyonların parmak izi — Claude okumasının önbellek anahtarı. */
  fingerprint: string;
};

/** Aynı hissenin lotları birleşir: adet toplanır. */
export function mergeLots(positions: readonly AnalysisHolding[]): AnalysisHolding[] {
  const merged = new Map<string, number>();
  for (const p of positions) merged.set(p.symbol, (merged.get(p.symbol) ?? 0) + p.quantity);
  return [...merged].map(([symbol, quantity]) => ({ symbol, quantity })).sort((a, b) => a.symbol.localeCompare(b.symbol));
}

export const fingerprintOf = (holdings: readonly AnalysisHolding[]) =>
  createHash("sha256")
    .update(holdings.map((h) => `${h.symbol}:${h.quantity}`).join("|"))
    .digest("hex")
    .slice(0, 16);

async function upcomingReports(symbols: string[], session: string) {
  try {
    const rows = await db
      .select({ symbol: earningsCalendar.symbol, date: earningsCalendar.reportDate })
      .from(earningsCalendar)
      .where(
        and(
          inArray(earningsCalendar.symbol, symbols),
          gt(earningsCalendar.reportDate, session),
          lte(earningsCalendar.reportDate, addEtDays(session, EARNINGS_WINDOW_DAYS)),
          isNull(earningsCalendar.epsActual),
        ),
      );
    return rows;
  } catch {
    return [];
  }
}

/**
 * İstek içi önbellek: sayfa ve Claude ucu aynı turda iki kez sorarsa tek
 * hesap. Anahtar sıralanmış dize (CLAUDE.md: `cache()` argümanı kimlikle eşler).
 */
const analysisForKey = cache(async function analysisForKey(key: string): Promise<PortfolioAnalysis | null> {
  const holdings = key.split("|").map((part) => {
    const [symbol, quantity] = part.split(":");
    return { symbol: symbol!, quantity: Number(quantity) };
  });
  const symbols = holdings.map((h) => h.symbol);
  const [status, session, benchmark, names] = await Promise.all([
    getStatus(),
    expectedLastSession(),
    benchmarkTable(),
    getSymbolNames(symbols),
  ]);
  const funds = SECTOR_FUND_LIST.map((fund) => fund.symbol);
  const [bars, earnings, dividendResult] = await Promise.all([
    getChartBarsMulti([...new Set([...symbols, BENCHMARK, ...funds])], "1Y", status).catch(() => ({}) as Record<string, never>),
    upcomingReports(symbols, session),
    getCashDividends(symbols, addEtDays(session, -DIVIDEND_LOOKBACK_DAYS), session).catch(() => null),
  ]);
  const closes: Record<string, DailyClose[]> = {};
  for (const [symbol, list] of Object.entries(bars)) closes[symbol] = list.map((bar) => ({ date: barDate(bar), close: bar.close }));

  /* Kur pencerenin İLK ve SON gününde: ölçü göstergenin ızgarası
     (lib/portfolio-risk.ts → alignReturns) ile aynı günler. */
  const grid = (closes[BENCHMARK] ?? []).filter((bar) => bar.date <= session).slice(-(WINDOW_RETURNS + 1));
  const [fxStart, fxEnd] = grid.length
    ? await Promise.all([getUsdTryAt(grid[0]!.date), getUsdTryAt(session)])
    : [null, null];

  const canonicalOf = new Map(symbols.map((symbol) => [canonicalSymbol(symbol), symbol]));
  const input: AnalysisInput = {
    session,
    holdings: holdings.map((h) => ({
      ...h,
      sector: FUND_SECTOR.get(h.symbol) ?? indexMemberOf(canonicalSymbol(h.symbol))?.sector ?? null,
    })),
    closes,
    benchmark: BENCHMARK,
    benchmarkSectors: benchmark,
    earnings: earnings.map((row) => ({ symbol: row.symbol, date: row.date })),
    dividends:
      dividendResult?.ok
        ? dividendResult.data
            .filter((item) => !item.special && canonicalOf.has(item.symbol))
            .map((item) => ({ symbol: canonicalOf.get(item.symbol)!, exDate: item.exDate, rate: item.rate }))
        : [],
    fx: {
      start: fxStart?.ok ? fxStart.data.buying : null,
      end: fxEnd?.ok ? fxEnd.data.buying : null,
    },
  };
  const risk = analyzePortfolio(input);
  /* Temettü kaynağı düştüyse "sıfır temettü" yazılmaz: blok kalkar. */
  if (risk && !dividendResult?.ok) risk.dividends = null;
  return {
    input,
    risk,
    gaps: risk ? sectorGaps(risk, benchmark, SECTOR_FUND_LIST) : [],
    benchmark,
    names: Object.fromEntries(symbols.map((symbol) => [symbol, { name: names[symbol]?.name ?? symbol, logoUrl: names[symbol]?.logoUrl ?? null }])),
    fingerprint: fingerprintOf(holdings),
  };
});

export function getPortfolioAnalysis(positions: readonly AnalysisHolding[]): Promise<PortfolioAnalysis | null> {
  const holdings = mergeLots(positions).filter((h) => h.quantity > 0);
  if (holdings.length === 0) return Promise.resolve(null);
  return analysisForKey(holdings.map((h) => `${h.symbol}:${h.quantity}`).join("|"));
}

/** Okurun pozisyonları: `{ ok: false }` tablo/veritabanı düştüğünde. */
export async function getUserAnalysis(userId: string): Promise<{ ok: false } | { ok: true; analysis: PortfolioAnalysis | null; count: number }> {
  const result = await getPortfolioPositions(userId);
  if (!result.ok) return { ok: false };
  return { ok: true, analysis: await getPortfolioAnalysis(result.positions), count: result.positions.length };
}
