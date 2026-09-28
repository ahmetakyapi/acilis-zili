import { isValidSymbol } from "@/lib/utils";

/**
 * Portföy hesabı — SAF katman (sınama: tests/portfolio.test.ts).
 *
 * Dolar K/Z: (fiyat − alış fiyatı) × adet.
 * Lira K/Z: bugünkü değer × BUGÜNÜN kuru − maliyet × ALIŞ GÜNÜNÜN kuru.
 * İki kurun farklı olması konunun ta kendisi: dolarda yerinde sayan bir
 * hisse lirada kazandırmış görünebilir ve bunun ne kadarının kurdan geldiği
 * ayrıca yazılıyor (`fxEffectTl`).
 *
 * Kur ALIŞ tarafı (TCMB döviz alış) — vergi hesaplayıcısıyla aynı taraf,
 * yoksa iki ekran aynı pozisyon için iki TL maliyeti yazardı.
 */

export type PositionInput = {
  id: string;
  symbol: string;
  quantity: number;
  costUsd: number;
  boughtAt: string;
};

export type PositionView = PositionInput & {
  price: number | null;
  costTotalUsd: number;
  valueUsd: number | null;
  pnlUsd: number | null;
  pnlUsdPct: number | null;
  buyRate: number | null;
  costTl: number | null;
  valueTl: number | null;
  pnlTl: number | null;
  pnlTlPct: number | null;
};

export function positionView(
  position: PositionInput,
  price: number | null,
  buyRate: number | null,
  todayRate: number | null,
): PositionView {
  const costTotalUsd = position.quantity * position.costUsd;
  const valueUsd = price === null ? null : position.quantity * price;
  const pnlUsd = valueUsd === null ? null : valueUsd - costTotalUsd;
  const costTl = buyRate ? costTotalUsd * buyRate : null;
  const valueTl = valueUsd !== null && todayRate ? valueUsd * todayRate : null;
  const pnlTl = costTl !== null && valueTl !== null ? valueTl - costTl : null;
  return {
    ...position,
    price,
    costTotalUsd,
    valueUsd,
    pnlUsd,
    pnlUsdPct: pnlUsd !== null && costTotalUsd > 0 ? (pnlUsd / costTotalUsd) * 100 : null,
    buyRate,
    costTl,
    valueTl,
    pnlTl,
    pnlTlPct: pnlTl !== null && costTl ? (pnlTl / costTl) * 100 : null,
  };
}

export type PortfolioTotals = {
  valueUsd: number;
  costUsd: number;
  pnlUsd: number;
  valueTl: number | null;
  costTl: number | null;
  pnlTl: number | null;
  /** Lira K/Z'nin kurdan gelen kısmı: lira K/Z − dolar K/Z × bugünün kuru. */
  fxEffectTl: number | null;
  /** Fiyatı ya da kuru eksik pozisyon var mı — toplam o zaman kısmi. */
  partial: boolean;
};

/**
 * Toplamlar. Fiyatı olmayan pozisyon toplamın DIŞINDA kalıyor ve `partial`
 * bunu söylüyor: maliyetini toplama katıp değerini katmamak sahte bir zarar
 * yazardı.
 */
export function portfolioTotals(
  views: readonly PositionView[],
  todayRate: number | null,
): PortfolioTotals {
  let valueUsd = 0;
  let costUsd = 0;
  let valueTl = 0;
  let costTl = 0;
  let partial = false;
  let tlComplete = todayRate !== null;
  for (const view of views) {
    if (view.valueUsd === null) {
      partial = true;
      continue;
    }
    valueUsd += view.valueUsd;
    costUsd += view.costTotalUsd;
    if (view.valueTl === null || view.costTl === null) {
      tlComplete = false;
    } else {
      valueTl += view.valueTl;
      costTl += view.costTl;
    }
  }
  const pnlUsd = valueUsd - costUsd;
  const pnlTl = tlComplete ? valueTl - costTl : null;
  return {
    valueUsd,
    costUsd,
    pnlUsd,
    valueTl: tlComplete ? valueTl : null,
    costTl: tlComplete ? costTl : null,
    pnlTl,
    fxEffectTl: pnlTl !== null && todayRate ? toKurus(pnlTl - pnlUsd * todayRate) : null,
    partial: partial || !tlComplete,
  };
}

/**
 * Kuruşa yuvarlama. Kurun katkısı iki büyük sayının FARKI ve bugün alınan
 * bir pozisyonda (alış kuru = bugünün kuru) sıfır olmalı; kayan nokta onu
 * −0,000000001 bırakıyordu ve şerit kırmızı "−0,00 ₺" basıyordu (28 Eylül,
 * ekran görüntüsünde yakalandı). Yuvarlanan −0 yön hesabında "düz" sayılır.
 */
const KURUS = 100;
function toKurus(value: number): number {
  return Math.round(value * KURUS) / KURUS;
}

/** Sektör ağırlıkları — güncel dolar değerine göre, büyükten küçüğe. */
export function sectorWeights(
  items: readonly { sector: string; valueUsd: number | null }[],
): { sector: string; valueUsd: number; pct: number }[] {
  const bySector = new Map<string, number>();
  let total = 0;
  for (const item of items) {
    if (item.valueUsd === null || item.valueUsd <= 0) continue;
    bySector.set(item.sector, (bySector.get(item.sector) ?? 0) + item.valueUsd);
    total += item.valueUsd;
  }
  if (total <= 0) return [];
  return [...bySector.entries()]
    .map(([sector, valueUsd]) => ({ sector, valueUsd, pct: (valueUsd / total) * 100 }))
    .sort((a, b) => b.valueUsd - a.valueUsd);
}

/* --------------------------------------------------------------------------
   Vergi hesaplayıcısına aktarım — İSTEMCİDE, sunucuya gitmeden
   -------------------------------------------------------------------------- */

/** `sessionStorage` anahtarı: portföy yazar, `/vergi` bir kez okuyup siler. */
export const TAX_HANDOFF_KEY = "az-vergi-aktar";

export type TaxHandoffPosition = {
  symbol: string;
  quantity: number;
  costUsd: number;
  boughtAt: string;
};

/**
 * Depodan okunan aktarım — güvenilmez girdi (başka bir sekme ya da eklenti
 * yazmış olabilir), alan alan doğrulanıyor. Bozuk satır atlanıyor.
 */
export function parseTaxHandoff(raw: string | null): TaxHandoffPosition[] {
  if (!raw) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  const out: TaxHandoffPosition[] = [];
  for (const entry of data.slice(0, HANDOFF_MAX)) {
    if (typeof entry !== "object" || entry === null) continue;
    const { symbol, quantity, costUsd, boughtAt } = entry as Record<string, unknown>;
    if (
      typeof symbol === "string" &&
      isValidSymbol(symbol) &&
      typeof quantity === "number" &&
      quantity > 0 &&
      typeof costUsd === "number" &&
      costUsd >= 0 &&
      typeof boughtAt === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(boughtAt)
    ) {
      out.push({ symbol, quantity, costUsd, boughtAt });
    }
  }
  return out;
}

/** Aktarım tavanı — portföyün kendi tavanıyla aynı mertebe. */
const HANDOFF_MAX = 200;
