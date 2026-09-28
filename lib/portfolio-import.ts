/**
 * EKSTREDEN PORTFÖYE — işlemlerden açık pozisyonlara. SAF katman
 * (sınama: tests/portfolio-import.test.ts).
 *
 * Ayrıştırma vergi hesaplayıcısıyla ORTAK (`lib/tax-import`: Midas PDF,
 * IBKR PDF/CSV); burada yalnızca "elimde bugün ne kaldı" sorusu cevaplanıyor.
 *
 * YÖNTEM: İLK GİREN İLK ÇIKAR (FIFO). Her satış en eski alıştan düşülür;
 * geriye kalan her alış KENDİ tarihi ve fiyatıyla bir "lot" olarak kalır.
 * Neden lot lot: portföyün TL maliyeti alış GÜNÜNÜN kuruyla kuruluyor
 * (`lib/portfolio.ts`). İki alışı tek satıra ortalamak, iki farklı günün
 * kurunu tek bir güne yıkmak demek. Vergi hesaplayıcısı da FIFO eşliyor;
 * iki ekran aynı alıştan aynı kalanı görüyor.
 *
 * "Sembol başına tek satır" isteyene `collapseLots` var: adet ağırlıklı
 * ortalama maliyet, tarih en eski kalan alışın günü. Bu seçimde TL maliyet
 * o tek günün kuruyla hesaplanır ve ekran bunu söylüyor.
 *
 * KOMİSYON MALİYETE EKLENMEZ: portföy satırı hisse başı fiyat taşıyor ve
 * elle girilen pozisyonda da komisyon yok. Ekstrenin fiyatı olduğu gibi.
 *
 * UYDURMA YOK. Bir satış, ekstredeki alışlardan fazlaysa (alış daha eski
 * bir ekstrede kalmış) o sembolün kalanı BİLİNEMEZ: sembol `incomplete`
 * olur ve portföye hiçbir şey önerilmez. Tamamen satılmış sembol `closed`.
 */

export type ImportTradeInput = {
  side: "buy" | "sell";
  symbol: string;
  /** "YYYY-MM-DD" */
  date: string;
  quantity: number;
  priceUsd: number;
};

export type ImportLot = {
  symbol: string;
  date: string;
  quantity: number;
  costUsd: number;
};

export type SymbolPlan = {
  symbol: string;
  status: "open" | "closed" | "incomplete";
  /** Kalan alışlar, eskiden yeniye. `incomplete`te boş. */
  lots: ImportLot[];
  /** Kalan adet (alışlar − satışlar); `incomplete`te null. */
  quantity: number | null;
  /** Kalan lotların adet ağırlıklı ortalama maliyeti. */
  avgCostUsd: number | null;
  bought: number;
  sold: number;
  /** `incomplete`te: ekstredeki alışları aşan satış adedi. */
  missingQuantity: number;
};

/** Kesirli adette kayan nokta kırıntısı: bunun altı sıfırdır. */
const QTY_EPSILON = 1e-9;
/** Adet sekiz ondalık taşıyor (şema `numeric(20, 8)`). */
const QTY_DECIMALS = 8;
/** Aynı lot mu: fiyatta bir sentin yarısı kadar pay. */
const PRICE_EPSILON = 0.005;

function roundQty(value: number): number {
  const factor = 10 ** QTY_DECIMALS;
  return Math.round(value * factor) / factor;
}

/**
 * İşlemler → sembol başına plan. Sıra TARİHE göre; aynı gün içinde ekstre
 * sırası korunuyor (dizi sıralaması kararlı). Sonuç sembole göre alfabetik.
 */
