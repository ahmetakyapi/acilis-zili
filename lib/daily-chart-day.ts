import "server-only";

import { cache } from "react";
import { getEventsBetweenResult, getSymbolNames } from "@/lib/data";
import { checkChartBlock, pickMovers } from "@/lib/daily-chart";
import { memberSymbolOf } from "@/lib/daily-chart-figure";
import { getDayPoster } from "@/lib/day-poster-data";
import type { DayPoster } from "@/lib/day-poster";
import { getEarningsWithOverrides } from "@/lib/earnings-overrides";

/* ==========================================================================
   Günün Grafiği — o günün bağlamı (25 Ekim, görsel tur)

   Grafik tek bir soruyu anlatıyor ("sektörler nasıl kapandı"); okuyucu
   aynı ekranda günün geri kalanını da görmek istiyor: endeksler, kaç hisse
   yükseldi, uçta kim vardı, takvimde ne vardı.

   KAYNAK GÜNÜN POSTERİ (`getDayPoster`): kapanmış seansın gün barları, bir
   gün önbellekte, hata önbelleğin dışında, 365 günlük arşivi kapsıyor.
   Poster sayfası, ana sayfanın kapanış künyesi ve bu panel aynı çağrıyı
   yapıyor: "312 Yükseldi" her yerde aynı sayı (CLAUDE.md "Veri dürüstlüğü"
   3). Rutinin bağlam paketi (`loadDailyChartContext`) BİLEREK değil: ~600
   sembolü önbelleksiz çekiyor, evren barları bir aylık (eski günde
   öne çıkanlar boş kalırdı) ve her sayfa açılışında yeniden çalışırdı.

   Her parça kendi başına düşer: poster okunamazsa endeks, genişlik ve
   öne çıkanlar basılmaz; takvim okunamazsa takvim kartı basılmaz. "Okunamadı"
   ile "yoktu" ayrı: olay sorgusu düştüyse "o gün veri yoktu" denmez.
   ========================================================================== */

/** Öne çıkanlar: her yönde üç hisse — kartta logo, sembol ve yüzde sığıyor. */
export const CONTEXT_MOVERS = 3;
/** Takvim kartında en çok kaç veri satırı. */
export const CONTEXT_EVENTS = 4;
/** Bilanço açıklayanlardan kaçının logosu (piyasa değerine göre). */
export const CONTEXT_EARNINGS_LOGOS = 5;

export type ContextMover = { symbol: string; change: number; name: string | null; logoUrl: string | null };

export type ContextEvent = {
  slug: string;
  timeEt: string | null;
  titleTr: string;
  titleEn: string;
  importance: string;
};

export type ContextEarning = { symbol: string; name: string | null; logoUrl: string | null };

export type ChartDayContext = {
  date: string;
  poster: DayPoster | null;
  gainers: ContextMover[];
  losers: ContextMover[];
  /** null: takvim okunamadı (boş liste "o gün veri yoktu" demek). */
  events: ContextEvent[] | null;
  eventsTotal: number;
  earnings: ContextEarning[] | null;
  earningsTotal: number;
};

/** Önem sırası — yüksek önce, sonra saat. */
const IMPORTANCE_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

async function readEarnings(date: string) {
  try {
    return await getEarningsWithOverrides(date, date);
  } catch (error) {
    console.error(`[gunun-grafigi] ${date} bilanço takvimi okunamadı: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * Grafiğin hisse kalemlerinin logoları (31 Ekim): sembol → logo adresi.
 * Sembol bloğun ADINDAN, yalnız tek anlamlı eşleşmeyle (`memberSymbolOf`);
 * adres sembol tablosundan (`getSymbolNames`, istek içinde tek sorgu). Logo
 * satırı yoksa `LogoTile` önce depodaki dosyaya, o da yoksa harflere düşer.
 * Bozuk blok ya da hissesiz grafik boş harita.
 */
export async function getChartLogos(chartMd: string, locale: string): Promise<Record<string, string | null>> {
  const check = checkChartBlock(chartMd, locale);
  if (!check.ok || check.block.kind !== "bars") return {};
  const symbols = check.block.items
    .map((item) => memberSymbolOf(item.name))
    .filter((symbol): symbol is string => symbol !== null);
  if (symbols.length === 0) return {};
  const meta = await getSymbolNames(symbols);
  return Object.fromEntries(symbols.map((symbol) => [symbol, meta[symbol]?.logoUrl ?? null]));
}

export const getChartDayContext = cache(async function getChartDayContext(date: string): Promise<ChartDayContext> {
  const [posterRead, eventsRead, earningsRows] = await Promise.all([
    getDayPoster(date),
    getEventsBetweenResult(date, date),
    readEarnings(date),
  ]);
  const poster = posterRead.state === "ok" ? posterRead.poster : null;

  /* Öne çıkanlar posterin hisse başına değişiminden — genişliği sayan küme
     ile aynı. `pickMovers` eşitlikte sembol sırasına bakıyor (kararlı). */
  const picked = poster
    ? pickMovers(poster.stocks.map((stock) => ({ symbol: stock.symbol, pct: stock.change })), CONTEXT_MOVERS)
    : { gainers: [], losers: [] };
  const earningSymbols = earningsRows ? [...new Set(earningsRows.map((row) => row.symbol))] : [];
  const meta = await getSymbolNames([
    ...picked.gainers.map((row) => row.symbol),
    ...picked.losers.map((row) => row.symbol),
    ...earningSymbols,
  ]);
  const mover = (row: { symbol: string; pct: number }): ContextMover => ({
    symbol: row.symbol,
    change: row.pct,
    name: meta[row.symbol]?.name ?? null,
    logoUrl: meta[row.symbol]?.logoUrl ?? null,
  });

  const events = eventsRead.ok
    ? [...eventsRead.rows].sort(
        (a, b) =>
          (IMPORTANCE_RANK[a.importance] ?? 3) - (IMPORTANCE_RANK[b.importance] ?? 3) ||
          (a.eventTimeEt ?? "99").localeCompare(b.eventTimeEt ?? "99"),
      )
    : null;

  /* Bilanço logoları en büyük şirketlerden: piyasa değeri bilinmeyen sona. */
  const earnings = earningsRows
    ? earningSymbols
        .map((symbol) => ({ symbol, cap: meta[symbol]?.marketCap ?? -1 }))
        .sort((a, b) => b.cap - a.cap || a.symbol.localeCompare(b.symbol))
        .map(({ symbol }) => ({ symbol, name: meta[symbol]?.name ?? null, logoUrl: meta[symbol]?.logoUrl ?? null }))
    : null;

  return {
    date,
    poster,
    gainers: picked.gainers.map(mover),
    losers: picked.losers.map(mover),
    events: events
      ? events.slice(0, CONTEXT_EVENTS).map((row) => ({
          slug: row.slug,
          timeEt: row.eventTimeEt,
          titleTr: row.titleTr,
          titleEn: row.titleEn,
          importance: row.importance,
        }))
      : null,
    eventsTotal: events?.length ?? 0,
    earnings: earnings ? earnings.slice(0, CONTEXT_EARNINGS_LOGOS) : null,
    earningsTotal: earnings?.length ?? 0,
  };
});
