/**
 * İçeriden işlemler — SEC Form 4 kayıtlarının saf hesapları.
 *
 * Veri Finnhub'ın `/stock/insider-transactions` ucundan geliyor ve her satır
 * bir Form 4 SATIRI: aynı yöneticinin aynı gün on üç parçada gerçekleşen
 * satışı on üç satır olarak düşüyor (ölçüldü: NVDA'da 21 Eylül'de tek
 * kişinin üç satırı, aynı dosya numarası). Ekran okuyucuya parça değil İŞLEM
 * göstermeli; birleştirme burada ve testli.
 *
 * AÇIK PİYASA AYRIMI ASIL BİLGİ. Form 4'teki her hareket bir alım satım
 * kararı değil: hisse ödülü (A), vergi için tutulan pay (F), hediye (G),
 * opsiyon kullanımı (M) ortak birer "işlem" gibi listelenince bir yöneticinin
 * maaşının parçası olan pay, piyasadan kendi parasıyla aldığı payla aynı
 * satırda okunuyordu. Yalnızca P (açık piyasadan alım) ve S (açık piyasaya
 * satış) yöneticinin piyasadaki tercihini anlatıyor; özet yalnızca onları
 * sayıyor, ötekiler satır olarak kalıyor ama kodunun adıyla.
 */

/** Form 4 işlem kodları — SEC'in kendi tablosundan, kısaltmasıyla. */
export const INSIDER_CODES = [
  "P", "S", "A", "D", "F", "M", "X", "C", "G", "J", "K", "I", "W", "V", "E", "H", "O", "U", "L", "Z",
] as const;

export type InsiderCode = (typeof INSIDER_CODES)[number];

export function isInsiderCode(value: string): value is InsiderCode {
  return (INSIDER_CODES as readonly string[]).includes(value);
}

/** Açık piyasa işlemi mi — yöneticinin kendi parasıyla aldığı ya da sattığı. */
export function isOpenMarket(code: string): code is "P" | "S" {
  return code === "P" || code === "S";
}

/** Sağlayıcının ham satırı — yalnızca kullanılan alanlar. */
export type RawInsiderRow = {
  name: string;
  /** İşlemden sonra elde kalan pay. */
  share: number | null;
  /** İşaretli pay değişimi: satışta eksi. */
  change: number | null;
  filingDate: string | null;
  transactionDate: string | null;
  transactionCode: string | null;
  transactionPrice: number | null;
  /** Dosya numarası — aynı Form 4'ün satırları bunu paylaşıyor. */
  id: string | null;
  isDerivative: boolean | null;
};

export type InsiderTrade = {
  key: string;
  name: string;
  /** İşlem günü (YYYY-MM-DD, dosyadaki tarih). */
  date: string;
  code: string;
  /** Türev menkul (opsiyon) satırı mı — pay değil sözleşme hareketi. */
  derivative: boolean;
  /** İşaretli toplam pay değişimi. */
  shares: number;
  /**
   * Hacim ağırlıklı ortalama fiyat. Fiyatı SIFIR olan satırlar (ödül,
   * hediye) fiyatsız sayılıyor: sıfır dolarlık bir "işlem fiyatı" okuyucuya
   * bedava satılmış bir pay gibi görünürdü.
   */
  price: number | null;
  /** Mutlak tutar; fiyat yoksa null. */
  value: number | null;
  /** Kaç Form 4 satırı birleşti. */
  parts: number;
  /** Form 4'ün dosya numarası (accession) — kişinin görevi bu dosyadan okunuyor. */
  filing: string | null;
  /** Fiyat hisse fiyatıyla tutmadığı için düşürüldü (`sanitizeTradePrices`). */
  priceDropped?: boolean;
};

/**
 * Satırları işleme çevirir: aynı dosya, aynı kişi, aynı gün, aynı kod ve
 * aynı menkul türü tek işlemdir. Sıra yeniden eskiye (gün, sonra isim).
 */
export function groupInsiderRows(rows: readonly RawInsiderRow[]): InsiderTrade[] {
  const groups = new Map<
    string,
    {
      name: string;
      filing: string | null;
      date: string;
      code: string;
      derivative: boolean;
      shares: number;
      pricedShares: number;
      pricedValue: number;
      parts: number;
    }
  >();
  for (const row of rows) {
    const date = row.transactionDate ?? row.filingDate;
    const code = (row.transactionCode ?? "").trim().toUpperCase();
    if (!date || !code || row.change === null || row.change === 0) continue;
    const derivative = row.isDerivative === true;
    const key = [row.id ?? "", row.name, date, code, derivative ? "d" : "s"].join("|");
    const held = groups.get(key) ?? {
      name: row.name,
      filing: row.id,
      date,
      code,
      derivative,
      shares: 0,
      pricedShares: 0,
      pricedValue: 0,
      parts: 0,
    };
    held.shares += row.change;
    held.parts += 1;
    if (row.transactionPrice !== null && row.transactionPrice > 0) {
      held.pricedShares += Math.abs(row.change);
      held.pricedValue += Math.abs(row.change) * row.transactionPrice;
    }
    groups.set(key, held);
  }
  return [...groups.entries()]
    .map(([key, g]) => {
      /* Fiyat yalnızca payların TAMAMI fiyatlıysa: yarısı ödül yarısı satış
         olan bir grup (aynı kod altında pek görülmez ama mümkün) ortalamayı
         fiyatlı yarıdan kurup tutarı bütüne uygulardı. */
      const fullyPriced = g.pricedShares > 0 && Math.abs(g.pricedShares - Math.abs(g.shares)) < 1e-6;
      const price = fullyPriced ? g.pricedValue / g.pricedShares : null;
      return {
        key,
        name: g.name,
        date: g.date,
        code: g.code,
        derivative: g.derivative,
        shares: g.shares,
        price,
        value: price !== null ? Math.abs(g.shares) * price : null,
        parts: g.parts,
        filing: g.filing,
      };
    })
    .filter((trade) => trade.shares !== 0)
    .sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name));
}

