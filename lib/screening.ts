/**
 * HİSSE SEÇİMİ — kural motoru (3 Ekim).
 *
 * NE YAPIYOR. Bir hissenin elimizdeki ölçülerini, "önce ele, sonra incele"
 * yaklaşımının kurallarıyla karşılaştırıyor ve her kural için bir sonuç
 * üretiyor: geçti, dikkat, kaldı ya da veri yok. Kategoriler ağırlıklı bir
 * uyum puanına (0-100), sonuçlar da artı/eksi listelerine ve somut
 * önerilere dönüşüyor.
 *
 * NE YAPMIYOR. Yorum üretmiyor, "al" ya da "sat" demiyor, bir dil modeline
 * gitmiyor. Puan bir UYUM ölçüsü: "bu hisse bu kuralların kaçını, ne
 * kadar karşılıyor". Kuralların dayanağı geniş kabul görmüş büyüme hissesi
 * taraması pratiği (piyasa değeri ve likidite tabanı, çift haneli kâr ve
 * satış büyümesi, kârlılık, cari oran, kurumsal ilgi, 52 haftalık dibin
 * belirgin üstünde fiyat); eşikler ekranda açıkça yazıyor ki okuyucu neyle
 * ölçüldüğünü görsün.
 *
 * SAF. Girdi sayılar, çıktı yapı; metin sözlükte. Test:
 * tests/screening.test.ts.
 */

export type CheckStatus = "pass" | "warn" | "fail" | "na";

export const SCREEN_CATEGORIES = ["gate", "growth", "profitability", "health", "strength", "ownership", "catalyst"] as const;
export type ScreenCategory = (typeof SCREEN_CATEGORIES)[number];

/**
 * Kategori ağırlıkları — toplam 100. Eleme kategorisi puana girmiyor: bir
 * KAPI. Kapıdan geçemeyen hissenin puanı `ELIMINATED_CAP`te kalıyor.
 *
 * Büyüme en ağır (30): yaklaşımın merkezindeki soru "kâr ve satış çift
 * haneli büyüyor mu". Fiyat gücü (20) ikinci: piyasanın o büyümeyi görüp
 * görmediği. Kârlılık ve sağlık (15+15) "büyüme ayakta kalabilir mi".
 * Sahiplik ve katalizör (10+10) destekleyici sinyaller — ölçüleri daha
 * dolaylı (ünlü fon takibi küçük bir evren, analist eğilimi gecikmeli).
 */
export const CATEGORY_WEIGHTS: Record<Exclude<ScreenCategory, "gate">, number> = {
  growth: 30,
  strength: 20,
  profitability: 15,
  health: 15,
  ownership: 10,
  catalyst: 10,
};

/** Eleme kuralına takılan hissenin puan tavanı — "Zayıf" bandının içinde. */
export const ELIMINATED_CAP = 45;

/** Bunun altında ölçülebilen kural oranında bant hüküm vermiyor (`limited`). */
export const MIN_COVERAGE = 50;

