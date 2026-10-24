import { z } from "zod";
import { SECTOR_GROUPS, sectorGroupByKey } from "@/lib/sectors";

/**
 * DÜZ CÜMLEYLE TARAMA (24 Ekim) — saf çekirdek.
 *
 * Okur /tarama'da "borcu az, kârlı yarı iletkenler" gibi bir cümle yazar;
 * Claude cümleyi tarayıcının ZATEN desteklediği süzgeçlere çevirir, sayfa o
 * süzgeçlerle açılır. Model sonuç üretmez, sayı da üretmez:
 *
 * - Çıktı yapılandırılmış JSON (`ModelOutputSchema`); her alan burada AYRI
 *   doğrulanır (`sanitizeModelOutput`), bilinmeyen alan atılır, aralık dışı
 *   değer düşer. Hangi hissenin geçtiğini tarayıcının kendi mantığı bulur
 *   (`matchesScreenFilters`, app/(app)/tarama/page.tsx).
 * - Belirsiz sözcüklerin ("borcu az", "ucuz", "büyük") eşiği MODELDEN
 *   GELMEZ: model yalnız yön (`min`/`max`) ve derece (`some`/`strong`) söyler,
 *   sayı `VAGUE_THRESHOLDS` tablosundan gelir. Aynı sözcük her gün aynı
 *   eşiğe düşer ve eşik okurun gördüğü çipte yazar.
 * - Model bir sayı verdiyse o sayı CÜMLEDE geçmek zorunda
 *   (`valueInSentence`); geçmiyorsa koşul atılır ve okura söylenir — modelin
 *   "makul" bulduğu bir eşiği okurun ağzına koymasın.
 * - Desteklenmeyen istek parçaları ("temettü veren", "son çeyrekte") ayrı
 *   listelenir ve okura dürüstçe gösterilir.
 *
 * Sonuç adrese yazılır (`screenParams`): paylaşılabilir, geri tuşuyla
 * dönülebilir; sayfa durumu ADRESTEN okur (`parseScreenParams`).
 * Test: tests/screen-query.test.ts.
 */

/** Tarayıcının sıralama anahtarları — sayfa da buradan okur. */
export const SCREEN_SORTS = ["cap", "fk", "buyume", "marj", "roe", "borc"] as const;
export type ScreenSort = (typeof SCREEN_SORTS)[number];

/** GICS ana sektörleri — on bir tane (lib/sectors.ts → SECTOR_TR ile aynı). */
export const GICS_SECTORS = [
  "Communication Services",
  "Consumer Discretionary",
  "Consumer Staples",
  "Energy",
  "Financials",
  "Health Care",
  "Industrials",
  "Information Technology",
  "Materials",
  "Real Estate",
  "Utilities",
] as const;

