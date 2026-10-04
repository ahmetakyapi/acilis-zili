import "server-only";

import { cache } from "react";
import { unstable_cache } from "next/cache";
import { inArray } from "drizzle-orm";
import { db } from "./db";
import { cusipTickers } from "./schema";
import {
  getGlobalXHoldings,
  getNportHoldings,
  getTidalHoldings,
  getVanEckHoldings,
  getRoundhillHoldings,
  getSsgaHoldings,
  getTemaHoldings,
  type HoldingRow,
  type HoldingsFile,
} from "./providers/etf-holdings";
import type { ProviderResult } from "./providers/types";

/**
 * Fonun içindekiler — ETF detayının "hangi hisseler, ne ağırlıkla" paneli.
 *
 * Kaynak fon başına (aşağıda). Kapsam dışı bir fonda panel hiç çizilmiyor;
 * kaynak düştüğünde panel "alınamadı" diyor, sayfanın geri kalanı çalışıyor.
 */

/** Hata bir kez günlüğe; ekrana "alınamadı" olarak çıkıyor. */
function yutuldu(kaynak: string, error: unknown): void {
  const mesaj = error instanceof Error ? error.message : String(error);
  console.error(`[fon içeriği] ${kaynak}: ${mesaj}`);
}

export type HoldingsSource = "ssga" | "roundhill" | "tema" | "nport" | "tidal" | "globalx" | "vaneck";

/**
 * Hangi fon, hangi kaynaktan. Liste kısa ve elle: her ihraççının dosya
 * biçimi ayrı ve bir fonu eklemek, o biçimin bu fonda da doğrulanması
 * demek (4 Ekim 2026'da SPY, DIA, XLK, DRAM, NASA ve QQQ'nun gerçek
 * dosyaları ayrıştırıcıdan geçirildi).
 */
export const HOLDINGS_SOURCES: Record<string, { source: HoldingsSource; cik?: string; url?: string; page?: string }> = {
  SPY: { source: "ssga" },
  DIA: { source: "ssga" },
  XLK: { source: "ssga" },
  XLF: { source: "ssga" },
  XLV: { source: "ssga" },
  XLY: { source: "ssga" },
  XLP: { source: "ssga" },
  XLE: { source: "ssga" },
  XLI: { source: "ssga" },
  XLB: { source: "ssga" },
  XLU: { source: "ssga" },
  XLRE: { source: "ssga" },
  XLC: { source: "ssga" },
  DRAM: { source: "roundhill" },
  NASA: { source: "tema" },
  /* Yapay zekâ, yarı iletken ve katılım fonları (4 Ekim, sahibinin
     isteği). Dördü de canlı uca karşı denendi. */
  SMH: { source: "vaneck", page: "semiconductor-etf-smh" },
  AIQ: { source: "globalx" },
  BOTZ: { source: "globalx" },
  CHAT: { source: "roundhill" },
  SPUS: { source: "tidal", url: "https://www.sp-funds.com/wp-content/uploads/data/TidalFG_Holdings_SPUS.csv" },
  /* Invesco QQQ Trust, Series 1 — SEC CIK. */
  QQQ: { source: "nport", cik: "1067839" },
};

/** Panelde en fazla bu kadar satır; önbelleğe de yalnızca bu kadarı girer. */
export const HOLDINGS_KEEP = 25;

export type EtfHoldings = {
  source: HoldingsSource;
  asOf: string;
  /** Fondaki hisse kalemi sayısı (nakit ve teminat hariç). */
  count: number;
  /** İlk on kalemin toplam ağırlığı, yüzde. */
  topTenShare: number;
  /** Ağırlığa göre azalan, en fazla `HOLDINGS_KEEP`. */
  rows: HoldingRow[];
  fetchedAt: string;
};

