import { cache } from "react";
import { ALL_MEMBERS, primaryOnly } from "@/db/seed/indices";
import { getSymbolNames, liveMarketCap, type SymbolMeta } from "@/lib/data";
import { screenCompliance } from "@/lib/compliance";
import { etParts, quoteBasis, type MarketStatus, type QuoteBasis } from "@/lib/market-hours";
import { getKeyMetrics } from "@/lib/providers/finnhub";
import type { Quote } from "@/lib/providers/types";
import { THEMES } from "@/content/themes";

/**
 * Tematik listelerin veri katmanı.
 *
 * İki kural:
 *
 * 1. EKRAN BAŞINA TEK KOTASYON ANAHTARI. `getQuotes` istek içinde sıralı
 *    sembol dizesiyle önbellekli (CLAUDE.md); tema sayfası temanın
 *    sembolleri + ölçüt ETF'i, dizin sayfası BÜTÜN temaların birleşimi için
 *    tek bir çağrı yapıyor ve her satır o tek sonuçtan okunuyor. Aynı
 *    hissenin iki panelde iki farklı yüzdesi olamaz.
 *
 * 2. KATILIM LİSTESİ SAYFA AÇILINCA SEÇİLİYOR. Elle yazılmış bir "uyumlu"
 *    listesi, taramanın kendisi değiştiğinde (eşik, alt sektör listesi)
 *    sessizce eskirdi. Liste hisse sayfalarındaki taramanın AYNI
 *    fonksiyonundan (`screenCompliance`) çıkıyor.
 */

/**
 * Katılım taramasına giren aday sayısı — en büyük N endeks üyesi.
 *
 * Tarama her aday için bir Finnhub metrik çağrısı istiyor (dakikada 60
 * sınırı). Çağrı günlük önbellekte (`getKeyMetrics`, 24 saat) ama soğuk
 * önbellekte kırk çağrı tek sayfa açılışına biniyor; endeksin beş yüz
 * üyesini taramak sınırı ilk dakikada tüketirdi. Kırk aday, yirmi satırlık
 * bir listeyi dolduracak kadar geçen şirket çıkarıyor.
 */
export const KATILIM_POOL = 40;
/** Listede gösterilen en fazla şirket — öteki temalarla aynı tavan. */
export const KATILIM_MAX = 20;

/**
 * Faaliyet alanı katılım ön elemesinden geçen endeks üyeleri, piyasa
 * değerine göre ilk `KATILIM_POOL`.
 *
 * Alan kararı `screenCompliance`e SORULUYOR, kopyalanmıyor: fonksiyon
 * alan listelerini dışa açmıyor ve açmamalı (tek yerde dursunlar). Sorunun
 * biçimi şu: oranları kesin geçen, uydurma ama tutarlı bir girdiyle
 * (fiyat 100, borç ve nakit sıfır, bant fiyatı kapsıyor) çağrıldığında
 * "pass" dönmüyorsa, geriye kalan tek sebep faaliyet alanı — elenen, gri
 * bölgedeki ya da alt sektörü bilinmeyen. Bu girdi EKRANA ÇIKMIYOR; gerçek
 * hüküm aşağıda gerçek oranlarla veriliyor.
 */
const PROBE = {
  price: 100,
  currency: "USD",
  bookValuePerShare: 1,
  debtToEquity: 0,
  cashPerShare: 0,
  low52: 50,
  high52: 150,
} as const;

export const katilimPool = cache(async function katilimPool(): Promise<string[]> {
  const members = primaryOnly(ALL_MEMBERS).filter(
    (member) => screenCompliance({ symbol: member.symbol, ...PROBE }).verdict === "pass",
  );
  const names = await getSymbolNames(members.map((member) => member.symbol));
  return members
    .map((member) => ({ symbol: member.symbol, meta: names[member.symbol] }))
    /* Yalnızca USD: oranlar pay ile paydanın aynı parada olmasını istiyor
       (gerekçe `ComplianceInputs.currency`). */
    .filter((row) => row.meta?.currency === "USD" && (row.meta.marketCap ?? 0) > 0)
    .sort((a, b) => (b.meta!.marketCap ?? 0) - (a.meta!.marketCap ?? 0))
    .slice(0, KATILIM_POOL)
    .map((row) => row.symbol);
});