export function netPositions(trades: readonly ImportTradeInput[]): SymbolPlan[] {
  const ordered = [...trades].sort((a, b) => a.date.localeCompare(b.date));
  const bySymbol = new Map<string, { lots: ImportLot[]; bought: number; sold: number; missing: number }>();
  for (const trade of ordered) {
    if (!(trade.quantity > 0) || !(trade.priceUsd > 0)) continue;
    const entry = bySymbol.get(trade.symbol) ?? { lots: [], bought: 0, sold: 0, missing: 0 };
    bySymbol.set(trade.symbol, entry);
    if (trade.side === "buy") {
      entry.bought = roundQty(entry.bought + trade.quantity);
      entry.lots.push({ symbol: trade.symbol, date: trade.date, quantity: trade.quantity, costUsd: trade.priceUsd });
      continue;
    }
    entry.sold = roundQty(entry.sold + trade.quantity);
    let remaining = trade.quantity;
    while (remaining > QTY_EPSILON && entry.lots.length > 0) {
      const lot = entry.lots[0];
      const take = Math.min(lot.quantity, remaining);
      lot.quantity = roundQty(lot.quantity - take);
      remaining = roundQty(remaining - take);
      if (lot.quantity <= QTY_EPSILON) entry.lots.shift();
    }
    if (remaining > QTY_EPSILON) entry.missing = roundQty(entry.missing + remaining);
  }

  const plans: SymbolPlan[] = [];
  for (const [symbol, entry] of bySymbol) {
    if (entry.missing > 0) {
      plans.push({ symbol, status: "incomplete", lots: [], quantity: null, avgCostUsd: null, bought: entry.bought, sold: entry.sold, missingQuantity: entry.missing });
      continue;
    }
    const quantity = roundQty(entry.lots.reduce((sum, lot) => sum + lot.quantity, 0));
    if (quantity <= QTY_EPSILON) {
      plans.push({ symbol, status: "closed", lots: [], quantity: 0, avgCostUsd: null, bought: entry.bought, sold: entry.sold, missingQuantity: 0 });
      continue;
    }
    plans.push({
      symbol,
      status: "open",
      lots: entry.lots,
      quantity,
      avgCostUsd: weightedCost(entry.lots),
      bought: entry.bought,
      sold: entry.sold,
      missingQuantity: 0,
    });
  }
  return plans.sort((a, b) => a.symbol.localeCompare(b.symbol));
}

function weightedCost(lots: readonly ImportLot[]): number {
  const quantity = lots.reduce((sum, lot) => sum + lot.quantity, 0);
  const cost = lots.reduce((sum, lot) => sum + lot.quantity * lot.costUsd, 0);
  return quantity > 0 ? cost / quantity : 0;
}

/** Sembolün kalan lotları tek satırda: ağırlıklı ortalama, en eski kalan gün. */
export function collapseLots(lots: readonly ImportLot[]): ImportLot[] {
  if (lots.length <= 1) return [...lots];
  const quantity = roundQty(lots.reduce((sum, lot) => sum + lot.quantity, 0));
  const date = lots.reduce((min, lot) => (lot.date < min ? lot.date : min), lots[0].date);
  return [{ symbol: lots[0].symbol, date, quantity, costUsd: weightedCost(lots) }];
}

/* --------------------------------------------------------------------------
   Portföydekiyle karşılaştırma
   -------------------------------------------------------------------------- */

export type ExistingPosition = { symbol: string; quantity: number; costUsd: number; boughtAt: string };

export type SymbolImport = {
  symbol: string;
  /** Eklenecek lotlar (portföyde birebir aynısı olanlar ayıklanmış). */
  lots: ImportLot[];
  /** Portföyde birebir aynı duran ve bu yüzden atlanan lot sayısı. */
  duplicates: number;
  /** Portföyde bu sembolden ZATEN satır var mı — varsa okuyucuya sorulur. */
  conflict: boolean;
};

/**
 * Plan → eklenecekler. Aynı ekstreyi ikinci kez yükleyen okuyucu aynı
 * pozisyonu iki kez eklememeli: sembol, gün, adet ve fiyatı portföydeki bir
 * satırla BİREBİR tutan lot kendiliğinden ayıklanıyor. Geriye yeni lot
 * kalan ama portföyde o sembolden satır olan her sembol `conflict`: birleştir
 * (yanına ekle) ya da atla kararını okuyucu veriyor.
 */
export function planImport(
  plans: readonly SymbolPlan[],
  existing: readonly ExistingPosition[],
  mode: "lots" | "symbol",
): SymbolImport[] {
  const out: SymbolImport[] = [];
  for (const plan of plans) {
    if (plan.status !== "open") continue;
    const held = existing.filter((p) => p.symbol === plan.symbol);
    const candidates = mode === "symbol" ? collapseLots(plan.lots) : plan.lots;
    const pool = [...held];
    const lots: ImportLot[] = [];
    let duplicates = 0;
    for (const lot of candidates) {
      const match = pool.findIndex(
        (p) =>
          p.boughtAt === lot.date &&
          Math.abs(p.quantity - lot.quantity) <= QTY_EPSILON &&
          Math.abs(p.costUsd - lot.costUsd) <= PRICE_EPSILON,
      );
      if (match >= 0) {
        pool.splice(match, 1);
        duplicates += 1;
      } else {
        lots.push(lot);
      }
    }
    out.push({ symbol: plan.symbol, lots, duplicates, conflict: held.length > 0 && lots.length > 0 });
  }
  return out;
}