/** GICS sektör adı → adres anahtarı ("Information Technology" → "information-technology"). */
export function sectorSlug(sector: string): string {
  return sector.toLocaleLowerCase("en-US").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** Alt sektör grupları — "Diğer" bir süzgeç değil, sözlükte olmayanların kovası. */
export const INDUSTRY_GROUP_KEYS = SECTOR_GROUPS.map((group) => group.key).filter((key) => key !== "diger") as [
  string,
  ...string[],
];

/**
 * Sayısal ölçüler — `symbol_metrics`te GERÇEKTEN olanlar (lib/scorecard.ts →
 * StoredMetrics) ve canlı fiyattan kurulan F/K ile piyasa değeri. Temettü
 * verimi ve çeyreklik büyüme tabloda YOK: eklenseydi saklanan şekil değişir,
 * evren yedi haftada bir dönerdi; o istekler desteklenmeyen parça olarak
 * okura söylenir.
 */
export const SCREEN_FIELDS = [
  "pe",
  "revenueGrowth",
  "epsGrowth",
  "netMargin",
  "roe",
  "debtToEquity",
  "currentRatio",
  "marketCap",
] as const;
export type ScreenField = (typeof SCREEN_FIELDS)[number];
export type ScreenOp = "min" | "max";

/** Adres anahtarı: `fkmax`, `buyumemin`… (Türkçe, /tarama'nın öteki parametreleri gibi). */
export const FIELD_PARAM: Record<ScreenField, string> = {
  pe: "fk",
  revenueGrowth: "buyume",
  epsGrowth: "karbuyume",
  netMargin: "marj",
  roe: "roe",
  debtToEquity: "borc",
  currentRatio: "cari",
  marketCap: "deger",
};

/**
 * İzin verilen değer aralığı — bunun dışındaki değer (modelden de adresten
 * de) düşer. Yüzdeler yüzde puanı, borç ve cari oran kat, piyasa değeri
 * MİLYAR DOLAR.
 */
export const FIELD_RANGE: Record<ScreenField, { min: number; max: number }> = {
  pe: { min: 0, max: 500 },
  revenueGrowth: { min: -100, max: 1000 },
  epsGrowth: { min: -100, max: 1000 },
  netMargin: { min: -100, max: 100 },
  roe: { min: -200, max: 300 },
  debtToEquity: { min: 0, max: 20 },
  currentRatio: { min: 0, max: 20 },
  marketCap: { min: 0, max: 10_000 },
};

/**
 * Belirsiz sözcüklerin eşikleri — `some` sıradan ("borcu az", "büyüyen"),
 * `strong` vurgulu ("neredeyse borçsuz", "hızlı büyüyen"). Hazır
 * süzgeçlerle aynı ölçek: "ucuz" F/K < 20 (Değer), "borcu az" < 1 (Sağlam
 * Bilanço). Büyüme `some` sıfır: "büyüyen" yalnız eksiye düşmeyen demek.
 * Piyasa değeri evrenin kendisi büyük (S&P 500 + Nasdaq-100); "büyük" orada
 * 50 milyar doların üstü.
 */
export const VAGUE_THRESHOLDS: Record<ScreenField, Record<ScreenOp, { some: number; strong: number }>> = {
  pe: { min: { some: 25, strong: 40 }, max: { some: 20, strong: 12 } },
  revenueGrowth: { min: { some: 0, strong: 15 }, max: { some: 0, strong: -10 } },
  epsGrowth: { min: { some: 0, strong: 20 }, max: { some: 0, strong: -20 } },
  netMargin: { min: { some: 10, strong: 20 }, max: { some: 5, strong: 0 } },
  roe: { min: { some: 15, strong: 25 }, max: { some: 10, strong: 0 } },
  debtToEquity: { min: { some: 1, strong: 2 }, max: { some: 1, strong: 0.5 } },
  currentRatio: { min: { some: 1.5, strong: 2 }, max: { some: 1, strong: 0.8 } },
  marketCap: { min: { some: 50, strong: 200 }, max: { some: 20, strong: 10 } },
};

export type ScreenCondition = { field: ScreenField; op: ScreenOp; value: number };

export type ScreenFilters = {
  /** GICS ana sektörünün adres anahtarı (`sectorSlug`). */
  sector: string | null;
  /** Alt sektör grubu (lib/sectors.ts → SECTOR_GROUPS anahtarı). */
  group: string | null;
  /** Son 12 ay hisse başına kârı pozitif. */
  profitable: boolean;
  conditions: ScreenCondition[];
};

export const EMPTY_FILTERS: ScreenFilters = { sector: null, group: null, profitable: false, conditions: [] };

/* ---------------------------------------------------------------------------
   Cümle
   --------------------------------------------------------------------------- */

export const QUERY_MIN = 3;
export const QUERY_MAX = 200;

/**
 * Önbellek anahtarı ve modele giden metin: boşluk sadeleşir, sondaki
 * noktalama düşer, harf küçülür. Küçültme dile göre: Türkçe harf varsa
 * `tr-TR` (I → ı), yoksa `en-US` — İngilizce "IT stocks" "ıt"ye dönmesin.
 * Çok kısa ya da boş cümle "".
 */
export function normalizeQuery(raw: string): string {
  const compact = raw.normalize("NFC").replace(/\s+/g, " ").trim().slice(0, QUERY_MAX);
  const turkish = /[çğıöşüÇĞİÖŞÜ]/.test(compact);
  const lowered = compact.toLocaleLowerCase(turkish ? "tr-TR" : "en-US").replace(/[\s.!?…,;:]+$/u, "");
  return lowered.length >= QUERY_MIN ? lowered : "";
}

/**
 * Modelin verdiği sayı cümlede geçiyor mu. Cümledeki her sayı iki türlü
 * okunur ("1.5" → 1,5 ya da binlik ayraçlı 15; "1.000" → 1 ya da 1000).
 * Piyasa değerinde ölçek sözcüğü (trilyon, milyon) birimi milyar dolara
 * çevirir: "1 trilyon" → 1000.
 */
export function valueInSentence(value: number, sentence: string, field?: ScreenField): boolean {
  const tokens = sentence.match(/\d+(?:[.,]\d+)*/g) ?? [];
  const candidates: number[] = [];
  for (const token of tokens) {
    candidates.push(Number(token.replace(",", ".")));
    candidates.push(Number(token.replace(/[.,]/g, "")));
  }
  const scaled = [...candidates];
  if (field === "marketCap") {
    if (/trilyon|trillion|\btn\b/u.test(sentence)) scaled.push(...candidates.map((n) => n * 1000));
    if (/milyon|million|\bmn\b/u.test(sentence)) scaled.push(...candidates.map((n) => n / 1000));
  }
  return scaled.some((n) => Number.isFinite(n) && Math.abs(n - value) < 1e-9);
}

/* ---------------------------------------------------------------------------
   Model çıktısı
   --------------------------------------------------------------------------- */

/**
 * Modelin dolduracağı şema (araç/JSON şeması olarak gider). Sayı yalnız
 * cümlede yazılıysa `value`a girer; yoksa null ve eşik `degree`den gelir.
 */
export const ModelOutputSchema = z.object({
  sector: z.enum(GICS_SECTORS).nullable(),
  industry: z.enum(INDUSTRY_GROUP_KEYS).nullable(),
  profitable: z.boolean().nullable(),
  conditions: z.array(
    z.object({
      field: z.enum(SCREEN_FIELDS),
      op: z.enum(["min", "max"]),
      degree: z.enum(["some", "strong"]),
      value: z.number().nullable(),
    }),
  ),
  sort: z.enum(SCREEN_SORTS).nullable(),
  direction: z.enum(["asc", "desc"]).nullable(),
  unsupported: z.array(z.string()),
});
export type ModelOutput = z.infer<typeof ModelOutputSchema>;

export type Translation = {
  filters: ScreenFilters;
  sort: ScreenSort | null;
  dir: "asc" | "desc" | null;
  /** Okurun istediği ama tarayıcının süzemediği parçalar — cümlenin dilinde. */
  unsupported: string[];
  /** Sayısı cümlede bulunmayan ya da aralık dışı kalan koşulların alanları. */
  dropped: ScreenField[];
};

const UNSUPPORTED_MAX = 6;
const UNSUPPORTED_LEN = 60;

const round2 = (n: number) => Math.round(n * 100) / 100;
const inRange = (field: ScreenField, value: number) =>
  Number.isFinite(value) && value >= FIELD_RANGE[field].min && value <= FIELD_RANGE[field].max;

/**
 * Model çıktısını alan alan doğrular. Tek bozuk alan bütün çeviriyi
 * düşürmez; bilinmeyen alan okunmaz bile. Aynı alan + yönde son koşul
 * geçerli (iki "en az" aynı anda anlamsız).
 */
export function sanitizeModelOutput(raw: unknown, sentence: string): Translation {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const pick = <T extends z.ZodType>(schema: T, value: unknown): z.infer<T> | null => {
    const parsed = schema.safeParse(value);
    return parsed.success ? parsed.data : null;
  };
  const sectorName = pick(z.enum(GICS_SECTORS), obj.sector);
  const group = pick(z.enum(INDUSTRY_GROUP_KEYS), obj.industry);
  const profitable = pick(z.boolean(), obj.profitable) === true;
  const sort = pick(z.enum(SCREEN_SORTS), obj.sort);
  const dir = pick(z.enum(["asc", "desc"]), obj.direction);

  const conditionSchema = ModelOutputSchema.shape.conditions.element;
  const byKey = new Map<string, ScreenCondition>();
  const dropped: ScreenField[] = [];
  for (const entry of Array.isArray(obj.conditions) ? obj.conditions : []) {
    const c = pick(conditionSchema, entry);
    if (!c) continue;
    let value: number;
    if (c.value === null) value = VAGUE_THRESHOLDS[c.field][c.op][c.degree];
    else if (valueInSentence(c.value, sentence, c.field) && inRange(c.field, c.value)) value = round2(c.value);
    else {
      if (!dropped.includes(c.field)) dropped.push(c.field);
      continue;
    }
    byKey.set(`${c.field}:${c.op}`, { field: c.field, op: c.op, value });
  }

  const unsupported = (Array.isArray(obj.unsupported) ? obj.unsupported : [])
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.replace(/\s+/g, " ").trim().slice(0, UNSUPPORTED_LEN))
    .filter((item, index, all) => item.length > 0 && all.indexOf(item) === index)
    .slice(0, UNSUPPORTED_MAX);

  return {
    filters: {
      sector: sectorName ? sectorSlug(sectorName) : null,
      group,
      profitable,
      conditions: orderConditions([...byKey.values()]),
    },
    sort,
    dir,
    unsupported,
    dropped,
  };
}