/**
 * Adaylardan ön elemeyi GEÇENLER — sayfanın kendi kotasyonlarıyla.
 *
 * Fiyat çağıranın kotasyon sonucundan geliyor, ayrı bir çağrıdan değil:
 * satırda görünen fiyatla elemeye giren fiyat aynı sayı olmalı.
 */
export async function katilimMembers(
  pool: readonly string[],
  quotes: Record<string, Quote>,
  names: Record<string, SymbolMeta>,
): Promise<string[]> {
  const metrics = await Promise.all(pool.map((symbol) => getKeyMetrics(symbol)));
  return pool
    .filter((symbol, i) => {
      const result = metrics[i];
      if (!result?.ok) return false;
      return (
        screenCompliance({
          symbol,
          price: quotes[symbol]?.price ?? null,
          currency: names[symbol]?.currency ?? null,
          bookValuePerShare: result.data.bookValuePerShare,
          debtToEquity: result.data.debtToEquity,
          cashPerShare: result.data.cashPerShare,
          low52: result.data.low52,
          high52: result.data.high52,
        }).verdict === "pass"
      );
    })
    .slice(0, KATILIM_MAX);
}

/**
 * BÜTÜN TEMA EKRANLARININ TEK KOTASYON ANAHTARI — her temanın üyeleri (Katılım'da
 * adaylar) ve her temanın ölçüt ETF'i, sıralı ve tekil.
 *
 * NEDEN TEK ANAHTAR (28 Eylül denetimi). Dizin ve ana sayfa bandı bütün
 * temaların birleşimini, detay sayfası yalnızca kendi temasını + ölçütünü
 * soruyordu. `getQuotes` anahtarı sıralı sembol dizesi; iki anahtar iki ayrı
 * önbellek kaydı ve iki ayrı çekim anı demek. Ana sayfada "Bulut ve Yazılım
 * −%2,53" görüp karta tıklayan okuyucu detayda başka bir medyan
 * görebiliyordu (CLAUDE.md "aynı sayı iki yerde aynı kaynaktan"). Artık üç
 * ekran aynı anahtarı soruyor; önbellek süresi içinde aynı paketi okuyorlar.
 * Bedeli ölçütlerin eklenmesi (dokuz sembol); hepsi Alpaca'nın tek
 * isteğine (200 sembol) sığıyor.
 */
export async function themeUniverse(): Promise<string[]> {
  const pool = await katilimPool();
  return [
    ...new Set(
      THEMES.flatMap((theme) => [
        ...(theme.symbols === "katilim" ? pool : theme.symbols),
        ...(theme.benchmark ? [theme.benchmark.symbol] : []),
      ]),
    ),
  ].sort();
}

export type ThemeRow = {
  symbol: string;
  name: string | null;
  logoUrl: string | null;
  price: number | null;
  changePct: number | null;
  basis: QuoteBasis | null;
  /** Son işlemin ET günü — son kapanış kümesini tek güne indiriyor (`sameSessionMoves`). */
  tradedDay: string | null;
  marketCap: number | null;
};

export function themeRow(
  symbol: string,
  quotes: Record<string, Quote>,
  names: Record<string, SymbolMeta>,
  status: MarketStatus,
): ThemeRow {
  const quote = quotes[symbol];
  const meta = names[symbol];
  return {
    symbol,
    name: meta?.name ?? null,
    logoUrl: meta?.logoUrl ?? null,
    price: quote?.price ?? null,
    changePct: quote?.changePct ?? null,
    basis: quote ? quoteBasis(quote, status) : null,
    tradedDay: quote?.tradedAt ? etParts(quote.tradedAt).dateStr : null,
    /* Canlı hesap — `/karsilastir` ve `/sirketler` ile aynı fonksiyon;
       aynı şirket iki ekranda iki piyasa değeri taşımasın. */
    marketCap: liveMarketCap(meta, quote?.price),
  };
}

/** Piyasa değerine göre büyükten küçüğe; bilinmeyen sona. */
export function byMarketCap(a: ThemeRow, b: ThemeRow): number {
  if (a.marketCap === null && b.marketCap === null) return a.symbol.localeCompare(b.symbol);
  if (a.marketCap === null) return 1;
  if (b.marketCap === null) return -1;
  return b.marketCap - a.marketCap;
}
