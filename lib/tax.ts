/**
 * YURT DIŞI HİSSE VERGİSİ — kurallar ve hesap, SAF katman.
 *
 * `/vergi` hesaplayıcısının bütün aritmetiği burada; bileşen yalnızca girdiyi
 * toplayıp sonucu çiziyor. Ağsız, tarayıcısız sınanıyor (tests/tax.test.ts).
 *
 * VERGİ DANIŞMANLIĞI DEĞİL. Aşağıdaki her kural bir kaynağa bağlı ve
 * kaynağın ne kadar kesin olduğu yanında yazılı; kesin olmayan yerde
 * hesaplayıcı temkinli yolu seçip bunu ekranda söylüyor. Araştırma tarihi:
 * Eylül 2026.
 *
 * KAYNAKLAR
 *  [DKİ]  GİB, Diğer Kazanç ve İratlar Rehberi 2025
 *         intvrg.gib.gov.tr/hazirbeyan/assets/pdf/digerKazancIratlar2025.pdf
 *  [MSİ]  GİB, Menkul Sermaye İradı Rehberi (Şubat 2026, yayın no 584)
 *         intvrg.gib.gov.tr/hazirbeyan/assets/pdf/DUYURU_UNIVERSAL_2026_2026_menkulsermayeiradi.pdf
 *  [YKB]  Yapı Kredi, Yabancı Hisse Senedi Gelirlerinde (2026 Yılı) Vergi Durumu
 *         yapikredi.com.tr/medium/file/yabanci-hisse-senedi-gelirlerinde-2026-yili-vergi-durumu_71999/view
 *  [332]  332 Seri No. GVGT (RG 31.12.2025, 33124 5. mük.) — 2026 tarifesi
 *  [257]  257 Seri No. GVGT — ilk giren ilk çıkar
 *  [IRS]  irs.gov/instructions/i1042s — 1042-S teslim tarihi
 */

/* --------------------------------------------------------------------------
   Kurallar
   -------------------------------------------------------------------------- */

/**
 * Maliyet endekslemesinin eşiği: Yİ-ÜFE artışı %10 ya da üstü.
 *
 * GVK mük. 81 son fıkra: maliyet "elden çıkarıldığı ay hariç olmak üzere"
 * Yİ-ÜFE artışıyla endekslenir, artış "%10 veya üzerinde" olmalı [DKİ s.17].
 * HANGİ AYLAR: GİB'in Örnek 13'ü alış 15/11/2021, satış 23/9/2024 için
 * "iktisap tarihinden önceki ay olan Ekim 2021" ile "elden çıkarıldığı
 * aydan önceki ay olan Ağustos 2024" endekslerini kullanıyor [DKİ]. Yani
 * oran = Yİ-ÜFE(satıştan önceki ay) / Yİ-ÜFE(alıştan önceki ay).
 * Kesinlik: yüksek.
 */
export const INDEXATION_THRESHOLD = 0.1;

/**
 * ABD temettü stopajı.
 *
 * W-8BEN verilmişse Türkiye–ABD anlaşmasının 10. maddesi bireysel
 * yatırımcıda %20 ile sınırlıyor; %15 yalnızca şirketin en az %10'una sahip
 * bir KURUM için. W-8BEN yoksa ABD yasal oranı %30. Kesinlik: orta-yüksek
 * (anlaşma metni congress.gov Ex. Rept. 105-6'dan, özet kaynaklarla
 * doğrulandı). Hesaplayıcıda satır başına değiştirilebilir — aracı kurum
 * farklı bir oran kestiyse okuyucu ekstresindekini yazar.
 */
export const US_WITHHOLDING = { w8ben: 20, none: 30 } as const;

export type TaxBracket = {
  /** Dilimin üst sınırı (TL); son dilimde null. */
  upTo: number | null;
  /** Oran, yüzde. */
  ratePct: number;
};