/** Çip sırası sabit: alan sırası, sonra en az / en çok. */
function orderConditions(conditions: ScreenCondition[]): ScreenCondition[] {
  return [...conditions].sort(
    (a, b) => SCREEN_FIELDS.indexOf(a.field) - SCREEN_FIELDS.indexOf(b.field) || (a.op === "min" ? -1 : 1),
  );
}

export const hasFilters = (filters: ScreenFilters) =>
  Boolean(filters.sector || filters.group || filters.profitable || filters.conditions.length > 0);

/* ---------------------------------------------------------------------------
   Adres
   --------------------------------------------------------------------------- */

type SearchRecord = Record<string, string | string[] | undefined>;
const one = (value: string | string[] | undefined) => (typeof value === "string" ? value : null);

/**
 * Adresten süzgeçler — aynı aralık denetimiyle; elle yazılmış bozuk
 * parametre sessizce yok sayılır. Sektörün geçerliliğine sayfa bakar
 * (sektör listesi veriden geliyor).
 */
export function parseScreenParams(search: SearchRecord): ScreenFilters {
  const conditions: ScreenCondition[] = [];
  for (const field of SCREEN_FIELDS) {
    for (const op of ["min", "max"] as const) {
      const raw = one(search[`${FIELD_PARAM[field]}${op}`]);
      if (raw === null || raw.trim() === "") continue;
      const value = Number(raw);
      if (inRange(field, value)) conditions.push({ field, op, value: round2(value) });
    }
  }
  const group = one(search.grup);
  return {
    sector: one(search.sektor),
    group: group && group !== "diger" && sectorGroupByKey(group) ? group : null,
    profitable: one(search.karli) === "1",
    conditions,
  };
}

