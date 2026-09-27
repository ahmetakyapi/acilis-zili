import { addEtDays } from "@/lib/market-hours";
import { isNewObservation } from "@/lib/day-flow";
import {
  fail,
  ok,
  type MacroObservation,
  type MacroSeriesData,
  type ProviderResult,
  responseDate,
} from "./types";
import { withTimeout } from "./timeout";

/**
 * FRED (St. Louis Fed) — makro göstergelerin resmî değerleri.
 *
 * Ekonomik takvimin "beklenti" tarafı seed tablosundan gelir; "gerçekleşen"
 * tarafı buradan. Böylece veri açıklandığı anda karta gerçek rakam işlenir.
 */

const BASE = "https://api.stlouisfed.org/fred";

function apiKey(): string | null {
  return process.env.FRED_API_KEY ?? null;
}

export function isFredConfigured(): boolean {
  return apiKey() !== null;
}

/**
 * Takip edilen seriler.
 * `units: "pc1"` FRED'e yıllık yüzde değişimi hesaplatır — endeks değerini
 * kendimiz orana çevirmeyiz, kaynak ne diyorsa o gösterilir.
 *
 * TİP AÇIKÇA YAZILI (28 Eylül). Dizi `as const` idi ve ilk altı seri aynı
 * alanları taşıdığı için sorun çıkmıyordu; `divisor` ve `digits` yalnızca
 * bazı serilerde var ve `as const` birleşiminde o alanlara erişmek derleme
 * hatası veriyordu. Tüketiciler (tohum, cron, gün akışı) alanları adıyla
 * okuyor, dizinin sırasına değil; yeni seriler SONA eklendi.
 */
export type MacroSeriesDefinition = SeriesRequest & {
  unit: string;
  titleTr: string;
  titleEn: string;
  /**
   * Gözlem sıklığı. Kart künyesi buna göre yazılır: aylık seri "Ağustos
   * 2026", haftalık seri "20 Eyl 2026 ile Biten Hafta", günlük seri tam
   * tarih. Haftalık İşsizlik Başvuruları ay etiketiyle ("Eylül 2026")
   * basılsaydı hangi haftanın okunduğu kaybolurdu.
   */
  frequency: "monthly" | "weekly" | "daily";
  /** Ekrandaki ondalık hane; verilmezse yüzde 2, öteki birimler 0. */
  digits?: number;
};

export const MACRO_SERIES: readonly MacroSeriesDefinition[] = [
  {
    seriesId: "CPIAUCSL",
    slug: "cpi",
    units: "pc1",
    unit: "%",
    frequency: "monthly",
    titleTr: "TÜFE (Yıllık)",
    titleEn: "CPI (Year over Year)",
  },
  {
    seriesId: "CPILFESL",
    slug: "core-cpi",
    units: "pc1",
    unit: "%",
    frequency: "monthly",
    titleTr: "Çekirdek TÜFE (Yıllık)",
    titleEn: "Core CPI (Year over Year)",
  },
  {
    seriesId: "UNRATE",
    slug: "unemployment",
    units: "lin",
    unit: "%",
    frequency: "monthly",
    titleTr: "İşsizlik Oranı",
    titleEn: "Unemployment Rate",
  },
  {
    seriesId: "FEDFUNDS",
    slug: "fed-funds",
    units: "lin",
    unit: "%",
    frequency: "monthly",
    titleTr: "Fed Politika Faizi",
    titleEn: "Fed Funds Rate",
  },
  {
    seriesId: "PCEPILFE",
    slug: "core-pce",
    units: "pc1",
    unit: "%",
    frequency: "monthly",
    titleTr: "Çekirdek PCE (Yıllık)",
    titleEn: "Core PCE (Year over Year)",
  },
  {
    seriesId: "PAYEMS",
    slug: "payrolls",
    units: "chg",
    unit: "bin",
    frequency: "monthly",
    titleTr: "Tarım Dışı İstihdam (Aylık Değişim)",
    titleEn: "Nonfarm Payrolls (Monthly Change)",
  },
  /* ---- 28 Eylül: ikinci halka ----
     Altı seri enflasyon, iş gücü ve politikayı anlatıyordu; tüketim, para
     arzı ve resesyon sinyali yoktu. Beşi de FRED'de ve aynı yoldan geliyor:
     tohum satırı açar, cron doldurur, /makro satır yoksa canlı okur
     (lib/macro-data.ts). */
  {
    /* FRED kişi sayısı veriyor (231000); takvim ve gün akışı bin kişiyle
       çalışıyor. Bölen BURADA, `getSeries` içinde uygulanıyor ki önbellek
       tablosu, takvimin gerçekleşen değeri ve ekran aynı birimi görsün. */
    seriesId: "ICSA",
    slug: "jobless-claims",
    units: "lin",
    unit: "bin",
    divisor: 1000,
    frequency: "weekly",
    titleTr: "Haftalık İşsizlik Başvuruları",
    titleEn: "Initial Jobless Claims",
  },
  {
    /* Düzey (milyon $) değil AYLIK DEĞİŞİM: piyasanın tepki verdiği sayı
       bu ve 700 milyarlık bir düzeyin yanında "▲ 3.912" okunmuyor. */
    seriesId: "RSAFS",
    slug: "retail-sales",
    units: "pch",
    unit: "%",
    frequency: "monthly",
    titleTr: "Perakende Satışlar (Aylık Değişim)",
    titleEn: "Retail Sales (Monthly Change)",
  },
  {
    seriesId: "M2SL",
    slug: "m2",
    units: "pc1",
    unit: "%",
    frequency: "monthly",
    titleTr: "M2 Para Arzı (Yıllık)",
    titleEn: "M2 Money Supply (Year over Year)",
  },
  {
    /* Birim yüzde PUANI, yüzde değil: gösterge bir işsizlik oranı değil,
       iki oranın farkı. Eşik (0,50) kartın künyesinde anlatılıyor. */
    seriesId: "SAHMREALTIME",
    slug: "sahm-rule",
    units: "lin",
    unit: "puan",
    digits: 2,
    frequency: "monthly",
    titleTr: "Sahm Kuralı Göstergesi",
    titleEn: "Sahm Rule Indicator",
  },
  {
    /* 10 yıl − 3 ay: Fed'in resesyon araştırmalarında kullandığı fark.
       Makro kapağındaki eğri 10 − 2 yıllık; ikisi ayrı ölçüler ve kart
       adı hangi iki vadeden kurulduğunu söylüyor. Günlük seri. */
    seriesId: "T10Y3M",
    slug: "curve-10y3m",
    units: "lin",
    unit: "puan",
    digits: 2,
    frequency: "daily",
    titleTr: "10 Yıl ile 3 Ay Faiz Farkı",
    titleEn: "10-Year Minus 3-Month Spread",
  },
];

