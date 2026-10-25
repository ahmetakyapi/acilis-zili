import { commissionFor, SCENARIO_SHARE_PRICE, type Broker } from "@/content/brokers";

/**
 * "ALIMINA GÖRE KOMİSYON" PANOSU — saf hesap (25 Ekim, kurum logoları turu).
 * Test `tests/broker-board.test.ts`; çizim `components/brokers/BrokerBoard.tsx`.
 *
 * Sahibinin itirazı: tam genişlikte tek bir çizgi listesi "bu kadar yatayda
 * uzun olmasına gerek yok, 3 tane karta bölüp farklı bilgiler gösterebiliriz".
 * Pano üç soruya bölündü; üçü de aynı tarife hesabından (`commissionFor`)
 * geçiyor, aynı sayı iki kartta aynı kaynaktan (CLAUDE.md veri dürüstlüğü 3):
 *
 *   1. Bu tutarda en ucuz: `costLine` (lib/broker-line.ts), değişmedi.
 *   2. Tutar büyüdükçe: her kurumun 100 $ – 50.000 $ boyunca komisyon eğrisi
 *      (`feeCurves`) ve en düşük komisyonun hangi tutarda kimde olduğu
 *      (`leaderSegments`). Eşitlik bir kazanan seçilerek bozulmuyor: aynı
 *      ücreti alan kurumlar aynı dilimi paylaşıyor.
 *   3. Yıllık maliyet: ayda N alım yapan biri için bir yılın komisyonu ve
 *      saklaması (`yearlyCosts`). Saklaması bilinmeyen kurumda saklama SIFIR
 *      sayılmıyor, "belirtilmemiş" diye ayrı işaretleniyor.
 */

/** Eğri aralığı, dolar — kaydırıcının uçlarıyla aynı (LINE_STEPS_USD). */
export const CURVE_RANGE = [100, 50_000] as const;
/** Eğri başına nokta: tarifeler parça parça doğrusal, log eksende 97 nokta kırılmaları yumuşak gösteriyor. */
export const CURVE_POINTS = 97;

/** Sent altı farkı eşitlik say — tarife sentten küçük birim yazmıyor (broker-line ile aynı). */
const CENT = 0.005;

export function logGrid(lo: number, hi: number, n: number): number[] {
  if (n < 2) return [lo];
  const a = Math.log(lo);
  const b = Math.log(hi);
  return Array.from({ length: n }, (_, i) => Math.exp(a + ((b - a) * i) / (n - 1)));
}

export type FeeCurve = { id: string; name: string; points: { amount: number; fee: number }[] };

/** Tarifesinden tek komisyon çıkan her kurumun eğrisi; çıkmayan kurum eğriye girmez. */
export function feeCurves(
  brokers: readonly Broker[],
  amounts: readonly number[],
  sharePriceUsd: number = SCENARIO_SHARE_PRICE,
): FeeCurve[] {
  const out: FeeCurve[] = [];
  for (const broker of brokers) {
    if (broker.commission.kind === "none") continue;
    const points: FeeCurve["points"] = [];
    for (const amount of amounts) {
      const fee = commissionFor(broker.commission, amount, sharePriceUsd);
      if (fee !== null) points.push({ amount, fee });
    }
    out.push({ id: broker.id, name: broker.name, points });
  }
  return out;
}

/* ------------------------------------------------------------ en ucuz dilimleri */

export type LeaderSegment = { from: number; to: number; ids: string[] };

function leadersAt(brokers: readonly Broker[], amount: number, sharePriceUsd: number): string[] {
  let min = Infinity;
  const fees: [string, number][] = [];
  for (const broker of brokers) {
    const fee = commissionFor(broker.commission, amount, sharePriceUsd);
    if (fee === null) continue;
    fees.push([broker.id, fee]);
    if (fee < min) min = fee;
  }
  return fees.filter(([, fee]) => fee - min < CENT).map(([id]) => id);
}

const sameSet = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((id) => b.includes(id));

/**
 * En düşük komisyonun aralık boyunca kimde olduğu, dilim dilim. Izgaranın
 * iki noktası arasında lider kümesi değişiyorsa sınır ikiye bölmeyle sent
 * hassasiyetine kadar daraltılıyor (Garanti'nin binde 3'ü 333,33 $'da 1 $'a
 * değiyor; ızgara adımı onu 20 dolar ıskalardı). Tek noktalık eşitlik
 * (30.000 $'da Midas ile IBKR'ın aynı 1,50 $'ı) ayrı dilim açmıyor.
 */
