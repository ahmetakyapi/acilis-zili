import { cache } from "react";
import { getStatus, getSymbolNames } from "@/lib/data";
import { etDateOf } from "@/lib/fx";
import { addEtDays } from "@/lib/market-hours";
import { companySector } from "@/lib/company-sector";
import type { Locale } from "@/lib/i18n";
import { sectorWeights } from "@/lib/portfolio";
import { getPortfolioPositions } from "@/lib/portfolio-data";
import { getChartBars, getQuotes } from "@/lib/providers";
import type { Bar } from "@/lib/providers/types";

/**
 * PROFİL VİTRİNİ (15 Ekim) — "kanıtlı getiri".
 *
 * Sahibin BEYANI değil, sitenin kendi kayıtlarından HESABI: getiri,
 * pozisyonların kayıtlı alış günleri ve bugünkü kotasyonla kurulur; SPY
 * kıyası "aynı günlerde aynı tutar SPY'a yatırılsaydı" sorusunun cevabıdır.
 *
 * TUTAR DIŞARI SIZMAZ. `loadPortfolio`nun görünümleri dolar tutarlarını da
 * taşıyor; bu modül profil sayfasına yalnızca YÜZDE (ağırlık, getiri) ve
 * sayım verir. Vitrine tutar eklemek gerekirse önce KVKK metni değişir —
 * oradaki söz "tutar, adet, maliyet hiçbir durumda gösterilmez".
 *
 * Dürüstlük sınırları (CLAUDE.md, veri dürüstlüğü):
 * - Fiyatı alınamayan pozisyon hesaba GİRMEZ ve sayısı söylenir.
 * - Barlar `adjustment=split`: temettü yok — künye "Temettü Hariç" yazar.
 * - Günlük SPY kapanışı en çok 1 yıl geriye gider (RANGE_SPECS tavanı);
 *   daha eski alışlar HAFTALIK kapanışa düşer, 5 yıldan eskisi kıyasa
 *   giremez. Kapsam `spyCoverage` ile döner ve tam değilse ekrana yazılır.
 * - Bayat kotasyon künyesiyle gösterilir (vitrin EKRAN katmanı), `stale`
 *   bayrağı DataStamp'e taşınır.
 */

export type ShowcaseWeight = { symbol: string; pct: number };

/** Sembol başına getiri (maliyete göre, USD) — Zil Raporu'nun en iyi/kötü satırı. */
export type ShowcaseMove = { symbol: string; returnPct: number };

export type Showcase = {
  /** Sembol başına ağırlık, büyükten küçüğe; yüzde MUTLAK (toplam 100). */
  weights: ShowcaseWeight[];
  /** Sembol başına getiri, büyükten küçüğe — rapor en iyi/kötüyü okur. */
  moves: ShowcaseMove[];
  sectors: { sector: string; pct: number }[];
  /** Maliyete göre getiri, USD, temettü hariç. */
  returnPct: number;
  /** Aynı partiler SPY'a yatırılsaydı; kıyas kurulamadıysa null. */
  spyReturnPct: number | null;
  /** SPY kıyasına girebilen maliyetin oranı (0–1). */
  spyCoverage: number;
  /** Hesaba giren en eski alış günü (YYYY-MM-DD). */
  sinceDay: string;
  /** Hesaba giren TEKİL sembol sayısı. */
  symbolCount: number;
  /** Fiyatı alınamadığı için dışarıda kalan pozisyon sayısı. */
  excludedCount: number;
  stale: boolean;
  source: string;
  asOf: Date | null;
};

/**
 * `day`i kapsayan ya da sonrasındaki ilk barın kapanışı; seri o güne
 * inmiyorsa null.
 *
 * `spanDays` barın örttüğü gün sayısı eksi bir: günlükte 0, HAFTALIKTA 6.
 * Haftalık barın damgası haftanın BAŞI — pay verilmeyince çarşamba alınan
 * bir parti kendi haftasının barını atlayıp BİR SONRAKİ haftanın kapanışına
 * düşüyordu ve SPY tabanı sistematik geç (çoğunlukla sahibin lehine)
 * alınıyordu (15 Ekim incelemesinde yakalandı).
 */
function closeOnOrAfter(
  bars: readonly Bar[],
  day: string,
  fallback: number | null,
  spanDays: number,
): number | null {
  if (bars.length === 0 || day < etDateOf(bars[0].time)) return null;
  const bar = bars.find((candidate) => addEtDays(etDateOf(candidate.time), spanDays) >= day);
  /* Son bardan da yeni bir alış (bugün alınmış): taban bugünkü fiyat —
     kıyas o parti için sıfırdan başlar, uydurma geçmiş üretilmez. */
  return bar ? bar.close : fallback;
}