export type TaxYearRules = {
  year: number;
  /** GVK 103, ÜCRET DIŞI gelirler tarifesi. */
  brackets: TaxBracket[];
  /**
   * Yurt dışı temettünün beyan sınırı: tevkif ve istisna kapsamına girmeyen
   * menkul ve gayrimenkul sermaye iratlarının TOPLAMI bu tutarı aşarsa
   * tamamı beyan edilir (GVK 86/1-c). Temettüye özgü değil, o gruptaki
   * bütün gelirlerin toplamı [MSİ s.8].
   */
  dividendThreshold: number;
  /** Beyanname ayı: izleyen yılın Mart'ı. */
  filingYear: number;
  /** Tarife ve sınırın kaynağı — ekranda sınırın yanında, dile göre. */
  source: { tr: string; en: string };
  /**
   * Tarife GİB'den otomatik okunduysa (bkz. `withFetchedTariffs`) ve o yılın
   * temettü sınırı henüz koda girmediyse: sınırı taşınan yıl. Ekran bunu
   * adıyla söylüyor; sınır zaten okuyucu tarafından değiştirilebilir.
   */
  thresholdCarriedFrom?: number;
};

/**
 * Vergi yılına göre kurallar. Kesinlik: yüksek.
 *   2025: tarife [MSİ s.21], temettü sınırı 18.000 TL [MSİ s.8]
 *   2026: tarife [332], temettü sınırı 22.000 TL [MSİ s.8, "2026 takvim
 *         yılı için 22.000 TL"]
 */
export const TAX_YEARS: Record<number, TaxYearRules> = {
  2025: {
    year: 2025,
    brackets: [
      { upTo: 158_000, ratePct: 15 },
      { upTo: 330_000, ratePct: 20 },
      { upTo: 800_000, ratePct: 27 },
      { upTo: 4_300_000, ratePct: 35 },
      { upTo: null, ratePct: 40 },
    ],
    dividendThreshold: 18_000,
    filingYear: 2026,
    source: {
      tr: "GİB Menkul Sermaye İradı Rehberi (Şubat 2026)",
      en: "Revenue Administration Capital Income Guide (February 2026)",
    },
  },
  2026: {
    year: 2026,
    brackets: [
      { upTo: 190_000, ratePct: 15 },
      { upTo: 400_000, ratePct: 20 },
      { upTo: 1_000_000, ratePct: 27 },
      { upTo: 5_300_000, ratePct: 35 },
      { upTo: null, ratePct: 40 },
    ],
    dividendThreshold: 22_000,
    filingYear: 2027,
    source: {
      tr: "332 Seri No. Gelir Vergisi Genel Tebliği; GİB Menkul Sermaye İradı Rehberi",
      en: "General Communiqué on Income Tax No. 332; Revenue Administration Capital Income Guide",
    },
  },
};

export const TAX_YEAR_LIST = Object.keys(TAX_YEARS)
  .map(Number)
  .sort((a, b) => b - a);

/**
 * Koddaki yıllar + GİB'den otomatik okunan yeni yıllar (28 Eylül).
 *
 * Yeni yılın tarifesi yayımlanınca günlük cron GİB portalından PDF'i okuyup
 * sağlamasını yapıyor ve saklıyor (lib/tax-tariff-sync.ts). KODDA OLAN YIL
 * EZİLMEZ: elle doğrulanmış kaynak kazanır, GİB'deki fark cron raporuna
 * düşer. Kodda olmayan yıl eklenir; temettü sınırı tarifeyle yayımlanmadığı
 * için (Menkul Sermaye İradı Rehberi'nde, aylar sonra çıkıyor) en yakın
 * önceki yılınki taşınıyor ve `thresholdCarriedFrom` ile işaretleniyor.
 */
export function withFetchedTariffs(
  base: Record<number, TaxYearRules>,
  fetched: readonly { year: number; brackets: TaxBracket[] }[],
): Record<number, TaxYearRules> {
  const merged: Record<number, TaxYearRules> = { ...base };
  for (const entry of [...fetched].sort((a, b) => a.year - b.year)) {
    if (merged[entry.year] || entry.brackets.length === 0) continue;
    const previous = Object.values(merged)
      .filter((rules) => rules.year < entry.year)
      .sort((a, b) => b.year - a.year)[0];
    if (!previous) continue;
    merged[entry.year] = {
      year: entry.year,
      brackets: entry.brackets,
      dividendThreshold: previous.dividendThreshold,
      thresholdCarriedFrom: previous.thresholdCarriedFrom ?? previous.year,
      filingYear: entry.year + 1,
      source: {
        tr: `GİB Gelir Vergisi Tarifesi ${entry.year} (otomatik okundu)`,
        en: `Revenue Administration Income Tax Tariff ${entry.year} (read automatically)`,
      },
    };
  }
  return merged;
}