/** Eşikler — ekranda da aynı sayılar yazıyor (sözlükteki şablonlara giriyor). */
export const THRESHOLDS = {
  /** Piyasa değeri tabanı, dolar. Küçük şirket bandının alt sınırı. */
  minMarketCap: 300e6,
  /** Fiyat tabanı, dolar — kuruşluk hisse bölgesinin üstü. */
  minPrice: 5,
  /** Üç aylık ortalama günlük hacim, adet. */
  minAvgVolume: 500_000,
  /** Ortalama günlük işlem tutarı, dolar — adet tek başına yetmiyor. */
  minDollarVolume: 10e6,
  /** Çeyreklik yıllık (YoY) EPS ve satış büyümesi, yüzde. */
  minGrowth: 10,
  /**
   * Baz etkisi tavanı, yüzde. Bunun üstündeki büyüme oranı büyümeden çok
   * geçen yılın TABANINI anlatıyor: MU'da çeyreklik EPS büyümesi +%1.061
   * görünüyordu (3 Ekim) — kârın neredeyse sıfır olduğu bir çeyreğe göre.
   * Böyle bir oran geçti sayılırsa büyüme kategorisini tek başına tavana
   * taşıyor; dikkat (yarım puan) olarak işaretleniyor ve öneri ekleniyor.
   */
  baseEffect: 300,
  /** Satış büyümesinin kâr büyümesini "desteklediği" taban, yüzde. */
  supportGrowth: 5,
  /** Cari oran tabanı. */
  minCurrentRatio: 1,
  /** Borç / özsermaye — üstü dikkat, iki katı kaldı. */
  maxDebtToEquity: 1,
  /** Nakit pisti (yıl) — serbest nakit akışı negatifken. */
  minRunwayYears: 2,
  /** Altı aylık getiride piyasa ve sektöre göre tolerans, puan. */
  laggardTolerance: 10,
  /** 52 haftalık dibin üstünde olma tabanı, yüzde. */
  minAboveLow: 30,
  /** 52 haftalık zirveye uzaklık — bunun içi geçti, iki katı dikkat. */
  maxBelowHigh: 25,
  /** Yıllık hisse sayısı artışı (sulandırma), yüzde. */
  maxDilution: 2,
  /** Analist "al" payının üç ayda değişimi, puan. */
  analystShift: 3,
  /** Ortalama hedefe potansiyel, yüzde. */
  minUpside: 10,
  /** Bilanço analizinin skor tabanı (0-100). */
  minAnalysisScore: 60,
  /** Bu kadar gün içinde bilanço varsa öneri. */
  earningsSoonDays: 14,
} as const;

/** Değerlendirmenin girdisi — her alan bilinmiyorsa null. */
export type ScreenInput = {
  price: number | null;
  marketCap: number | null;
  /** Üç aylık ortalama günlük hacim, adet. */
  avgVolume: number | null;
  /** Son çeyreğin yıllık EPS büyümesi, yüzde. */
  epsGrowthQ: number | null;
  /** Son çeyreğin yıllık satış büyümesi, yüzde. */
  salesGrowthQ: number | null;
  /** Üç yıllık yıllıklandırılmış EPS büyümesi, yüzde. */
  epsGrowth3Y: number | null;
  epsTTM: number | null;
  grossMargin: number | null;
  operatingMargin: number | null;
  netMargin: number | null;
  currentRatio: number | null;
  debtToEquity: number | null;
  /** Toplam nakit, dolar. */
  cash: number | null;
  /** Son on iki ayın serbest nakit akışı, dolar (negatif = yakıyor). */
  freeCashFlow: number | null;
  high52: number | null;
  low52: number | null;
  /** Altı aylık getiri, yüzde. */
  return6m: number | null;
  /** Aynı dönemde S&P 500 (SPY), yüzde. */
  market6m: number | null;
  /** Aynı dönemde sektör fonu, yüzde. */
  sector6m: number | null;
  /** Yıllık hisse sayısı değişimi, yüzde. */
  sharesYoY: number | null;
  /** Takip edilen ünlü fonlar — pozisyondaki sayı ve son çeyrekte hareket. */
  funds: { holders: number; added: number; trimmed: number } | null;
  /** İçeriden işlem duyarlılığı (MSPR, −100..100), son altı ay ortalaması. */
  insiderMspr: number | null;
  /** Analist "al" payı (güçlü al + al), yüzde — şimdi ve üç ay önce. */
  buyShareNow: number | null;
  buyShare3mAgo: number | null;
  /** Ortalama hedefe potansiyel, yüzde. */
  upside: number | null;
  /** Son bilanço analizinin skoru (0-100). */
  analysisScore: number | null;
  /** Sıradaki bilançoya gün. */
  earningsInDays: number | null;
  /** İleri F/K — yalnızca öneri için. */
  forwardPE: number | null;
  /** Banka/sigorta: sağlık kuralları (cari oran, borç, nakit pisti) ölçü değil. */
  financial?: boolean;
};

export type CheckId =
  | "marketCap"
  | "price"
  | "liquidity"
  | "epsGrowthQ"
  | "salesGrowthQ"
  | "epsGrowth3Y"
  | "growthSource"
  | "profitable"
  | "margins"
  | "currentRatio"
  | "debt"
  | "runway"
  | "vsMarket"
  | "vsSector"
  | "aboveLow"
  | "nearHigh"
  | "dilution"
  | "funds"
  | "insiders"
  | "analystTrend"
  | "upside"
  | "earningsQuality";

