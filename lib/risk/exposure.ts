import "server-only";
import { createHash } from "node:crypto";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { and, desc, eq, inArray } from "drizzle-orm";
import { indexMemberOf } from "@/db/seed/indices";
import { verdictOf, type VerdictKey } from "@/lib/analysis";
import { getSymbolNames } from "@/lib/data";
import { db } from "@/lib/db";
import { addEtDays, etDateTimeToUtc } from "@/lib/market-hours";
import { getPortfolioPositions } from "@/lib/portfolio-data";
import { mergeLots } from "@/lib/portfolio-analysis";
import { getDailyBarsBetween } from "@/lib/providers/alpaca";
import { earningsAnalyses } from "@/lib/schema";
import { SECTOR_ETF } from "@/lib/screening-data";
import { canonicalSymbol } from "@/lib/symbols";
import { getTechnicalBoard } from "@/lib/technical-data";
import { BENCHMARK, toDaily, type MarketDesk } from "./data";
import { belowShares, measureSymbol, positionTone, priceTrail, weightedMean, type PriceTrail, type SymbolMeasures, type Tone } from "./measures";
import type { MaWindow } from "./thresholds";
import type { PositionFacts } from "./rules";

/**
 * RİSK MASASI — PORTFÖY MARUZİYETİ (25 Ekim).
 *
 * Kullanıcının KENDİ pozisyonları (`portfolio_positions`, lotlar birleşik).
 * Ağırlık son tamamlanmış seansın kapanışıyla (adet × kapanış); beta SPY'a
 * bir yıl; ATR%, 20 günlük oynaklık ve dilimi, 50/100/200 GO uzaklığı,
 * sektör (endeks tohumunun GICS sektörü, sektör fonunda fonun sektörü).
 *
 * BİLGİ, ÖNERİ DEĞİL. Sıralama ("en yüksek beta ve oynaklık taşıyan
 * pozisyonlar") bir ölçünün büyükten küçüğe dizilişidir; hiçbir satır
 * "azalt" ya da "sat" demez. Pozisyonun yanındaki AL/TUT/SAT, sitenin
 * HERKESE AÇIK yayımladığı genel teknik ve bilanço görüşüdür (kişiye
 * özel değil; künyesi "Sitenin Genel Teknik Görüşü"), masa onu üretmez.
 *
 * Son seansta kapanışı olmayan pozisyon ölçülerin dışında kalır ve adıyla
 * künyeye yazılır (veri dürüstlüğü: eksik pozisyonla "portföy betası" yok
 * sayılmaz, kapsanan ağırlık söylenir).
 */

const LOOKBACK_DAYS = 420;
const REVALIDATE = 6 * 3600;
const PERCENT = 100;
const FUND_SECTOR = new Map(Object.entries(SECTOR_ETF).map(([sector, symbol]) => [symbol, sector]));

export type PublicView = {
  verdict: VerdictKey;
  date: string;
  href: string;
};

/** Önbellekte duran pozisyon ölçüsü: ölçüler + kart minyatürü. */
type CachedMeasures = SymbolMeasures & { trail: PriceTrail };

export type PositionRow = CachedMeasures & {
  name: string;
  logoUrl: string | null;
  /** Kartın tonu: 0 sakin, 1 gergin, 2 stres (measures.ts → positionTone). */
  tone: Tone;
  sector: string | null;
  quantity: number;
  value: number;
  weight: number;
  technical: PublicView | null;
  earnings: (PublicView & { period: string }) | null;
};

export type Exposure = {
  session: string;
  positions: PositionRow[];
  /** Son seansta kapanışı olmayan (ölçülemeyen) semboller. */
  missing: string[];
  totalValue: number;
  beta: { value: number; coveredWeight: number } | null;
  atrPct: { value: number; coveredWeight: number } | null;
  vol20: { value: number; coveredWeight: number } | null;
  volPctile: { value: number; coveredWeight: number } | null;
  /** Ortalamanın altındaki ağırlık ve ortalaması hesaplanabilen ağırlık. */
  below: Record<MaWindow, { weight: number; covered: number }>;
  sectors: { sector: string | null; weight: number }[];
  facts: PositionFacts[];
};

type Holding = { symbol: string; quantity: number };

const loadMeasures = unstable_cache(
  async function loadMeasures(session: string, key: string): Promise<Record<string, CachedMeasures>> {
    const symbols = key.split(",");
    const result = await getDailyBarsBetween([...symbols, BENCHMARK], addEtDays(session, -LOOKBACK_DAYS), etDateTimeToUtc(session, "20:00"), REVALIDATE);
    if (!result.ok) throw new Error(`pozisyon barları: ${result.message}`);
    const spy = toDaily(result.data[BENCHMARK], session);
    const out: Record<string, CachedMeasures> = {};
    for (const symbol of symbols) {
      const bars = toDaily(result.data[symbol], session);
      if (bars[bars.length - 1]?.date !== session) continue;
      const m = measureSymbol(symbol, bars, spy);
      if (m) out[symbol] = { ...(symbol === BENCHMARK ? { ...m, beta: 1 } : m), trail: priceTrail(bars) };
    }
    return out;
  },
  /* v2: dönen şekle `trail` eklendi (ortak önbellek, CLAUDE.md). */
  ["risk-exposure-v2"],
  { revalidate: REVALIDATE, tags: ["risk-desk"] },
);