/** Yıl listesi, yeniden eskiye. */
export function taxYearList(years: Record<number, TaxYearRules>): number[] {
  return Object.keys(years)
    .map(Number)
    .sort((a, b) => b - a);
}

/** Matrahın düştüğü dilimin sırası (0'dan). */
export function bracketIndexOf(base: number, brackets: readonly TaxBracket[]): number {
  const index = brackets.findIndex((bracket) => bracket.upTo === null || base <= bracket.upTo);
  return index === -1 ? brackets.length - 1 : index;
}

/** Tarife üzerinden vergi — yalnızca bu gelir varsa. */
export function progressiveTax(base: number, brackets: readonly TaxBracket[]): number {
  if (!(base > 0)) return 0;
  let tax = 0;
  let floor = 0;
  for (const bracket of brackets) {
    const ceiling = bracket.upTo ?? Infinity;
    if (base <= floor) break;
    const slice = Math.min(base, ceiling) - floor;
    tax += (slice * bracket.ratePct) / 100;
    floor = ceiling;
  }
  return tax;
}

/* --------------------------------------------------------------------------
   İşlemler ve ilk giren ilk çıkar eşleşmesi
   -------------------------------------------------------------------------- */

export type TradeSide = "buy" | "sell";

export type TradeInput = {
  id: string;
  side: TradeSide;
  symbol: string;
  /** "YYYY-MM-DD" */
  date: string;
  quantity: number;
  /** Hisse başı fiyat, dolar. */
  priceUsd: number;
  /** İşlemin toplam komisyonu, dolar. */
  commissionUsd: number;
};

export type MatchedLot = {
  sellId: string;
  buyId: string;
  symbol: string;
  buyDate: string;
  sellDate: string;
  quantity: number;
  /** Alış bedeli + alış komisyonunun bu parçaya düşen payı. */
  costUsd: number;
  /** Satış bedeli − satış komisyonunun bu parçaya düşen payı. */
  proceedsUsd: number;
};

export type Shortfall = { sellId: string; symbol: string; date: string; quantity: number };

/**
 * Satışları alışlarla İLK GİREN İLK ÇIKAR sırasıyla eşleştirir.
 *
 * NEDEN FIFO: 257 Seri No. GVGT "değişik tarihlerde alınan … bir kısmının
 * elden çıkarılması durumunda … ilk giren ilk çıkar yöntemi" diyor [257].
 * Tebliğ yurt içi stopaj matrahı için yazıldı; uygulamada yurt dışı hisseye
 * de kıyasla uygulanıyor. Yurt dışı hisse için FIFO'yu açıkça emreden bir
 * GİB metni bulunamadı. Kesinlik: orta — güvenli varsayılan bu.
 *
 * Komisyonlar adede göre bölünüyor: 100 adetlik bir alışın 30 adedi
 * satıldığında alış komisyonunun %30'u o parçanın maliyetine giriyor.
 * Komisyon kazancı azaltır [YKB].
 *
 * Aynı günde alış satıştan ÖNCE işleniyor: gün içinde alınıp satılan hisse
 * kendi alışıyla eşleşsin, eski bir parçayı tüketmesin.
 *
 * Satılan adet eldekinden fazlaysa eksik kalan kısım `shortfalls`a düşüyor
 * ve ekran onu söylüyor — uydurma bir maliyetle kazanç yazılmıyor.
 */