async function fetchFile(symbol: string): Promise<ProviderResult<HoldingsFile>> {
  const config = HOLDINGS_SOURCES[symbol];
  switch (config.source) {
    case "ssga":
      return getSsgaHoldings(symbol);
    case "roundhill":
      return getRoundhillHoldings(symbol);
    case "tema":
      return getTemaHoldings(symbol);
    case "nport":
      return getNportHoldings(config.cik ?? "");
    case "tidal":
      return getTidalHoldings(symbol, config.url ?? "");
    case "globalx":
      return getGlobalXHoldings(symbol);
    case "vaneck":
      return getVanEckHoldings(config.page ?? "");
  }
}

/**
 * N-PORT satırları sembolsüz. İki kaynakla eşleniyor:
 *   1. `cusip_tickers` — 13F için OpenFIGI'den doldurulan kalıcı tablo.
 *      Tablo yoksa ya da veritabanı düşmüşse sessizce atlanıyor.
 *   2. SPY'nin günlük dosyası — her satırda CUSIP ve sembol yan yana;
 *      Nasdaq-100 şirketlerinin büyük çoğunluğu S&P 500'de de var.
 * Eşlenemeyen satır sembolsüz kalıyor ve adıyla görünüyor; tahmin yok.
 */
async function resolveTickers(rows: HoldingRow[]): Promise<HoldingRow[]> {
  const missing = rows.filter((row) => !row.ticker && row.cusip).map((row) => row.cusip!);
  if (missing.length === 0) return rows;
  const map = new Map<string, string>();
  try {
    const found = await db
      .select({ cusip: cusipTickers.cusip, ticker: cusipTickers.ticker })
      .from(cusipTickers)
      .where(inArray(cusipTickers.cusip, missing));
    for (const row of found) if (row.ticker) map.set(row.cusip, row.ticker);
  } catch (error) {
    yutuldu("etf-holdings cusip_tickers", error);
  }
  if (missing.some((cusip) => !map.has(cusip))) {
    const spy = await getSsgaHoldings("SPY");
    if (spy.ok) for (const row of spy.data.rows) if (row.cusip && row.ticker && !map.has(row.cusip)) map.set(row.cusip, row.ticker);
  }
  return rows.map((row) => (row.ticker || !row.cusip ? row : { ...row, ticker: map.get(row.cusip) ?? null }));
}

/**
 * İSTEKLER ARASI ÖNBELLEK, YALNIZ BAŞARI. İçerideki fonksiyon kaynak
 * düşünce FIRLATIYOR; `unstable_cache` hatayı saklamıyor, bir sonraki
 * istek yeniden deniyor (CLAUDE.md "hata önbelleğin DIŞINDA").
 *
 * Süreler kaynağın ritmine göre: ihraççı dosyaları günde bir değişiyor,
 * altı saat yeter; N-PORT çeyrekte bir, bir gün.
 * Önbelleğe ham dosya değil, ilk 25 satır giriyor (SPY dosyası 500 satır).
 */
const loadHoldings = unstable_cache(
  async function loadHoldings(symbol: string): Promise<EtfHoldings> {
    const result = await fetchFile(symbol);
    if (!result.ok) throw new Error(`${symbol}: ${result.message}`);
    const sorted = [...result.data.rows].sort((a, b) => b.weight - a.weight);
    const top = sorted.slice(0, HOLDINGS_KEEP);
    return {
      source: HOLDINGS_SOURCES[symbol].source,
      asOf: result.data.asOf,
      count: sorted.length,
      topTenShare: sorted.slice(0, 10).reduce((sum, row) => sum + row.weight, 0),
      rows: await resolveTickers(top),
      fetchedAt: result.fetchedAt.toISOString(),
    };
  },
  ["etf-holdings-v1"],
  { revalidate: 6 * 3600 },
);

/** Kapsam dışı fonda `null`; kaynak düştüğünde `"error"`. */
export const getEtfHoldings = cache(async function getEtfHoldings(
  symbol: string,
): Promise<EtfHoldings | "error" | null> {
  if (!HOLDINGS_SOURCES[symbol]) return null;
  try {
    return await loadHoldings(symbol);
  } catch (error) {
    yutuldu("getEtfHoldings", error);
    return "error";
  }
});