/** Sitenin genel teknik görüşü (son yayın) ve bilanço analizi görüşü — sembol başına. */
async function publicViews(symbols: string[]): Promise<{ technical: Map<string, PublicView>; earnings: Map<string, PublicView & { period: string }> }> {
  const technical = new Map<string, PublicView>();
  const earnings = new Map<string, PublicView & { period: string }>();
  const wanted = new Set(symbols);
  const board = await getTechnicalBoard();
  for (const { row } of board) {
    if (!wanted.has(row.symbol)) continue;
    technical.set(row.symbol, { verdict: verdictOf(row.stance), date: row.sessionDate, href: `/teknik/${row.symbol}` });
  }
  try {
    const rows = await db
      .select({ symbol: earningsAnalyses.symbol, period: earningsAnalyses.period, periodLabel: earningsAnalyses.periodLabel, verdict: earningsAnalyses.verdict, reportDate: earningsAnalyses.reportDate })
      .from(earningsAnalyses)
      .where(and(inArray(earningsAnalyses.symbol, symbols), eq(earningsAnalyses.locale, "tr")))
      .orderBy(desc(earningsAnalyses.reportDate));
    for (const row of rows) {
      if (earnings.has(row.symbol)) continue;
      earnings.set(row.symbol, { verdict: verdictOf(row.verdict), date: row.reportDate, period: row.periodLabel, href: `/bilancolar/${row.symbol}/${row.period}` });
    }
  } catch {
    /* Bilanço görüşü yoksa sütun boş kalır. */
  }
  return { technical, earnings };
}

export function holdingsKey(holdings: readonly Holding[]): string {
  return holdings.map((h) => h.symbol).sort().join(",");
}

export function fingerprint(holdings: readonly Holding[]): string {
  return createHash("sha256").update(holdings.map((h) => `${h.symbol}:${h.quantity}`).join("|")).digest("hex").slice(0, 16);
}

/** Kullanıcının maruziyeti. `{ ok: false }`: portföy tablosu okunamadı. */
export const getExposure = cache(async function getExposure(
  userId: string,
  desk: MarketDesk,
): Promise<{ ok: false } | { ok: true; exposure: Exposure | null; fingerprint: string }> {
  const read = await getPortfolioPositions(userId);
  if (!read.ok) return { ok: false };
  const holdings = mergeLots(read.positions).filter((h) => h.quantity > 0);
  if (holdings.length === 0) return { ok: true, exposure: null, fingerprint: "" };
  const symbols = holdings.map((h) => h.symbol);
  let measures: Record<string, CachedMeasures> = {};
  try {
    measures = await loadMeasures(desk.session, holdingsKey(holdings));
  } catch (error) {
    console.error(`[risk masası] ${error instanceof Error ? error.message : "pozisyonlar"}`);
  }
  const [names, views] = await Promise.all([getSymbolNames(symbols), publicViews(symbols)]);

  const measured = holdings.flatMap((h) => {
    const m = measures[h.symbol];
    return m ? [{ h, m, value: h.quantity * m.close }] : [];
  });
  const totalValue = measured.reduce((s, r) => s + r.value, 0);
  const positions: PositionRow[] = measured
    .map(({ h, m, value }) => ({
      ...m,
      name: names[h.symbol]?.name ?? h.symbol,
      logoUrl: names[h.symbol]?.logoUrl ?? null,
      tone: positionTone(m),
      sector: FUND_SECTOR.get(h.symbol) ?? indexMemberOf(canonicalSymbol(h.symbol))?.sector ?? null,
      quantity: h.quantity,
      value,
      weight: totalValue > 0 ? (value / totalValue) * PERCENT : 0,
      technical: views.technical.get(h.symbol) ?? null,
      earnings: views.earnings.get(h.symbol) ?? null,
    }))
    .sort((a, b) => b.weight - a.weight);

  const sectorWeights = new Map<string | null, number>();
  for (const p of positions) sectorWeights.set(p.sector, (sectorWeights.get(p.sector) ?? 0) + p.weight);
  const w = (pick: (p: PositionRow) => number | null) => weightedMean(positions.map((p) => ({ weight: p.weight, value: pick(p) })));

  return {
    ok: true,
    fingerprint: fingerprint(holdings),
    exposure: {
      session: desk.session,
      positions,
      missing: symbols.filter((s) => !measures[s]),
      totalValue,
      beta: w((p) => p.beta),
      atrPct: w((p) => p.atrPct),
      vol20: w((p) => p.vol20),
      volPctile: w((p) => p.vol20Pctile),
      below: belowShares(positions),
      sectors: [...sectorWeights].map(([sector, weight]) => ({ sector, weight })).sort((a, b) => b.weight - a.weight),
      facts: positions.map((p) => ({
        symbol: p.symbol,
        beta: p.beta,
        atrPct: p.atrPct,
        volPctile: p.vol20Pctile,
        below: p.below,
        crossedBelow: p.crossedBelow,
        cross: p.cross,
      })),
    },
  };
});