export function matchFifo(trades: readonly TradeInput[]): {
  lots: MatchedLot[];
  shortfalls: Shortfall[];
} {
  const valid = trades.filter(
    (trade) =>
      trade.symbol &&
      trade.date &&
      trade.quantity > 0 &&
      trade.priceUsd >= 0 &&
      trade.commissionUsd >= 0,
  );
  const ordered = valid
    .map((trade, index) => ({ trade, index }))
    .sort((a, b) => {
      if (a.trade.date !== b.trade.date) return a.trade.date < b.trade.date ? -1 : 1;
      if (a.trade.side !== b.trade.side) return a.trade.side === "buy" ? -1 : 1;
      return a.index - b.index;
    })
    .map((entry) => entry.trade);

  type OpenLot = { trade: TradeInput; remaining: number };
  const open = new Map<string, OpenLot[]>();
  const lots: MatchedLot[] = [];
  const shortfalls: Shortfall[] = [];

  for (const trade of ordered) {
    const key = trade.symbol.toUpperCase();
    const queue = open.get(key) ?? [];
    open.set(key, queue);
    if (trade.side === "buy") {
      queue.push({ trade, remaining: trade.quantity });
      continue;
    }
    let toSell = trade.quantity;
    while (toSell > 0 && queue.length > 0) {
      const head = queue[0];
      const take = Math.min(head.remaining, toSell);
      lots.push({
        sellId: trade.id,
        buyId: head.trade.id,
        symbol: key,
        buyDate: head.trade.date,
        sellDate: trade.date,
        quantity: take,
        costUsd:
          take * head.trade.priceUsd +
          (head.trade.commissionUsd * take) / head.trade.quantity,
        proceedsUsd:
          take * trade.priceUsd - (trade.commissionUsd * take) / trade.quantity,
      });
      head.remaining -= take;
      toSell -= take;
      if (head.remaining <= QUANTITY_EPSILON) queue.shift();
    }
    if (toSell > QUANTITY_EPSILON) {
      shortfalls.push({ sellId: trade.id, symbol: key, date: trade.date, quantity: toSell });
    }
  }
  return { lots, shortfalls };
}

/** Kesirli adetlerde kayan nokta artığı — 1e-9 hisse "kalan" sayılmıyor. */
const QUANTITY_EPSILON = 1e-9;

/* --------------------------------------------------------------------------
   TL hesabı
   -------------------------------------------------------------------------- */

export type LotResult = MatchedLot & {
  buyRate: number | null;
  sellRate: number | null;
  costTl: number | null;
  proceedsTl: number | null;
  /** Yİ-ÜFE oranı (satıştan önceki ay / alıştan önceki ay); endeks yoksa null. */
  indexRatio: number | null;
  /** Endeksleme uygulandı mı. */
  indexed: boolean;
  /** Vergiye esas maliyet (endeksli ya da değil). */
  taxCostTl: number | null;
  gainTl: number | null;
};

