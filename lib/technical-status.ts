/**
 * Ana sayfa teknik panelinde hissenin "BUGÜNKÜ DURUMU" (24 Kasım, sahibinin
 * isteği: "bugünkü durumları falan yazmak gibi, biraz eksik hissettiriyor").
 * Panel yalnız logo + sembol taşıyordu; okur hangi hissenin planın neresinde
 * olduğunu görmek için tek tek analize girmek zorundaydı.
 *
 * Tek satırlık künye, ÖNEM SIRASIYLA ilk tutan:
 *   1. Fiyat alım bölgesinin içinde → "Alım Bölgesinde".
 *   2. Fiyat stopun altında ya da üstünde ama ona `NEAR_PCT` kadar yakın →
 *      "Stopun Altında" / "Stopa %2,1". Stop, planın en acil bilgisi.
 *   3. RSI uçta (≥ 70 / ≤ 30) → "Aşırı Alım · RSI 74".
 *   4. Aksi hâlde en yakın seviye (üstteki direnç ya da alttaki destek):
 *      "Dirence %1,2" / "Desteğe %3,4"; %0,05'ten yakınsa "Dirençte" /
 *      "Destekte" (ilk ölçümde "Desteğe %0,0" yazıyordu).
 * Hepsi YAYININ kendi fotoğrafından (`snapshot.price`, `rsi14`) ve planın
 * seviyelerinden; yeni veri yok. Fiyat yoksa (yayın `data_ok: false`) künye
 * yok. Uzaklık seviyenin fiyata göre yüzdesi, tek ondalık.
 *
 * Saf modül; testler tests/technical-status.test.ts.
 */

export type TechnicalStatusInput = {
  price: number | null;
  entryLow: number | null;
  entryHigh: number | null;
  stop: number | null;
  supports: readonly number[];
  resistances: readonly number[];
  rsi: number | null;
};

export type TechnicalStatus =
  | { kind: "zone" }
  | { kind: "stopBroken" }
  | { kind: "stop"; pct: number }
  | { kind: "overbought"; rsi: number }
  | { kind: "oversold"; rsi: number }
  | { kind: "resistance"; pct: number }
  | { kind: "support"; pct: number }
  | { kind: "atResistance" }
  | { kind: "atSupport" };

/** Stopa "yakın" sayılan uzaklık, fiyatın yüzdesi. */
export const NEAR_PCT = 3;
const RSI_HIGH = 70;
const RSI_LOW = 30;
/** Bu kadar yakın seviye "üstünde" sayılır: tek ondalıkta "%0,0" yazmasın. */
const AT_LEVEL_PCT = 0.05;

const valid = (value: number | null | undefined): value is number => typeof value === "number" && Number.isFinite(value) && value > 0;

export function technicalStatus(input: TechnicalStatusInput): TechnicalStatus | null {
  const { price } = input;
  if (!valid(price)) return null;
  const distance = (level: number) => (Math.abs(level - price) / price) * 100;
  if (valid(input.entryLow) && valid(input.entryHigh) && price >= Math.min(input.entryLow, input.entryHigh) && price <= Math.max(input.entryLow, input.entryHigh)) {
    return { kind: "zone" };
  }
  if (valid(input.stop)) {
    if (price <= input.stop) return { kind: "stopBroken" };
    if (distance(input.stop) <= NEAR_PCT) return { kind: "stop", pct: distance(input.stop) };
  }
  if (typeof input.rsi === "number" && Number.isFinite(input.rsi)) {
    if (input.rsi >= RSI_HIGH) return { kind: "overbought", rsi: input.rsi };
    if (input.rsi <= RSI_LOW) return { kind: "oversold", rsi: input.rsi };
  }
  const above = input.resistances.filter((level) => valid(level) && level > price);
  const below = input.supports.filter((level) => valid(level) && level < price);
  const resistance = above.length ? Math.min(...above) : null;
  const support = below.length ? Math.max(...below) : null;
  if (resistance === null && support === null) return null;
  if (support === null || (resistance !== null && distance(resistance) <= distance(support))) {
    const pct = distance(resistance!);
    return pct < AT_LEVEL_PCT ? { kind: "atResistance" } : { kind: "resistance", pct };
  }
  const pct = distance(support);
  return pct < AT_LEVEL_PCT ? { kind: "atSupport" } : { kind: "support", pct };
}

export type TechnicalStatusCopy = {
  zone: string;
  stopBroken: string;
  stop: string;
  overbought: string;
  oversold: string;
  resistance: string;
  support: string;
  atResistance: string;
  atSupport: string;
};

/** Künye metni; `{pct}` okurun dilinde biçimli yüzde, `{rsi}` tam sayı. */
export function technicalStatusText(status: TechnicalStatus, copy: TechnicalStatusCopy, formatPct: (abs: number) => string): string {
  switch (status.kind) {
    case "zone":
    case "stopBroken":
    case "atResistance":
    case "atSupport":
      return copy[status.kind];
    case "stop":
    case "resistance":
    case "support":
      return copy[status.kind].replace("{pct}", formatPct(status.pct));
    case "overbought":
    case "oversold":
      return copy[status.kind].replace("{rsi}", String(Math.round(status.rsi)));
  }
}
