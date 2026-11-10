import type { DayMove, PositionView } from "@/lib/portfolio";
import { concentrationOf } from "@/lib/portfolio-risk";

/**
 * ANA SAYFANIN PORTFÖY PANELİ — SAF HESAP (10 Kasım gecesi; sınama
 * tests/portfolio-panel.test.ts).
 *
 * Panel /portfoy ile AYNI zincirin (`loadPortfolio`) sonucunu okur; burada
 * yalnız panelin sorduğu üç soru hesaplanır, yeni veri çağrısı yok:
 *  1. SEMBOL BAŞINA TEK SATIR. Aynı hisse farklı günlerde alınmışsa panel
 *     iki satır değil bir satır basar (soru "neyim var", "kaç alışım var"
 *     değil — halkanın kuralı, `allocationSlices`). Toplam K/Z yüzdesi
 *     birleşik maliyete göre, bugünkü değişim lotların toplamı.
 *  2. DAĞILIM ŞERİDİ: en büyük dört sembol + "Diğer"; "Diğer"in kimleri
 *     kapsadığı (`members`) ipucunda yazılır.
 *  3. KÜNYE: bugünü en çok kim taşıdı (yalnız seansı KANITLANAN kotasyondan;
 *     `dayMove` kanıtlanamayanı null bırakır) ve yoğunlaşma
 *     (`concentrationOf`, /portfoy/analiz'in aynı hesabı).
 */

/** Dağılım şeridinde adıyla duran sembol sayısı; kalanı "Diğer" (halkayla aynı). */
export const PANEL_SLICES = 4;
/** Yoğunlaşma künyesinin TABAN eşiği (yüzde): tek hisse portföyün dörtte
 *  birini aşınca bir haberin bütün portföyü oynattığı yer. /portfoy/analiz
 *  daha ayrıntılı okumayı (HHI) veriyor. */
export const CONCENTRATION_PCT = 25;
/** Eşit ağırlığın bu katı: üç eşit pozisyonda %37 doğaldır, uyarı değildir
 *  (sahte veride üç pozisyonlu portföy "ONDS %37" uyarısı basıyordu; 10
 *  Kasım ölçümü). Eşik = max(25, 1,5 × 100 / sembol sayısı): 2 → %75,
 *  3 → %50, 6 ve üstü → %25. */
const CONCENTRATION_FAIR_MULT = 1.5;

/** Yoğunlaşma eşiği — sembol sayısına göre (yukarıdaki iki sabit). */
export function concentrationThreshold(count: number): number {
  return Math.max(CONCENTRATION_PCT, (CONCENTRATION_FAIR_MULT * 100) / Math.max(1, count));
}
/** Bugünün "en çok etkileyeni" ancak en az bu kadar sembol kanıtlıysa anlamlı. */
const MOVER_MIN_COVERED = 2;

export type PanelHolding = {
  symbol: string;
  valueUsd: number;
  /** Portföydeki pay, yüzde. */
  weight: number;
  /** Alıştan bugüne dolar K/Z yüzdesi (birleşik maliyete göre). */
  pnlPct: number | null;
  /** Bu seansın dolar değişimi; kanıtlanamıyorsa null. */
  dayUsd: number | null;
  dayPct: number | null;
};

export type PanelSlice = { key: string; symbol: string | null; pct: number; members: string[] };

export type PanelModel = {
  holdings: PanelHolding[];
  slices: PanelSlice[];
  /** Bugün portföyü dolar olarak en çok oynatan sembol. */
  mover: { symbol: string; dayUsd: number; dayPct: number | null } | null;
  concentration: { symbol: string; weight: number; effective: number } | null;
  /** En az bir satırın bugünkü değişimi kanıtlı mı — değilse sütun hiç basılmaz. */
  hasDay: boolean;
};

export function panelModel(
  views: readonly PositionView[],
  days: ReadonlyMap<string, DayMove>,
): PanelModel {
  const bySymbol = new Map<string, { value: number; cost: number; dayUsd: number | null; dayPct: number | null; dayKnown: boolean }>();
  for (const view of views) {
    if (view.valueUsd === null || view.valueUsd <= 0) continue;
    const move = days.get(view.id) ?? { changeUsd: null, changePct: null };
    const entry = bySymbol.get(view.symbol) ?? { value: 0, cost: 0, dayUsd: 0, dayPct: null, dayKnown: true };
    entry.value += view.valueUsd;
    entry.cost += view.costTotalUsd;
    /* Aynı sembolün lotları aynı kotasyonu okur: biri kanıtsızsa hepsi. Yine
       de biri düşerse satırın günlük değişimi YOK sayılır, kısmi toplam
       "bugün" diye basılmaz. */
    if (move.changeUsd === null || !entry.dayKnown) {
      entry.dayKnown = false;
    } else {
      entry.dayUsd = (entry.dayUsd ?? 0) + move.changeUsd;
      entry.dayPct = move.changePct;
    }
    bySymbol.set(view.symbol, entry);
  }
  const total = [...bySymbol.values()].reduce((sum, entry) => sum + entry.value, 0);
  if (total <= 0) return { holdings: [], slices: [], mover: null, concentration: null, hasDay: false };

  const holdings: PanelHolding[] = [...bySymbol.entries()]
    .map(([symbol, entry]) => ({
      symbol,
      valueUsd: entry.value,
      weight: (entry.value / total) * 100,
      pnlPct: entry.cost > 0 ? ((entry.value - entry.cost) / entry.cost) * 100 : null,
      dayUsd: entry.dayKnown ? entry.dayUsd : null,
      dayPct: entry.dayKnown ? entry.dayPct : null,
    }))
    .sort((a, b) => b.valueUsd - a.valueUsd || a.symbol.localeCompare(b.symbol));

  const head = holdings.slice(0, PANEL_SLICES);
  const rest = holdings.slice(PANEL_SLICES);
  const slices: PanelSlice[] = head.map((h) => ({ key: h.symbol, symbol: h.symbol, pct: h.weight, members: [h.symbol] }));
  if (rest.length > 0) {
    slices.push({ key: "rest", symbol: null, pct: rest.reduce((sum, h) => sum + h.weight, 0), members: rest.map((h) => h.symbol) });
  }

  const proven = holdings.filter((h): h is PanelHolding & { dayUsd: number } => h.dayUsd !== null);
  const top = proven.length >= MOVER_MIN_COVERED
    ? proven.reduce((best, h) => (Math.abs(h.dayUsd) > Math.abs(best.dayUsd) ? h : best))
    : null;
  const mover = top && top.dayUsd !== 0 ? { symbol: top.symbol, dayUsd: top.dayUsd, dayPct: top.dayPct } : null;

  const c = concentrationOf(holdings.map((h) => ({ symbol: h.symbol, weight: h.weight / 100 })));
  const concentration =
    holdings.length >= 2 && c.largest.weight >= concentrationThreshold(holdings.length)
      ? { symbol: c.largest.symbol, weight: c.largest.weight, effective: c.effectiveCount }
      : null;

  return { holdings, slices, mover, concentration, hasDay: proven.length > 0 };
}