export type Check = {
  id: CheckId;
  category: ScreenCategory;
  status: CheckStatus;
  /** Ekranda yazılan ölçü — birimi kontrolün kendisi biliyor. */
  value: number | null;
  /** Eleme kontrolü kaldıysa hisse elendi. */
  eliminates?: boolean;
  /** Büyüme oranı baz etkisi tavanını aştı (bkz. `THRESHOLDS.baseEffect`). */
  baseEffect?: boolean;
};

export type CategoryScore = {
  category: Exclude<ScreenCategory, "gate">;
  /** 0-100; ölçülebilen kontrol yoksa null. */
  score: number | null;
  weight: number;
  measured: number;
  total: number;
};

/**
 * `limited`: büyüme hiç ölçülemedi ya da kuralların yarısından azı
 * ölçülebildi — puan yine yazılıyor ama bant bir hüküm vermiyor. SHAZ'da
 * görüldü (3 Ekim): büyüme verisi yokken fiyat gücü ve fon ilgisi puanı 65'e,
 * "Araştırmaya Değer"e taşıyordu.
 */
export type Band = "strong" | "worth" | "mixed" | "weak" | "eliminated" | "limited";

export type SuggestionId =
  | "catalyst"
  | "fallen"
  | "earlyBase"
  | "laggard"
  | "earningsSoon"
  | "dilution"
  | "growthSource"
  | "burn"
  | "richValuation"
  | "liquidity"
  | "baseEffect";

export type ScreenResult = {
  checks: Check[];
  categories: CategoryScore[];
  /** 0-100; hiçbir kategori ölçülemediyse null. */
  score: number | null;
  band: Band | null;
  eliminated: boolean;
  /** Ölçülebilen kontrollerin oranı, yüzde. */
  coverage: number;
  pros: CheckId[];
  cons: CheckId[];
  suggestions: SuggestionId[];
};

const STATUS_POINTS: Record<Exclude<CheckStatus, "na">, number> = { pass: 1, warn: 0.5, fail: 0 };

/** Eşik merdiveni: değer ≥ geçti tabanı ise geçti, ≥ dikkat tabanı ise dikkat. */
function ladder(value: number | null, passAt: number, warnAt: number): CheckStatus {
  if (value === null) return "na";
  if (value >= passAt) return "pass";
  if (value >= warnAt) return "warn";
  return "fail";
}

/** Ters merdiven: değer ≤ geçti tavanı ise geçti, ≤ dikkat tavanı ise dikkat. */
function ceiling(value: number | null, passAt: number, warnAt: number): CheckStatus {
  if (value === null) return "na";
  if (value <= passAt) return "pass";
  if (value <= warnAt) return "warn";
  return "fail";
}