export function leaderSegments(
  brokers: readonly Broker[],
  lo: number = CURVE_RANGE[0],
  hi: number = CURVE_RANGE[1],
  sharePriceUsd: number = SCENARIO_SHARE_PRICE,
  steps = 400,
): LeaderSegment[] {
  const grid = logGrid(lo, hi, steps);
  const segments: LeaderSegment[] = [];
  let prev = leadersAt(brokers, grid[0], sharePriceUsd);
  if (prev.length === 0) return [];
  let start = grid[0];
  for (let i = 1; i < grid.length; i++) {
    const cur = leadersAt(brokers, grid[i], sharePriceUsd);
    if (sameSet(cur, prev)) continue;
    /* Sınırı daralt: [a, b] arasında küme `prev`ten çıkıyor. */
    let a = grid[i - 1];
    let b = grid[i];
    while (b - a > 0.01) {
      const mid = (a + b) / 2;
      if (sameSet(leadersAt(brokers, mid, sharePriceUsd), prev)) a = mid;
      else b = mid;
    }
    segments.push({ from: start, to: a, ids: prev });
    start = a;
    prev = cur;
  }
  segments.push({ from: start, to: grid[grid.length - 1], ids: prev });
  return mergeSlivers(segments, lo, hi);
}

/** Log ekseninde aralığın binde 15'inden dar dilim: kuruş yuvarlamasının izi, okunacak bir bilgi değil. */
const SLIVER = 0.015;

/**
 * KURUŞ İZİNİ AYIKLA. Tarife sentten küçük birim yazmıyor ve hesap sente
 * yuvarlıyor; bu yüzden iki kurumun ücreti bir eşiğin çevresinde birkaç
 * dolarlık aralıkta "eşit" görünüyor (331–335 $'da dört kurum birden,
 * 29.900–30.100 $'da Midas ile IBKR). Bu ince dilimler kaldırılıyor ve
 * komşu dilimler ortasında buluşuyor: şeritte görünmeyecek kadar dar bir
 * parça cümlede bir sınır gibi okunmasın.
 */
function mergeSlivers(segments: LeaderSegment[], lo: number, hi: number): LeaderSegment[] {
  const span = Math.log(hi) - Math.log(lo);
  const wide = (seg: LeaderSegment) => (Math.log(seg.to) - Math.log(seg.from)) / span >= SLIVER;
  const out: LeaderSegment[] = [];
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (wide(seg) || segments.length === 1) {
      out.push({ ...seg });
      continue;
    }
    const mid = Math.sqrt(seg.from * seg.to);
    const prev = out[out.length - 1];
    if (prev) prev.to = mid;
    const next = segments[i + 1];
    if (next) segments[i + 1] = { ...next, from: prev ? mid : seg.from };
  }
  /* Kaldırılan dilimin iki yanı aynı kümedeyse birleştir. */
  const merged: LeaderSegment[] = [];
  for (const seg of out) {
    const prev = merged[merged.length - 1];
    if (prev && sameSet(prev.ids, seg.ids)) prev.to = seg.to;
    else merged.push(seg);
  }
  return merged;
}

export type CrossTemplates = {
  /** {lo} {hi} {first} — aralık boyunca tek lider kümesi. */
  same: string;
  /** {to} {first} {from} {last} */
  change: string;
};

/**
 * Eğrilerin TEK CÜMLESİ: aralığın başındaki ve sonundaki en ucuz. Aradaki
 * dilimler grafiğin altındaki şeritte; cümle onları saymaya kalkmıyor
 * (beş dilimli bir liste cümle değil, tablo olurdu).
 */
export function crossSentence(
  segments: readonly LeaderSegment[],
  names: (ids: readonly string[]) => string,
  money: (value: number) => string,
  templates: CrossTemplates,
): string | null {
  if (segments.length === 0) return null;
  const first = segments[0];
  const last = segments[segments.length - 1];
  if (segments.length === 1) {
    return templates.same
      .replace("{lo}", money(first.from))
      .replace("{hi}", money(first.to))
      .replace("{first}", names(first.ids));
  }
  return templates.change
    .replace("{to}", money(first.to))
    .replace("{first}", names(first.ids))
    .replace("{from}", money(last.from))
    .replace("{last}", names(last.ids));
}

/* ------------------------------------------------------------ yıllık maliyet */

export const YEARLY_FREQUENCIES = [1, 4, 10] as const;
export type YearlyFrequency = (typeof YEARLY_FREQUENCIES)[number];
export const MONTHS = 12;