/**
 * Bir işlem fiyatının hisse fiyatından en fazla kaç kat uzak olabileceği.
 *
 * Sağlayıcı ADR'lerde başka bir menkulün fiyatını gönderebiliyor: TSM'de
 * (28 Eylül) açık piyasa alımları 76,20 fiyatla geliyordu, ADR 451 dolardı
 * — Tayvan'daki çalışan pay planının fiyatı olması muhtemel, ama hangi
 * menkulün hangi para birimi olduğu kayıtta yazmıyor. O fiyatla kurulan
 * "1,51 Mn $ alım" uydurma bir tutardı. Doksan günlük pencerede bir hisse
 * üç kat oynamaz; oynadıysa da tutarı göstermemek yanlış göstermekten iyi.
 */
export const PRICE_SANITY_FACTOR = 3;

/**
 * Hisse fiyatıyla tutmayan işlem fiyatını düşürür (fiyat ve tutar null).
 * Referans fiyat yoksa dokunmaz — test yapılamıyor, "başarısız" değil.
 */
export function sanitizeTradePrices(trades: readonly InsiderTrade[], reference: number | null): InsiderTrade[] {
  if (reference === null || !(reference > 0)) return [...trades];
  return trades.map((trade) =>
    trade.price !== null &&
    (trade.price > reference * PRICE_SANITY_FACTOR || trade.price < reference / PRICE_SANITY_FACTOR)
      ? { ...trade, price: null, value: null, priceDropped: true }
      : trade,
  );
}

export type OpenMarketSummary = {
  buyValue: number;
  sellValue: number;
  buyShares: number;
  sellShares: number;
  /** Alım − satış (tutar); alım yoksa eksi. */
  netValue: number;
  buyers: number;
  sellers: number;
  /** Fiyatı bilinmediği için tutara giremeyen açık piyasa alımı / satımı. */
  buyUnpriced: number;
  sellUnpriced: number;
  /** Fiyatı olan alım / satım — sıfırsa tutar "bilinmiyor", sıfır değil. */
  buyPriced: number;
  sellPriced: number;
};

/** Yalnızca P ve S — gerekçe dosyanın başında. Türev satırları sayılmaz. */
export function openMarketSummary(trades: readonly InsiderTrade[]): OpenMarketSummary {
  const buyers = new Set<string>();
  const sellers = new Set<string>();
  const out: OpenMarketSummary = {
    buyValue: 0,
    sellValue: 0,
    buyShares: 0,
    sellShares: 0,
    netValue: 0,
    buyers: 0,
    sellers: 0,
    buyUnpriced: 0,
    sellUnpriced: 0,
    buyPriced: 0,
    sellPriced: 0,
  };
  for (const trade of trades) {
    if (trade.derivative || !isOpenMarket(trade.code)) continue;
    const shares = Math.abs(trade.shares);
    if (trade.code === "P") {
      out.buyShares += shares;
      buyers.add(trade.name);
      if (trade.value !== null) {
        out.buyValue += trade.value;
        out.buyPriced += 1;
      } else out.buyUnpriced += 1;
    } else {
      out.sellShares += shares;
      sellers.add(trade.name);
      if (trade.value !== null) {
        out.sellValue += trade.value;
        out.sellPriced += 1;
      } else out.sellUnpriced += 1;
    }
  }
  out.buyers = buyers.size;
  out.sellers = sellers.size;
  out.netValue = out.buyValue - out.sellValue;
  return out;
}

export type SentimentMonth = {
  /** "2026-09" */
  month: string;
  /** Monthly Share Purchase Ratio, −100 ile 100 arası. */
  mspr: number;
  /** Net pay değişimi. */
  change: number;
};

/**
 * Aylık MSPR serisi — son `months` ay, eksik aylar DOLDURULMAZ.
 *
 * Sağlayıcı hareket olmayan ayı hiç göndermiyor (NVDA'da 2026 Nisan ve
 * Ağustos yok). Boş ayı sıfır saymak "o ay alım ile satış dengedeydi"
 * demek olurdu; yanlış. Seri boşluklu kalıyor, çizim o ayı boş bırakıyor.
 */
export function sentimentSeries(
  rows: readonly { year: number; month: number; mspr: number | null; change: number | null }[],
  endMonth: string,
  months: number,
): (SentimentMonth | null)[] {
  const byMonth = new Map<string, SentimentMonth>();
  for (const row of rows) {
    if (row.mspr === null || !Number.isFinite(row.mspr)) continue;
    const key = `${row.year}-${String(row.month).padStart(2, "0")}`;
    byMonth.set(key, { month: key, mspr: row.mspr, change: row.change ?? 0 });
  }
  const [endYear, endMon] = endMonth.split("-").map(Number);
  const out: (SentimentMonth | null)[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const total = endYear! * 12 + (endMon! - 1) - i;
    const key = `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
    out.push(byMonth.get(key) ?? null);
  }
  return out;
}