/** Kazanç hesabının iki endeks ayı — ekran bu ayları okuyucudan ister. */
export function indexMonthsFor(buyDate: string, sellDate: string): { buy: string; sell: string } {
  return {
    buy: shiftMonth(buyDate.slice(0, 7), -1),
    sell: shiftMonth(sellDate.slice(0, 7), -1),
  };
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const total = y * 12 + (m - 1) + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

/**
 * Bir eşleşmenin TL sonucu.
 *
 * Maliyet ALIŞ gününün, satış bedeli SATIŞ gününün TCMB döviz alış kuruyla
 * [DKİ s.17]. Kur farkı vergiye tabi: dolarda zarar eden satış TL'de
 * kazançlıysa vergilenir [YKB].
 *
 * ENDEKSLEME TEMKİNLİ UYGULANIYOR. Kanun "endekslenerek tespit edilebilir"
 * diyor ve endekslemenin bir zararı büyütüp büyütemeyeceği ya da kazancı
 * sıfırın altına itip itemeyeceği konusunda açık bir GİB metni bulunamadı.
 * Hesaplayıcı yalnızca endekslemeden önce KAZANÇLI olan satışta endeksliyor
 * ve kazancı en fazla sıfıra indiriyor. Ekran bunu künyesinde söylüyor.
 */
export function lotResult(
  lot: MatchedLot,
  buyRate: number | null,
  sellRate: number | null,
  indexBuy: number | null,
  indexSell: number | null,
): LotResult {
  const costTl = buyRate ? lot.costUsd * buyRate : null;
  const proceedsTl = sellRate ? lot.proceedsUsd * sellRate : null;
  const indexRatio = indexBuy && indexSell && indexBuy > 0 ? indexSell / indexBuy : null;
  let indexed = false;
  let taxCostTl = costTl;
  if (
    costTl !== null &&
    proceedsTl !== null &&
    indexRatio !== null &&
    indexRatio - 1 >= INDEXATION_THRESHOLD &&
    proceedsTl > costTl
  ) {
    indexed = true;
    taxCostTl = Math.min(costTl * indexRatio, proceedsTl);
  }
  const gainTl = taxCostTl !== null && proceedsTl !== null ? proceedsTl - taxCostTl : null;
  return {
    ...lot,
    buyRate,
    sellRate,
    costTl,
    proceedsTl,
    indexRatio,
    indexed,
    taxCostTl,
    gainTl,
  };
}

/**
 * Yılın toplamı. Menkul kıymet kazanç ve zararları aynı yıl içinde
 * birbirinden mahsup edilebiliyor, başka gelir türünden edilemiyor (GVK 88;
 * DKİ örneği 160.000 − 65.000). GVK mük. 80'deki yıllık istisna (2026:
 * 150.000 TL) menkul kıymet satışına UYGULANMIYOR [DKİ] — yani tutar ne
 * olursa olsun net kazanç beyan ediliyor.
 */
export function yearTotals(results: readonly LotResult[]): {
  proceedsTl: number;
  costTl: number;
  gainTl: number;
  complete: boolean;
} {
  let proceedsTl = 0;
  let costTl = 0;
  let gainTl = 0;
  let complete = true;
  for (const lot of results) {
    if (lot.proceedsTl === null || lot.taxCostTl === null || lot.gainTl === null) {
      complete = false;
      continue;
    }
    proceedsTl += lot.proceedsTl;
    costTl += lot.taxCostTl;
    gainTl += lot.gainTl;
  }
  return { proceedsTl, costTl, gainTl, complete };
}

/* --------------------------------------------------------------------------
   Temettü
   -------------------------------------------------------------------------- */

export type DividendInput = {
  id: string;
  symbol: string;
  date: string;
  grossUsd: number;
  withholdingPct: number;
};

export type DividendResult = DividendInput & {
  rate: number | null;
  grossTl: number | null;
  withheldTl: number | null;
};

/**
 * Temettü brüt tutarıyla beyan ediliyor ve ödeme gününün TCMB döviz alış
 * kuruyla liraya çevriliyor [MSİ]. Portföy yatırımcısı için %50 istisnası
 * YOK: GVK 22/4 yurt dışı iştirak kazancında sermayenin en az %20'sine
 * (2026'dan önce %50) sahip olmayı istiyor [MSİ s.15; CBK 11257].
 * ABD'de kesilen vergi GVK 123 ile Türkiye'de hesaplanan vergiden, o gelire
 * düşen kısımla sınırlı olarak mahsup ediliyor; fazlası dikkate alınmıyor.
 */
export function dividendResult(input: DividendInput, rate: number | null): DividendResult {
  const grossTl = rate ? input.grossUsd * rate : null;
  const withheldTl = grossTl === null ? null : (grossTl * input.withholdingPct) / 100;
  return { ...input, rate, grossTl, withheldTl };
}

/* --------------------------------------------------------------------------
   CSV
   -------------------------------------------------------------------------- */

/**
 * Tarayıcıdan indirilen döküm. TR'de noktalı virgül ve virgüllü ondalık:
 * Türkçe Excel virgülü ondalık sayıyor ve virgülle ayrılmış bir dosyayı tek
 * sütuna yığıyordu. EN'de standart virgül ve nokta. Hücrede ayraç ya da
 * tırnak varsa hücre tırnaklanıyor.
 */
export function toCsv(rows: readonly (readonly (string | number | null)[])[], locale: string): string {
  const sep = locale === "tr" ? ";" : ",";
  const cell = (value: string | number | null): string => {
    if (value === null) return "";
    const text =
      typeof value === "number"
        ? locale === "tr"
          ? String(Math.round(value * CSV_PRECISION) / CSV_PRECISION).replace(".", ",")
          : String(Math.round(value * CSV_PRECISION) / CSV_PRECISION)
        : value;
    return text.includes(sep) || /["\n\r]/.test(text)
      ? `"${text.replace(/"/g, '""')}"`
      : text;
  };
  /* Excel'in UTF-8'i tanıması için baştaki BOM; yoksa "ş" "ÅŸ" oluyor. */
  return `﻿${rows.map((row) => row.map(cell).join(sep)).join("\r\n")}`;
}

/** CSV'de dört ondalık: kur dört basamak yayımlanıyor, tutarlar iki. */
const CSV_PRECISION = 10_000;