export const loadShowcase = cache(
  async (userId: string, locale: Locale, otherSectorLabel: string): Promise<Showcase | null> => {
    const data = await getPortfolioPositions(userId);
    if (!data.ok || data.positions.length === 0) return null;

    const status = await getStatus();
    /* SPY aynı listede: ayrı çekilseydi iki paket iki ayrı ana düşebilirdi
       (CLAUDE.md → aynı sayı aynı kaynaktan). */
    const symbols = [...new Set([...data.positions.map((p) => p.symbol), "SPY"])];
    const [quotesResult, names, dailyBars, weeklyBars] = await Promise.all([
      getQuotes(symbols, status),
      getSymbolNames(symbols),
      getChartBars("SPY", "1Y", status),
      getChartBars("SPY", "5Y", status),
    ]);
    const quotes = quotesResult.ok ? quotesResult.data : {};
    const spyPrice = quotes.SPY?.price ?? null;
    const daily = dailyBars.ok ? dailyBars.data : [];
    const weekly = weeklyBars.ok ? weeklyBars.data : [];

    let totalValue = 0;
    let totalCost = 0;
    let spyValue = 0;
    let spyCost = 0;
    let excludedCount = 0;
    let sinceDay: string | null = null;
    const valueBySymbol = new Map<string, number>();
    const costBySymbol = new Map<string, number>();
    const sectorItems: { sector: string; valueUsd: number }[] = [];

    for (const position of data.positions) {
      const price = quotes[position.symbol]?.price ?? null;
      if (price === null || price <= 0) {
        excludedCount += 1;
        continue;
      }
      const value = position.quantity * price;
      const cost = position.quantity * position.costUsd;
      if (!(value > 0) || !(cost > 0)) {
        excludedCount += 1;
        continue;
      }
      totalValue += value;
      totalCost += cost;
      valueBySymbol.set(position.symbol, (valueBySymbol.get(position.symbol) ?? 0) + value);
      costBySymbol.set(position.symbol, (costBySymbol.get(position.symbol) ?? 0) + cost);
      sectorItems.push({
        sector:
          companySector(position.symbol, names[position.symbol]?.industry, locale) ??
          otherSectorLabel,
        valueUsd: value,
      });
      if (sinceDay === null || position.boughtAt < sinceDay) sinceDay = position.boughtAt;

      /* Önce günlük seri (son 1 yıl), sonra haftalık (5 yıl); ikisi de o
         güne inmiyorsa parti kıyasın dışında kalır ve kapsam düşer. */
      const spyClose =
        closeOnOrAfter(daily, position.boughtAt, spyPrice, 0) ??
        closeOnOrAfter(weekly, position.boughtAt, spyPrice, 6);
      if (spyPrice !== null && spyPrice > 0 && spyClose !== null && spyClose > 0) {
        spyValue += (cost / spyClose) * spyPrice;
        spyCost += cost;
      }
    }

    if (totalValue <= 0 || totalCost <= 0 || sinceDay === null) return null;

    const weights = [...valueBySymbol.entries()]
      .map(([symbol, value]) => ({ symbol, pct: (value / totalValue) * 100 }))
      .sort((a, b) => b.pct - a.pct);
    const moves = [...valueBySymbol.entries()]
      .flatMap(([symbol, value]) => {
        const cost = costBySymbol.get(symbol);
        return cost && cost > 0 ? [{ symbol, returnPct: ((value - cost) / cost) * 100 }] : [];
      })
      .sort((a, b) => b.returnPct - a.returnPct);

    return {
      weights,
      moves,
      sectors: sectorWeights(sectorItems).map(({ sector, pct }) => ({ sector, pct })),
      returnPct: ((totalValue - totalCost) / totalCost) * 100,
      spyReturnPct: spyCost > 0 ? ((spyValue - spyCost) / spyCost) * 100 : null,
      spyCoverage: totalCost > 0 ? spyCost / totalCost : 0,
      sinceDay,
      symbolCount: valueBySymbol.size,
      excludedCount,
      stale: quotesResult.ok ? quotesResult.stale === true : true,
      source: quotesResult.ok ? quotesResult.source : "cache",
      asOf: quotesResult.ok ? quotesResult.fetchedAt : null,
    };
  },
);