export function evaluate(input: ScreenInput): ScreenResult {
  const T = THRESHOLDS;
  const checks: Check[] = [];
  const add = (check: Check) => checks.push(check);

  /* ---- Eleme: büyüklük ve likidite ---- */
  add({
    id: "marketCap",
    category: "gate",
    value: input.marketCap,
    status: input.marketCap === null ? "na" : input.marketCap >= T.minMarketCap ? "pass" : "fail",
    eliminates: input.marketCap !== null && input.marketCap < T.minMarketCap,
  });
  add({
    id: "price",
    category: "gate",
    value: input.price,
    status: input.price === null ? "na" : input.price >= T.minPrice ? "pass" : "fail",
    eliminates: input.price !== null && input.price < T.minPrice,
  });
  {
    const volume = input.avgVolume;
    const dollars = volume !== null && input.price !== null ? volume * input.price : null;
    let status: CheckStatus = "na";
    if (volume !== null) {
      if (volume < T.minAvgVolume) status = "fail";
      else if (dollars !== null && dollars < T.minDollarVolume) status = "warn";
      else status = "pass";
    }
    add({ id: "liquidity", category: "gate", value: volume, status, eliminates: status === "fail" });
  }

  /* ---- Büyüme ---- */
  const growth = (id: "epsGrowthQ" | "salesGrowthQ" | "epsGrowth3Y", value: number | null) =>
    value !== null && value > T.baseEffect
      ? add({ id, category: "growth", value, status: "warn", baseEffect: true })
      : add({ id, category: "growth", value, status: ladder(value, T.minGrowth, 0) });
  growth("epsGrowthQ", input.epsGrowthQ);
  growth("salesGrowthQ", input.salesGrowthQ);
  growth("epsGrowth3Y", input.epsGrowth3Y);
  {
    /* Büyümenin kaynağı: kâr çift haneli büyürken satış da en az %5
       büyüyorsa büyüme işin kendisinden geliyor; satış durgunken kâr
       büyümesi çoğu zaman maliyet kesintisi ya da tek seferlik kalemden. */
    let status: CheckStatus = "na";
    if (input.epsGrowthQ !== null && input.salesGrowthQ !== null && input.epsGrowthQ >= T.minGrowth) {
      status = input.salesGrowthQ >= T.supportGrowth ? "pass" : "warn";
    }
    add({ id: "growthSource", category: "growth", value: input.salesGrowthQ, status });
  }

  /* ---- Kârlılık ---- */
  add({
    id: "profitable",
    category: "profitability",
    value: input.epsTTM,
    status: input.epsTTM === null ? "na" : input.epsTTM > 0 ? "pass" : "fail",
  });
  {
    const { grossMargin: g, operatingMargin: o, netMargin: n } = input;
    let status: CheckStatus = "na";
    if (g !== null || o !== null || n !== null) {
      const known = [g, o, n].filter((value): value is number => value !== null);
      if (known.every((value) => value > 0)) status = "pass";
      else if (g !== null && g > 0) status = "warn";
      else status = "fail";
    }
    add({ id: "margins", category: "profitability", value: o ?? n ?? g, status });
  }

  /* ---- Finansal sağlık ---- */
  if (input.financial) {
    for (const id of ["currentRatio", "debt", "runway"] as const) add({ id, category: "health", value: null, status: "na" });
  } else {
  add({ id: "currentRatio", category: "health", value: input.currentRatio, status: ladder(input.currentRatio, T.minCurrentRatio, 0.8) });
  add({
    id: "debt",
    category: "health",
    value: input.debtToEquity,
    /* Negatif özsermaye (geri alımla eksiye düşmüş) oranı anlamsızlaştırıyor. */
    status: input.debtToEquity === null || input.debtToEquity < 0 ? "na" : ceiling(input.debtToEquity, T.maxDebtToEquity, T.maxDebtToEquity * 2),
  });
  {
    /* Nakit pisti: serbest nakit akışı pozitifse şirket kendi nakdini
       üretiyor (geçti). Negatifse eldeki nakit kaç yıl yeter: iki yıl ve
       üstü dikkat, bir-iki yıl kaldı, bir yılın altı ELER — finansman
       bulamayan şirket hisse çıkarır ya da borçlanır. */
    let status: CheckStatus = "na";
    let years: number | null = null;
    let eliminates = false;
    if (input.freeCashFlow !== null) {
      if (input.freeCashFlow >= 0) status = "pass";
      else if (input.cash !== null) {
        years = input.cash / Math.abs(input.freeCashFlow);
        status = years >= T.minRunwayYears ? "warn" : "fail";
        eliminates = years < 1;
      }
    }
    add({ id: "runway", category: "health", value: years, status, eliminates });
  }
  }

  /* ---- Fiyat gücü ---- */
  const rel = (other: number | null) =>
    input.return6m === null || other === null ? null : input.return6m - other;
  add({ id: "vsMarket", category: "strength", value: rel(input.market6m), status: ladder(rel(input.market6m), 0, -T.laggardTolerance) });
  add({ id: "vsSector", category: "strength", value: rel(input.sector6m), status: ladder(rel(input.sector6m), 0, -T.laggardTolerance) });
  {
    const above =
      input.price !== null && input.low52 !== null && input.low52 > 0 ? (input.price / input.low52 - 1) * 100 : null;
    add({ id: "aboveLow", category: "strength", value: above, status: ladder(above, T.minAboveLow, 10) });
    const below =
      input.price !== null && input.high52 !== null && input.high52 > 0 ? (1 - input.price / input.high52) * 100 : null;
    add({ id: "nearHigh", category: "strength", value: below, status: ceiling(below, T.maxBelowHigh, T.maxBelowHigh * 2) });
  }

  /* ---- Sahiplik ve sulandırma ---- */
  add({ id: "dilution", category: "ownership", value: input.sharesYoY, status: ceiling(input.sharesYoY, T.maxDilution, 5) });
  {
    /* Ünlü fon takibi küçük bir evren: pozisyonda kimse yoksa bu bir eksi
       değil, ölçü yok. Varsa son çeyrekte artıranlar azaltanlardan az
       değilse geçti. */
    const f = input.funds;
    const status: CheckStatus = !f || f.holders === 0 ? "na" : f.added >= f.trimmed ? "pass" : "warn";
    add({ id: "funds", category: "ownership", value: f?.holders ?? null, status });
  }
  {
    /* İçeriden satış sıradan (vergi, opsiyon); yalnızca güçlü net satış
       dikkat, net alım geçti, arası ölçü sayılmıyor. */
    const m = input.insiderMspr;
    const status: CheckStatus = m === null ? "na" : m > 0 ? "pass" : m <= -50 ? "warn" : "na";
    add({ id: "insiders", category: "ownership", value: m, status });
  }

  /* ---- Katalizör sinyalleri ---- */
  {
    const shift =
      input.buyShareNow !== null && input.buyShare3mAgo !== null ? input.buyShareNow - input.buyShare3mAgo : null;
    const status: CheckStatus =
      shift === null ? "na" : shift >= T.analystShift ? "pass" : shift <= -T.analystShift ? "warn" : "na";
    add({ id: "analystTrend", category: "catalyst", value: shift, status });
  }
  add({ id: "upside", category: "catalyst", value: input.upside, status: ladder(input.upside, T.minUpside, 0) });
  add({
    id: "earningsQuality",
    category: "catalyst",
    value: input.analysisScore,
    status: ladder(input.analysisScore, T.minAnalysisScore, 40),
  });

  /* ---- Puan ---- */
  const categories: CategoryScore[] = (Object.keys(CATEGORY_WEIGHTS) as (keyof typeof CATEGORY_WEIGHTS)[]).map(
    (category) => {
      const own = checks.filter((check) => check.category === category);
      const measured = own.filter((check) => check.status !== "na");
      const score =
        measured.length === 0
          ? null
          : (measured.reduce((sum, check) => sum + STATUS_POINTS[check.status as Exclude<CheckStatus, "na">], 0) /
              measured.length) *
            100;
      return { category, score, weight: CATEGORY_WEIGHTS[category], measured: measured.length, total: own.length };
    },
  );
  const scored = categories.filter((entry) => entry.score !== null);
  const weightSum = scored.reduce((sum, entry) => sum + entry.weight, 0);
  const raw = weightSum > 0 ? scored.reduce((sum, entry) => sum + entry.score! * entry.weight, 0) / weightSum : null;
  const eliminated = checks.some((check) => check.eliminates);
  const score = raw === null ? null : Math.round(eliminated ? Math.min(raw, ELIMINATED_CAP) : raw);
  const measuredAll = checks.filter((check) => check.status !== "na").length;
  const coverage = Math.round((measuredAll / checks.length) * 100);
  const growthMeasured = categories.find((entry) => entry.category === "growth")!.measured > 0;
  const band: Band | null =
    score === null
      ? null
      : eliminated
        ? "eliminated"
        : !growthMeasured || coverage < MIN_COVERAGE
          ? "limited"
          : score >= 80
            ? "strong"
            : score >= 65
              ? "worth"
              : score >= 50
                ? "mixed"
                : "weak";

  /* Artılar geçenler; eksiler kalanlar ve dikkatler — önce kalanlar. */
  const pros = checks.filter((check) => check.status === "pass").map((check) => check.id);
  const cons = [
    ...checks.filter((check) => check.status === "fail"),
    ...checks.filter((check) => check.status === "warn"),
  ].map((check) => check.id);

  return { checks, categories, score, band, eliminated, coverage, pros, cons, suggestions: suggest(input, checks) };
}

