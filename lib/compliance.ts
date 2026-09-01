import { indexMemberOf } from "@/db/seed/indices";

/**
 * Katılım finansı (İslami uyum) ön taraması.
 *
 * BU BİR FETVA DEĞİLDİR. Burada yapılan, kamuya açık iki bilgiyle otomatik bir
 * ELEMEdir: (1) şirketin ana faaliyet alanı, (2) AAOIFI'nin yaygın kullanılan
 * finansal eşikleri. Nihai hüküm kişinin bağlı olduğu görüşe ve şirketin
 * denetlenmiş mali tablolarına bakan uzman kurullara aittir.
 *
 * Uygulanan kriterler
 * -------------------
 * A. Faaliyet alanı — GICS alt sektörüne göre. Faizli bankacılık, sigorta,
 *    alkol, tütün, kumar, silah, yetişkin içerik ve domuz ürünleri elenir.
 * B. Borçluluk — faizli borç / piyasa değeri < %33.
 * C. Likidite — nakit ve faiz getiren varlıklar / piyasa değeri < %33.
 *
 * Uygulanamayan kriter
 * --------------------
 * D. Faiz geliri / toplam gelir < %5 — gelir kırılımı ücretsiz veri
 *    kaynağımızda yok. Bu yüzden sonuç "temiz" değil "ön eleme"dir ve ekranda
 *    bu eksiklik açıkça yazılır.
 *
 * Oranlar hisse başına hesaplanır: fiyat, piyasa değerinin hisse başına
 * karşılığıdır — böylece toplam piyasa değerine ihtiyaç kalmaz.
 */

export type ComplianceVerdict = "pass" | "review" | "fail";

export type ComplianceResult = {
  verdict: ComplianceVerdict;
  /** Elenen faaliyet alanı — "fail" ise dolu. */
  businessReasonKey: BusinessReasonKey | null;
  /** Faizli borç / piyasa değeri (%). Hesaplanamazsa null. */
  debtRatio: number | null;
  /** Nakit ve faizli varlıklar / piyasa değeri (%). Hesaplanamazsa null. */
  cashRatio: number | null;
  /** Finansal eşikler hesaplanabildi mi? */
  ratiosKnown: boolean;
  /**
   * Faaliyet alanı (A kriteri) DEĞERLENDİRİLEBİLDİ Mİ?
   *
   * Alt sektör yalnızca statik endeks tohumundan geliyor
   * (`db/seed/indices` → `indexMemberOf`). Tohumda olmayan bir sembolde `sub`
   * boş kalıyor ve A kriteri sessizce HİÇ ÇALIŞMIYORDU; kart yine de üç
   * kriterden yalnızca ikisine bakıp "Ön Elemeyi Geçiyor" diyordu.
   *
   * Ölçüldü ve tam da taramanın var olma sebebi olan iki kategoride
   * yanlış sonuç veriyordu: DKNG (bahis) ve SOFI (faizli kredi) ikisi de
   * "Ön Elemeyi Geçiyor" alıyordu. `EXCLUDED_SUBS` listesi doğru —
   * "Casinos & Gaming" ve "Consumer Finance" orada duruyor; kusur listede
   * değil ARAMADA.
   *
   * Finnhub profilindeki sektöre düşmek çözüm DEĞİL: o taksonomi kaba
   * ("Otel, Restoran ve Eğlence", "Finansal Hizmetler") ve bu listenin
   * beklediği GICS alt sektör adlarıyla eşleşmiyor — DKNG yine kaçardı,
   * "Finansal Hizmetler" ise fazla geniş elerdi.
   *
   * O yüzden çözüm kapsamı büyütmek değil, DÜRÜSTLÜK: bilinmiyorsa
   * "geçiyor" denmez. CLAUDE.md § Veri dürüstlüğü 1 — uydurma kesinlik yok.
   */
  businessKnown: boolean;
};

export type BusinessReasonKey =
  | "banking"
  | "insurance"
  | "alcohol"
  | "tobacco"
  | "gambling"
  | "weapons"
  | "adult"
  | "pork";

/** AAOIFI'nin yaygın kullanılan eşiği. */
const THRESHOLD = 33;