/** Süzgeçleri adres parametrelerine yazar (sıra sabit — aynı süzgeç aynı adres). */
export function writeScreenParams(params: URLSearchParams, filters: ScreenFilters): URLSearchParams {
  if (filters.sector) params.set("sektor", filters.sector);
  if (filters.group) params.set("grup", filters.group);
  if (filters.profitable) params.set("karli", "1");
  for (const c of orderConditions(filters.conditions)) params.set(`${FIELD_PARAM[c.field]}${c.op}`, String(c.value));
  return params;
}

/** Çevirinin açtığı adresin sorgusu — `/tarama?` sonrası. */
export function translationQuery(translation: Translation, sentence: string): string {
  const params = new URLSearchParams({
    sirala: translation.sort ?? "cap",
    yon: translation.dir ?? "desc",
  });
  writeScreenParams(params, translation.filters);
  params.set("cumle", sentence.replace(/\s+/g, " ").trim().slice(0, QUERY_MAX));
  return params.toString();
}

/** Bir süzgeci çıkarılmış kopya — çipin "kaldır" bağlantısı. */
export function withoutFilter(
  filters: ScreenFilters,
  remove: { kind: "sector" } | { kind: "group" } | { kind: "profitable" } | { kind: "condition"; field: ScreenField; op: ScreenOp },
): ScreenFilters {
  switch (remove.kind) {
    case "sector":
      return { ...filters, sector: null };
    case "group":
      return { ...filters, group: null };
    case "profitable":
      return { ...filters, profitable: false };
    case "condition":
      return {
        ...filters,
        conditions: filters.conditions.filter((c) => !(c.field === remove.field && c.op === remove.op)),
      };
  }
}