/**
 * Öneriler — sonuçlardan türeyen somut sonraki adımlar. Sıra önem sırası;
 * "katalizör" her zaman listede, çünkü ölçülemeyen tek kural o ve okuyucuya
 * bırakılıyor.
 */
function suggest(input: ScreenInput, checks: Check[]): SuggestionId[] {
  const status = (id: CheckId) => checks.find((check) => check.id === id)?.status ?? "na";
  const out: SuggestionId[] = [];
  if (status("liquidity") === "fail" || status("liquidity") === "warn") out.push("liquidity");
  if (status("runway") === "fail" || status("runway") === "warn") out.push("burn");
  if (status("nearHigh") === "fail") out.push("fallen");
  else if (status("aboveLow") === "warn" || status("aboveLow") === "fail") out.push("earlyBase");
  if (status("vsSector") === "fail" || status("vsMarket") === "fail") out.push("laggard");
  if (checks.some((check) => check.baseEffect)) out.push("baseEffect");
  if (status("growthSource") === "warn") out.push("growthSource");
  if (status("dilution") === "fail" || status("dilution") === "warn") out.push("dilution");
  if (input.forwardPE !== null && input.forwardPE > 40) out.push("richValuation");
  if (input.earningsInDays !== null && input.earningsInDays >= 0 && input.earningsInDays <= THRESHOLDS.earningsSoonDays) {
    out.push("earningsSoon");
  }
  out.push("catalyst");
  return out;
}