/**
 * Yılın 12 ay sonu bakiyesinin toplamı, tek alımın katı olarak:
 * her ay başında alım, fiyat sabit → m. ayın sonunda bakiye m × (N × tutar);
 * 1 + 2 + … + 12 = 78.
 */
const BALANCE_MONTHS = (MONTHS * (MONTHS + 1)) / 2;

export type YearlyEntry = {
  id: string;
  name: string;
  /** Yılın işlem komisyonu, dolar. */
  commission: number;
  /** Yılın saklaması, dolar; kaynakta yoksa ya da avro asgarisi yüzünden dolarla bilinemiyorsa null. */
  custody: number | null;
  /** Kaynak saklamanın olmadığını açıkça yazıyor. */
  custodyFree: boolean;
  /**
   * Avro cinsinden aylık asgari saklama. Varsa saklama null: oran bu
   * bakiyelerde asgarinin çok altında kalıyor (1.000 $ × 12 alımda yılda
   * 3,90 $ ile 72 €) ve sayfa kur varsaymıyor; ekran "en az 72 €" yazıyor.
   */
  custodyFloorEurMonth: number | null;
  /** Bilinen kısım: komisyon + (biliniyorsa) saklama. */
  total: number;
  rank: number;
};

const round2 = (value: number) => Math.round(value * 100) / 100;

/**
 * Seçili tutarda ayda `perMonth` alım yapan biri için bir yılın maliyeti.
 * Saklama ay sonu bakiyesinden: yıllık oran ayda on ikide biri, aylık oran
 * olduğu gibi. Sıra BİLİNEN toplama göre; eşitlikte veri sırası. Sıra bir
 * öneri değil (BrokerNotes → tarafsızlık).
 */
export function yearlyCosts(
  brokers: readonly Broker[],
  amount: number,
  perMonth: number,
  sharePriceUsd: number = SCENARIO_SHARE_PRICE,
): YearlyEntry[] {
  const rows: Omit<YearlyEntry, "rank">[] = [];
  for (const broker of brokers) {
    const fee = commissionFor(broker.commission, amount, sharePriceUsd);
    if (fee === null) continue;
    const commission = round2(fee * perMonth * MONTHS);
    const balanceSum = amount * perMonth * BALANCE_MONTHS;
    const model = broker.custodyModel;
    let custody: number | null = null;
    if (model.kind === "free") custody = 0;
    else if (model.kind === "pctYear" && model.floorEurMonth === undefined) {
      custody = round2((balanceSum * model.pct) / 100 / MONTHS);
    }
    else if (model.kind === "pctMonth") custody = round2((balanceSum * model.pct) / 100);
    rows.push({
      id: broker.id,
      name: broker.name,
      commission,
      custody,
      custodyFree: model.kind === "free",
      custodyFloorEurMonth: model.kind === "pctYear" ? (model.floorEurMonth ?? null) : null,
      total: round2(commission + (custody ?? 0)),
    });
  }
  const sorted = rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => a.row.total - b.row.total || a.index - b.index)
    .map(({ row }) => row);
  const out: YearlyEntry[] = [];
  sorted.forEach((row, i) => {
    const prev = out[i - 1];
    out.push({ ...row, rank: prev && Math.abs(prev.total - row.total) < CENT ? prev.rank : i + 1 });
  });
  return out;
}

/* ------------------------------------------------------------ uç etiketleri */

/**
 * Eğrilerin sağ ucundaki logolar üst üste binmesin: hedef y'ler sıralanıp
 * en az `gap` aralıkla aşağı itiliyor, alt sınırı aşan küme yukarı
 * kaydırılıyor. Sıra korunuyor (etiket kendi çizgisinin hizasından en az
 * sapmayla). Dönen dizi girişin sırasıyla.
 */
export function dodgeLabels(targets: readonly number[], gap: number, min: number, max: number): number[] {
  const order = targets.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y);
  const placed = order.map(({ y }) => Math.min(Math.max(y, min), max));
  for (let k = 1; k < placed.length; k++) placed[k] = Math.max(placed[k], placed[k - 1] + gap);
  const last = placed.length - 1;
  if (last >= 0 && placed[last] > max) {
    placed[last] = max;
    for (let k = last - 1; k >= 0; k--) placed[k] = Math.min(placed[k], placed[k + 1] - gap);
  }
  const out = new Array<number>(targets.length);
  order.forEach(({ i }, k) => {
    out[i] = placed[k];
  });
  return out;
}
