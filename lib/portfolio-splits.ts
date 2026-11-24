/**
 * HİSSE BÖLÜNMESİNDE PORTFÖY DÜZELTMESİ (24 Kasım, sahibinin isteği:
 * "split düzeltmesini de yapalım").
 *
 * SanDisk 20 Kasım'da 8'e 1 bölündü; portföydeki SNDK partileri bölünme
 * öncesi adet ve maliyetle kaldı (14,84 adet × 1.406 $). Fiyat artık 76 $,
 * ekran −%94,5 zarar gösteriyordu. Kurum adedi 8 ile çarpıp maliyeti 8'e
 * bölüyor; burada aynısı: toplam maliyet (adet × maliyet) DEĞİŞMEZ.
 *
 * HANGİ PARTİ DÜZELTİLİR — iki şart birden:
 * 1. Alış bölünmeden ÖNCE (`boughtAt < exDate`): sonra alınan hisse zaten
 *    yeni fiyattan.
 * 2. Parti bölünmeden önce GİRİLMİŞ ya da en son o tarihten önce
 *    düzeltilmiş (`baseline < exDate`). Baseline, satırın yaratıldığı ET
 *    günü ile işaret defterindeki (`portfolio_split_marks.through`) günün
 *    geç olanı. Bölünmeden SONRA girilen eski tarihli parti çoğunlukla
 *    kurumun bugünkü (bölünmüş) rakamlarıyla girilir; onu yeniden bölmek
 *    adedi ikinci kez çarpardı. Elle düzeltilen ya da formdan güncellenen
 *    parti de işaretlenir (app/actions/portfolio.ts → `updatePosition`).
 *    Bölünme günü girilen parti de bölünmüş sayılır: belirsizlikte ikinci
 *    kez çarpmaktansa dokunmamak doğru (geri dönüşü var, okur düzeltir).
 *
 * NE ZAMAN — bölünme hak kesim (ex) günü AÇILIŞTA geçerli. Açılıştan önce
 * kotasyon hâlâ dünkü (bölünmemiş) kapanış; adet erken çarpılırsa portföy
 * birkaç saat 8 katı görünür. `effectiveSplits` ex günü yalnız 09:30 ET'den
 * sonra sayar.
 *
 * SAF MODÜL: veri ve yazma lib/portfolio-split-apply.ts'te; testler
 * tests/portfolio-splits.test.ts.
 */

export type StockSplit = {
  symbol: string;
  /** Hak kesim günü, ET "YYYY-MM-DD". */
  exDate: string;
  /** Yeni adet / eski adet: 8'e 1 bölünmede 8, 50'de 1 birleşmede 0,02. */
  ratio: number;
};

export type SplitLot = {
  id: string;
  symbol: string;
  /** numeric sütunların metni ("14.83593213"). */
  quantity: string;
  costUsd: string;
  /** ET "YYYY-MM-DD". */
  boughtAt: string;
  /** Satırın yaratıldığı ET günü. */
  createdDate: string;
  /** İşaret defterindeki gün; yoksa null. */
  through: string | null;
};

export type SplitAdjustment = {
  id: string;
  symbol: string;
  /** Yazmadan önceki değerler — yazma koşulu (eşzamanlı satış/düzeltme ezilmesin). */
  fromQuantity: string;
  fromCostUsd: string;
  quantity: string;
  costUsd: string;
  /** Uygulanan bölünmeler, eskiden yeniye. */
  applied: StockSplit[];
  /** Defterin yeni günü: uygulanan son bölünmenin ex günü. */
  through: string;
};

/** Sütunların ölçeği (lib/schema.ts → portfolioPositions). */
const QUANTITY_SCALE = 8;
const COST_SCALE = 6;
/** 09:30 ET, dakika. */
const OPEN_MINUTES = 570;

/** Bugün geçerli olmuş bölünmeler: ex günü geçmiş, ya da bugün ve seans açılmış. */
export function effectiveSplits(splits: readonly StockSplit[], todayEt: string, etMinutes: number): StockSplit[] {
  return splits.filter(
    (split) =>
      Number.isFinite(split.ratio) &&
      split.ratio > 0 &&
      split.ratio !== 1 &&
      (split.exDate < todayEt || (split.exDate === todayEt && etMinutes >= OPEN_MINUTES)),
  );
}

/** Partilere düşen düzeltmeler. Bölünmeler önceden `effectiveSplits`ten geçmiş olmalı. */
export function splitAdjustments(lots: readonly SplitLot[], splits: readonly StockSplit[]): SplitAdjustment[] {
  const bySymbol = new Map<string, StockSplit[]>();
  for (const split of splits) bySymbol.set(split.symbol, [...(bySymbol.get(split.symbol) ?? []), split]);
  const out: SplitAdjustment[] = [];
  for (const lot of lots) {
    const baseline = lot.through && lot.through > lot.createdDate ? lot.through : lot.createdDate;
    /* Aynı gün iki kayıt (sağlayıcı düzeltmesi) tek bölünme sayılır. */
    const seen = new Set<string>();
    const due = (bySymbol.get(lot.symbol) ?? [])
      .filter((split) => split.exDate > lot.boughtAt && split.exDate > baseline)
      .sort((a, b) => (a.exDate < b.exDate ? -1 : a.exDate > b.exDate ? 1 : 0))
      .filter((split) => (seen.has(split.exDate) ? false : (seen.add(split.exDate), true)));
    if (due.length === 0) continue;
    const ratio = due.reduce((product, split) => product * split.ratio, 1);
    const quantity = Number(lot.quantity) * ratio;
    const cost = Number(lot.costUsd) / ratio;
    const quantityText = quantity.toFixed(QUANTITY_SCALE);
    /* Birleşmede (reverse split) kırıntı adet sıfıra yuvarlanabilir; adet
       pozitif kısıtı (0046) yazmayı düşürür. Kırıntıya dokunulmaz. */
    if (!(Number(quantityText) > 0) || !Number.isFinite(cost)) continue;
    out.push({
      id: lot.id,
      symbol: lot.symbol,
      fromQuantity: lot.quantity,
      fromCostUsd: lot.costUsd,
      quantity: quantityText,
      costUsd: cost.toFixed(COST_SCALE),
      applied: due,
      through: due[due.length - 1]!.exDate,
    });
  }
  return out;
}
