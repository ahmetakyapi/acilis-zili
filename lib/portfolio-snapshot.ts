import { cache } from "react";
import { getStatus, getSymbolNames } from "@/lib/data";
import { getPortfolioPositions } from "@/lib/portfolio-data";
import { dayMove, dayTotals, portfolioTotals, positionView, type DayMove, type PortfolioTotals, type PositionView } from "@/lib/portfolio";
import { displayBasis, quoteBasis, type DisplayBasis } from "@/lib/market-hours";
import { getQuotes } from "@/lib/providers";
import { getUsdTryAt } from "@/lib/providers/fx-history";
import { getUsdTry } from "@/lib/providers/tcmb";
import type { DataSource } from "@/lib/providers/types";

/**
 * Portföyün bütün hesabı TEK YERDE ve istek içinde bir kez.
 *
 * AYNI ZİNCİR, İKİ EKRAN. `/portfoy` ve ana sayfanın portföy özeti aynı
 * sayıları göstermek zorunda (CLAUDE.md, veri dürüstlüğü 3: aynı sayı iki
 * yerde duruyorsa aynı kaynaktan gelmeli). Kotasyon `getQuotes`ten sıralı
 * sembol anahtarıyla geliyor, lira maliyeti alış gününün TCMB alış kuruyla,
 * bugünkü değer bugünün kuruyla. 28 Eylül'de iki paket paralel yazılırken
 * bu hesap bir süre iki yerde durdu (sayfanın içinde ve burada); birleştirmede
 * tek fonksiyona indi.
 *
 * `cache`: portföy sayfasının kahraman halkası, gövdesi ve aktarım düğmesi
 * ayrı Suspense sınırlarında ama aynı çağrıyı paylaşıyor.
 */
export const loadPortfolio = cache(async (userId: string) => {
  const result = await getPortfolioPositions(userId);
  if (!result.ok) return { ok: false as const };

  const positions = result.positions;
  const symbols = [...new Set(positions.map((p) => p.symbol))];
  const buyDates = [...new Set(positions.map((p) => p.boughtAt))];
  const status = await getStatus();
  const [quotesResult, names, todayFx, buyFx] = await Promise.all([
    symbols.length > 0 ? getQuotes(symbols, status) : Promise.resolve(null),
    getSymbolNames(symbols),
    positions.length > 0 ? getUsdTry() : Promise.resolve(null),
    Promise.all(buyDates.map((date) => getUsdTryAt(date))),
  ]);

  const buyRate = new Map<string, { rate: number; bulletin: string }>();
  buyDates.forEach((date, i) => {
    const entry = buyFx[i];
    if (entry.ok) buyRate.set(date, { rate: entry.data.buying, bulletin: entry.data.bulletinDate });
  });
  const todayRate = todayFx?.ok ? todayFx.data.buying : null;
  const quotes = quotesResult?.ok ? quotesResult.data : {};

  const views = positions.map((p) =>
    positionView(p, quotes[p.symbol]?.price ?? null, buyRate.get(p.boughtAt)?.rate ?? null, todayRate),
  );
  const totals = portfolioTotals(views, todayRate);

  /* Günlük değişim — gerekçe lib/portfolio.ts → "Günlük değişim". Seansın
     ekrandaki adı paketin ortak künyesi: bayat paketse hiçbir pozisyon
     kanıtlanmıyor. */
  const stale = Boolean(quotesResult?.ok && quotesResult.stale);
  const bases = new Map<string, DisplayBasis>();
  const days = new Map<string, DayMove>();
  for (const p of positions) {
    const quote = quotes[p.symbol] ?? null;
    const basis = quote ? displayBasis(quoteBasis(quote, status), stale, status) : "lastClose";
    bases.set(p.id, basis);
    days.set(p.id, dayMove(p.quantity, quote, basis !== "lastClose" && basis !== "lastPrice"));
  }
  const day = dayTotals(views.map((view) => ({ ...(days.get(view.id) ?? { changeUsd: null, changePct: null }), valueUsd: view.valueUsd })));
  /* Kapsanan pozisyonların künyesi tek değilse (biri seans içi, biri
     kapanış sonrası) ekran seansın kendi adını yazıyor. */
  const provenBases = [...new Set([...bases.values()].filter((b) => b !== "lastClose" && b !== "lastPrice"))];
  const dayBasis: DisplayBasis | null = provenBases.length === 1 ? provenBases[0] : provenBases.length > 1 ? (status.session === "regular" ? "session" : status.session === "pre-market" ? "pre-market" : status.session === "after-hours" ? "after-hours" : "sessionClose") : null;

  return {
    ok: true as const,
    positions,
    views,
    totals,
    names,
    buyRate,
    todayFx,
    todayRate,
    quotesResult,
    days,
    day,
    dayBasis,
  };
});

/**
 * Ana sayfa özetinin ihtiyacı kadarı — `loadPortfolio`nun üstünde ince bir
 * görünüm. `null`: tablo okunamadı ya da hesap boş; ana sayfa bu durumda
 * yuvaya portföy değil başka bir panel koyuyor, "şu an açılamıyor" demiyor.
 */
export type PortfolioSnapshot = {
  views: PositionView[];
  totals: PortfolioTotals;
  names: Awaited<ReturnType<typeof getSymbolNames>>;
  quotes: { source: DataSource; fetchedAt: Date; stale: boolean } | null;
};

export async function loadPortfolioSnapshot(userId: string): Promise<PortfolioSnapshot | null> {
  const data = await loadPortfolio(userId);
  if (!data.ok || data.positions.length === 0) return null;
  const q = data.quotesResult;
  return {
    views: data.views,
    totals: data.totals,
    names: data.names,
    quotes: q?.ok ? { source: q.source, fetchedAt: q.fetchedAt, stale: q.stale === true } : null,
  };
}
