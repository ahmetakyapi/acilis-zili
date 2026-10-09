/**
 * Portföy satışları — saf hesaplar. Okuma `lib/portfolio-sales-data.ts`,
 * yazma `app/actions/portfolio.ts` → `sellPositionAction`.
 *
 * Gerekçe şemada (`lib/schema.ts` → portfolioSales). Bu modül veritabanına
 * dokunmuyor: FIFO planı ve kâr/zarar hesabı birim testinde sınanıyor
 * (`tests/portfolio-sales.test.ts`).
 */

/** Adet sütununun ölçeği `numeric(20,8)` — karşılaştırmada bu kadar pay. */
export const QTY_EPSILON = 1e-8;

export type SaleLot = {
  id: string;
  quantity: number;
  costUsd: number;
  boughtAt: string;
  note: string | null;
};

export type FifoStep = {
  lot: SaleLot;
  /** Bu partiden düşülen adet. */
  take: number;
  /** Parti tamamen tükendi mi — satır silinir, değilse adedi azalır. */
  exhausted: boolean;
};

export type FifoPlan =
  | { ok: true; steps: FifoStep[] }
  | { ok: false; reason: "noLots" | "tooMany"; available: number };

/**
 * İlk giren ilk çıkar: satış gününden SONRA alınmış parti tüketilemez
 * (henüz yoktu), kalanlar alış gününe göre eskiden yeniye. Aynı gün
 * alınmış partilerde sıra çağıranın verdiği sıra (kayıt sırası).
 */
export function planFifoSale(lots: readonly SaleLot[], quantity: number, soldAt: string): FifoPlan {
  const eligible = lots
    .map((lot, index) => ({ lot, index }))
    .filter(({ lot }) => lot.boughtAt <= soldAt && lot.quantity > 0)
    .sort((a, b) => (a.lot.boughtAt === b.lot.boughtAt ? a.index - b.index : a.lot.boughtAt < b.lot.boughtAt ? -1 : 1))
    .map(({ lot }) => lot);
  const available = eligible.reduce((sum, lot) => sum + lot.quantity, 0);
  if (eligible.length === 0) return { ok: false, reason: "noLots", available: 0 };
  if (quantity > available + QTY_EPSILON) return { ok: false, reason: "tooMany", available };

  const steps: FifoStep[] = [];
  let left = quantity;
  for (const lot of eligible) {
    if (left <= QTY_EPSILON) break;
    const take = Math.min(lot.quantity, left);
    const rest = lot.quantity - take;
    steps.push({ lot, take, exhausted: rest <= QTY_EPSILON });
    left -= take;
  }
  return { ok: true, steps };
}

export type SalePart = {
  saleId: string;
  symbol: string;
  quantity: number;
  priceUsd: number;
  soldAt: string;
  costUsd: number;
  boughtAt: string;
};

/** Bir satış olayı: aynı `saleId`nin partileri toplanmış hâli. */
export type SaleView = {
  saleId: string;
  symbol: string;
  soldAt: string;
  quantity: number;
  priceUsd: number;
  proceedsUsd: number;
  costTotalUsd: number;
  pnlUsd: number;
  pnlUsdPct: number | null;
  /** Lira tarafı: maliyet her partinin ALIŞ günü kuruyla, gelir SATIŞ günü kuruyla. */
  costTl: number | null;
  proceedsTl: number | null;
  pnlTl: number | null;
  pnlTlPct: number | null;
  sellRate: number | null;
  /** Kaç parti tüketildi — birden fazlaysa ekran FIFO'yu söylüyor. */
  lots: number;
  /** En eski tüketilen partinin alış günü. */
  firstBoughtAt: string;
};

/**
 * Satış partilerini olaylara toplar. `rateAt` bir günün TCMB döviz alış
 * kuru; bilinmeyen gün `null` ve o olayın lira tarafı boş kalır — kısmi bir
 * lira toplamı uydurulmaz (veri dürüstlüğü 1).
 */
export function saleViews(parts: readonly SalePart[], rateAt: (date: string) => number | null): SaleView[] {
  const groups = new Map<string, SalePart[]>();
  for (const part of parts) {
    const list = groups.get(part.saleId);
    if (list) list.push(part);
    else groups.set(part.saleId, [part]);
  }
  const views: SaleView[] = [];
  for (const [saleId, list] of groups) {
    const first = list[0];
    const quantity = list.reduce((sum, part) => sum + part.quantity, 0);
    const proceedsUsd = quantity * first.priceUsd;
    const costTotalUsd = list.reduce((sum, part) => sum + part.quantity * part.costUsd, 0);
    const pnlUsd = proceedsUsd - costTotalUsd;
    const sellRate = rateAt(first.soldAt);
    let costTl: number | null = 0;
    for (const part of list) {
      const buyRate = rateAt(part.boughtAt);
      if (buyRate === null || costTl === null) {
        costTl = null;
        break;
      }
      costTl += part.quantity * part.costUsd * buyRate;
    }
    const proceedsTl = sellRate === null ? null : proceedsUsd * sellRate;
    const pnlTl = costTl !== null && proceedsTl !== null ? proceedsTl - costTl : null;
    views.push({
      saleId,
      symbol: first.symbol,
      soldAt: first.soldAt,
      quantity,
      priceUsd: first.priceUsd,
      proceedsUsd,
      costTotalUsd,
      pnlUsd,
      pnlUsdPct: costTotalUsd > 0 ? (pnlUsd / costTotalUsd) * 100 : null,
      costTl,
      proceedsTl,
      pnlTl,
      pnlTlPct: pnlTl !== null && costTl ? (pnlTl / costTl) * 100 : null,
      sellRate,
      lots: list.length,
      firstBoughtAt: list.reduce((min, part) => (part.boughtAt < min ? part.boughtAt : min), first.boughtAt),
    });
  }
  /* Yeniden eskiye: okuyucu son satışını arıyor. */
  return views.sort((a, b) => (a.soldAt === b.soldAt ? 0 : a.soldAt < b.soldAt ? 1 : -1));
}

export type YearTotal = {
  year: string;
  count: number;
  pnlUsd: number;
  /** Yılın satışlarından birinin kuru eksikse `null` — kısmi toplam yok. */
  pnlTl: number | null;
};

/** Satış yılına göre toplam — beyan yılı satış günüyle belirleniyor. */
export function yearTotals(views: readonly SaleView[]): YearTotal[] {
  const byYear = new Map<string, YearTotal>();
  for (const view of views) {
    const year = view.soldAt.slice(0, 4);
    const total = byYear.get(year) ?? { year, count: 0, pnlUsd: 0, pnlTl: 0 };
    total.count += 1;
    total.pnlUsd += view.pnlUsd;
    total.pnlTl = total.pnlTl === null || view.pnlTl === null ? null : total.pnlTl + view.pnlTl;
    byYear.set(year, total);
  }
  return [...byYear.values()].sort((a, b) => (a.year < b.year ? 1 : -1));
}