/* ---------------------------------------------------------------------------
   Süzme — tarayıcının kendi mantığı
   --------------------------------------------------------------------------- */

export type ScreenSubject = {
  /** GICS ana sektörü (ham ad). */
  sector: string;
  /** Alt sektör grubunun anahtarı. */
  group: string;
  /** Canlı fiyattan kurulmuş F/K; kurulamadıysa null. */
  fk: number | null;
  /** Piyasa değeri, dolar. */
  cap: number | null;
  metrics: {
    epsTTM: number | null;
    revenueGrowthTTMYoy: number | null;
    epsGrowthTTMYoy: number | null;
    netProfitMarginTTM: number | null;
    roeTTM: number | null;
    debtToEquity: number | null;
    currentRatio: number | null;
  };
};

/** Alanın satırdaki değeri — bilinmiyorsa null (ve null hiçbir eşikten GEÇMEZ). */
export function fieldValue(field: ScreenField, row: ScreenSubject): number | null {
  const m = row.metrics;
  switch (field) {
    case "pe":
      return row.fk;
    case "revenueGrowth":
      return m.revenueGrowthTTMYoy;
    case "epsGrowth":
      return m.epsGrowthTTMYoy;
    case "netMargin":
      return m.netProfitMarginTTM;
    case "roe":
      return m.roeTTM;
    case "debtToEquity":
      /* Negatif özkaynak oranı anlamsızlaştırıyor (tablodaki sütunla aynı). */
      return m.debtToEquity !== null && m.debtToEquity >= 0 ? m.debtToEquity : null;
    case "currentRatio":
      return m.currentRatio;
    case "marketCap":
      return row.cap !== null ? row.cap / 1e9 : null;
  }
}

/**
 * Satır süzgeçlerden geçiyor mu. Bilinmeyen ölçü eşiği karşılamış
 * sayılmaz: "borcu az" diyen okura borcu ölçülmemiş şirket gösterilmez.
 * Sektörü sayfa ayrıca süzüyor (veriden gelen sektör listesiyle).
 */
export function matchesScreenFilters(row: ScreenSubject, filters: ScreenFilters): boolean {
  if (filters.group && row.group !== filters.group) return false;
  if (filters.profitable && !(row.metrics.epsTTM !== null && row.metrics.epsTTM > 0)) return false;
  for (const c of filters.conditions) {
    const value = fieldValue(c.field, row);
    if (value === null) return false;
    if (c.op === "min" ? value < c.value : value > c.value) return false;
  }
  return true;
}