async function fredFetch<T>(
  path: string,
  params: Record<string, string>,
  opts: { revalidate: number; tags?: string[]; forceRefresh?: boolean },
): Promise<ProviderResult<T>> {
  const key = apiKey();
  if (!key) {
    return fail("fred", "missing-key", "FRED_API_KEY tanımlı değil");
  }

  const url = `${BASE}${path}?${new URLSearchParams({
    ...params,
    api_key: key,
    file_type: "json",
  }).toString()}`;

  try {
    /* Süre sınırı — gerekçe lib/providers/timeout.ts'te. */
    const res = await withTimeout(
      fetch(url, {
        headers: { accept: "application/json" },
        ...(opts.forceRefresh
          ? { cache: "no-store" as const }
          : { next: { revalidate: opts.revalidate, tags: opts.tags } }),
      }),
    );

    if (res.status === 429) {
      return fail("fred", "rate-limited", "FRED istek limiti aşıldı");
    }
    if (!res.ok) {
      return fail("fred", "upstream-error", `FRED ${res.status}`);
    }

    return ok((await res.json()) as T, "fred", {
      fetchedAt: responseDate(res),
    });
  } catch (error) {
    return fail(
      "fred",
      "network",
      error instanceof Error ? error.message : "FRED'e ulaşılamadı",
    );
  }
}

type RawObservations = {
  observations?: { date: string; value: string }[];
};

/** getSeries'in ihtiyaç duyduğu asgari alanlar — tahvil gibi geçici seriler
    MACRO_SERIES'e girmeden bu şekille sorgulanabilir. */
export type SeriesRequest = {
  seriesId: string;
  slug: string;
  units: string;
  /** Kaynağın birimini ekranın birimine çeviren bölen (ICSA: kişi → bin). */
  divisor?: number;
};

/** Günlük kapanışlar: ana sayfa, Makro ve alt şerit aynı politikayı kullanır. */
export const DAILY_MARKET_SERIES: SeriesRequest[] = [
  { seriesId: "DGS2", slug: "yield-2y", units: "lin" },
  { seriesId: "DGS5", slug: "yield-5y", units: "lin" },
  { seriesId: "DGS10", slug: "yield-10y", units: "lin" },
  { seriesId: "DGS30", slug: "yield-30y", units: "lin" },
  { seriesId: "VIXCLS", slug: "vix", units: "lin" },
];

export async function getSeries(
  definition: SeriesRequest,
  limit = 60,
  options: { forceRefresh?: boolean } = {},
): Promise<ProviderResult<MacroSeriesData>> {
  const daily = DAILY_MARKET_SERIES.some((series) => series.seriesId === definition.seriesId);
  // Tatillerde son iki ham kayıt boş olabilir. Ortak pencere, ekranların
  // farklı limitlerle birbirinden kopuk önbellekler tutmasını da önler.
  const fetchLimit = daily ? Math.max(30, limit) : limit;
  const result = await fredFetch<RawObservations>(
    "/series/observations",
    {
      series_id: definition.seriesId,
      units: definition.units,
      sort_order: "desc",
      limit: String(fetchLimit),
    },
    { revalidate: daily ? 3600 : 21600, tags: ["macro", `macro:${definition.slug}`], forceRefresh: options.forceRefresh },
  );
  if (!result.ok) return result;

  const raw = result.data?.observations ?? [];
  // FRED eksik gözlemleri "." olarak yollar.
  const observations: MacroObservation[] = raw
    .filter((o) => o.value !== "." && o.value.trim() !== "")
    .map((o) => ({ date: o.date, value: Number(o.value) / (definition.divisor ?? 1) }))
    .filter((o) => Number.isFinite(o.value))
    .reverse();

  if (observations.length === 0) {
    return fail("fred", "empty", `${definition.seriesId} için gözlem yok`);
  }

  const latest = observations[observations.length - 1];
  const prev = observations[observations.length - 2] ?? null;

  return ok(
    {
      seriesId: definition.seriesId,
      observations: observations.slice(-limit),
      latestValue: latest.value,
      prevValue: prev?.value ?? null,
      periodLabel: latest.date.slice(0, 7),
    },
    "fred",
    { fetchedAt: result.fetchedAt },
  );
}