/**
 * Üç yıllık yıllıklandırılmış büyüme — iki pozitif uçtan. Uçlardan biri
 * sıfır ya da negatifse oran tanımsız (zarardan kâra geçiş "sonsuz
 * büyüme" değil); o zaman null.
 */
export function cagr(latest: number | null, threeYearsAgo: number | null): number | null {
  if (latest === null || threeYearsAgo === null || latest <= 0 || threeYearsAgo <= 0) return null;
  return ((latest / threeYearsAgo) ** (1 / 3) - 1) * 100;
}

/** Hisse sayısı serisinin en yeni kaydının en fazla yaşı (kapak serisi; çeyreklik dosyalanıyor). */
export const SHARES_MAX_AGE_DAYS = 200;
/** Yıllık yedek seride (10-K) izin verilen yaş — yıllık rapor yılda bir. */
export const SHARES_ANNUAL_MAX_AGE_DAYS = 500;

/**
 * Yıllık hisse sayısı değişimi — en yeni kayıt ile ondan 300-430 gün önceki
 * en yakın kayıt. Aralıkta kayıt yoksa null (yeni halka arz, eksik dosya).
 */
export function sharesChangeYoY(
  series: readonly { end: string; value: number }[],
  now: Date = new Date(),
  maxAgeDays = SHARES_MAX_AGE_DAYS,
): number | null {
  const sorted = [...series].filter((row) => row.value > 0).sort((a, b) => a.end.localeCompare(b.end));
  const latest = sorted[sorted.length - 1];
  if (!latest) return null;
  /* SERİ GÜNCEL OLMALI. Ford kapak sayısını 2011'den beri hisse sınıfı
     bazında yazıyor ve sınıfsız seri 2011'de bitiyor: hesap 2011'i 2010'la
     karşılaştırıp "%11,7 sulandırma" diyordu (3 Ekim). */
  if ((now.getTime() - Date.parse(latest.end)) / 86_400_000 > maxAgeDays) return null;
  const latestMs = Date.parse(latest.end);
  let best: { row: (typeof sorted)[number]; gap: number } | null = null;
  for (const row of sorted) {
    const days = (latestMs - Date.parse(row.end)) / 86_400_000;
    if (days < 300 || days > 430) continue;
    const gap = Math.abs(days - 365);
    if (!best || gap < best.gap) best = { row, gap };
  }
  return best ? (latest.value / best.row.value - 1) * 100 : null;
}