/** GICS alt sektörü → elenme gerekçesi. */
const EXCLUDED_SUBS: Record<string, BusinessReasonKey> = {
  "Diversified Banks": "banking",
  "Regional Banks": "banking",
  "Commercial & Residential Mortgage Finance": "banking",
  "Consumer Finance": "banking",
  "Transaction & Payment Processing Services": "banking",
  "Financial Exchanges & Data": "banking",
  "Asset Management & Custody Banks": "banking",
  "Investment Banking & Brokerage": "banking",
  "Multi-Sector Holdings": "banking",
  "Insurance Brokers": "insurance",
  "Life & Health Insurance": "insurance",
  "Multi-line Insurance": "insurance",
  "Property & Casualty Insurance": "insurance",
  "Reinsurance": "insurance",
  "Brewers": "alcohol",
  "Distillers & Vintners": "alcohol",
  Tobacco: "tobacco",
  "Casinos & Gaming": "gambling",
  "Aerospace & Defense": "weapons",
  "Movies & Entertainment": "adult",
  "Packaged Foods & Meats": "pork",
};

/**
 * Bazı alt sektörler kural gereği elenmez ama dikkat ister:
 * ana faaliyeti helal olsa da gelirinin bir kısmı tartışmalı olabilir.
 */
const REVIEW_SUBS = new Set([
  "Movies & Entertainment",
  "Packaged Foods & Meats",
  "Restaurants",
  "Hotels, Resorts & Cruise Lines",
  "Broadcasting",
  "Interactive Media & Services",
]);

export type ComplianceInputs = {
  symbol: string;
  /** Son işlem fiyatı — hisse başına piyasa değeri. */
  price: number | null;
  /** bookValuePerShareQuarterly */
  bookValuePerShare: number | null;
  /** totalDebt/totalEquityQuarterly */
  debtToEquity: number | null;
  /** cashPerSharePerShareQuarterly */
  cashPerShare: number | null;
};

export function screenCompliance(inputs: ComplianceInputs): ComplianceResult {
  const member = indexMemberOf(inputs.symbol);
  const sub = member?.sub ?? null;
  /* A kriteri değerlendirilebiliyor mu — gerekçe tip künyesinde. */
  const businessKnown = sub !== null;

  // A. Faaliyet alanı — kesin eleme
  const excluded = sub ? EXCLUDED_SUBS[sub] : undefined;
  const needsReview = sub ? REVIEW_SUBS.has(sub) : false;

  // B ve C. Finansal oranlar — hisse başına, fiyata oranlanır
  let debtRatio: number | null = null;
  let cashRatio: number | null = null;
  if (inputs.price && inputs.price > 0) {
    if (
      inputs.bookValuePerShare !== null &&
      inputs.debtToEquity !== null &&
      inputs.bookValuePerShare > 0
    ) {
      const debtPerShare = inputs.bookValuePerShare * inputs.debtToEquity;
      debtRatio = (debtPerShare / inputs.price) * 100;
    }
    if (inputs.cashPerShare !== null) {
      cashRatio = (inputs.cashPerShare / inputs.price) * 100;
    }
  }

  const ratiosKnown = debtRatio !== null && cashRatio !== null;

  // Faaliyet alanı elenmişse gerisine bakılmaz.
  if (excluded && !REVIEW_SUBS.has(sub ?? "")) {
    return {
      verdict: "fail",
      businessReasonKey: excluded,
      debtRatio,
      cashRatio,
      ratiosKnown,
      businessKnown,
    };
  }

  const overDebt = debtRatio !== null && debtRatio >= THRESHOLD;
  const overCash = cashRatio !== null && cashRatio >= THRESHOLD;

  if (overDebt || overCash) {
    return {
      verdict: "fail",
      businessReasonKey: null,
      debtRatio,
      cashRatio,
      ratiosKnown,
      businessKnown,
    };
  }

  /* Oranlar bilinmiyorsa, FAALİYET ALANI BİLİNMİYORSA ya da alan gri
     bölgedeyse: inceleme. Ortadaki koşul sonradan eklendi; onsuz üç
     kriterden ikisine bakıp "geçiyor" deniyordu. */
  if (!ratiosKnown || !businessKnown || needsReview) {
    return {
      verdict: "review",
      businessReasonKey: needsReview ? (excluded ?? null) : null,
      debtRatio,
      cashRatio,
      ratiosKnown,
      businessKnown,
    };
  }

  return {
    verdict: "pass",
    businessReasonKey: null,
    debtRatio,
    cashRatio,
    ratiosKnown,
    businessKnown,
  };
}

export const COMPLIANCE_THRESHOLD = THRESHOLD;