type RawSeriesRelease = {
  releases?: { id: number; name: string }[];
};

/**
 * Bir serinin bağlı olduğu FRED yayını.
 *
 * Yayın kimlikleri (CPI = 10, Employment Situation = 50 …) koda GÖMÜLMÜYOR:
 * doğrulayamadığımız bir sabiti yazmak, uydurma tarih yazmakla aynı kapıya
 * çıkar. Zaten kullandığımız seri kimliğinden çalışma anında türetiliyor.
 */
export async function getSeriesRelease(
  seriesId: string,
): Promise<ProviderResult<{ id: number; name: string }>> {
  const result = await fredFetch<RawSeriesRelease>(
    "/series/release",
    { series_id: seriesId },
    { revalidate: 604800, tags: ["macro-releases"] },
  );
  if (!result.ok) return result;

  const release = result.data?.releases?.[0];
  if (!release || typeof release.id !== "number") {
    return fail("fred", "empty", `${seriesId} için yayın bulunamadı`);
  }
  return ok({ id: release.id, name: release.name ?? "" }, "fred", {
    fetchedAt: result.fetchedAt,
  });
}

type RawReleaseDates = {
  release_dates?: { release_id: number; date: string }[];
};

/**
 * Bir FRED yayınının ilan edilmiş tarihleri.
 * Seed takvimindeki tarihleri doğrulamak için kullanılır.
 */
export async function getReleaseDates(
  releaseId: number,
  from: string,
  to: string,
): Promise<ProviderResult<string[]>> {
  const result = await fredFetch<RawReleaseDates>(
    "/release/dates",
    {
      release_id: String(releaseId),
      realtime_start: from,
      realtime_end: to,
      include_release_dates_with_no_data: "true",
      sort_order: "asc",
    },
    { revalidate: 86400, tags: ["macro-releases"] },
  );
  if (!result.ok) return result;

  const dates = (result.data?.release_dates ?? []).map((d) => d.date);
  if (dates.length === 0) {
    return fail("fred", "empty", "Yayın tarihi dönmedi");
  }
  return ok(dates, "fred", { fetchedAt: result.fetchedAt });
}

/**
 * Gün içi yayın kontrolü: sadece saat geçti diye son gözlemi kullanmayız.
 * Olay gününün vintage'ını bir önceki günle karşılaştırırız; en yeni gözlem
 * tarihi ilerlemediyse sonuç henüz doğrulanmamıştır. Revizyon tek başına
 * yeni açıklama sayılmaz. FEDFUNDS aylık ortalaması FOMC kararını temsil
 * etmediğinden burada desteklenmez.
 * https://fred.stlouisfed.org/docs/api/fred/series_observations.html
 */
export async function getReleasedObservation(seriesId: string, dateEt: string) {
  /* ICSA bir dönem burada elle tanımlanıyordu çünkü MACRO_SERIES'te yoktu;
     artık orada ve böleni de tanımında. */
  const definition = MACRO_SERIES.find((entry) => entry.seriesId === seriesId && entry.seriesId !== "FEDFUNDS");
  if (!definition) return null;
  const read = (date: string, revalidate: number) => fredFetch<RawObservations>(
    "/series/observations",
    { series_id: seriesId, units: definition.units, sort_order: "desc", limit: "3", realtime_start: date, realtime_end: date },
    { revalidate, tags: ["day-flow"] },
  );
  const [current, previous] = await Promise.all([read(dateEt, 60), read(addEtDays(dateEt, -1), 86400)]);
  if (!current.ok || !previous.ok) return null;
  const valid = (data: RawObservations) => (data.observations ?? []).filter((point) =>
    point.value.trim() !== "" && point.value !== "." && Number.isFinite(Number(point.value)));
  const points = valid(current.data);
  if (!isNewObservation(points[0]?.date, valid(previous.data)[0]?.date)) return null;
  // ICSA kişi sayısı; takvim birimi bin kişi (bölen tanımda). PAYEMS zaten bin birimindedir.
  const divisor = definition.divisor ?? 1;
  return {
    actual: String(Number(points[0].value) / divisor),
    previous: points[1] ? String(Number(points[1].value) / divisor) : null,
    fetchedAt: current.fetchedAt,
  };
}
