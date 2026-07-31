import {
  fail,
  ok,
  type MacroObservation,
  type MacroSeriesData,
  type ProviderResult,
} from "./types";

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
 */
export const MACRO_SERIES = [
  {
    seriesId: "CPIAUCSL",
    slug: "cpi",
    units: "pc1",
    unit: "%",
    titleTr: "TÜFE (yıllık)",
    titleEn: "CPI (year over year)",
  },
  {
    seriesId: "CPILFESL",
    slug: "core-cpi",
    units: "pc1",
    unit: "%",
    titleTr: "Çekirdek TÜFE (yıllık)",
    titleEn: "Core CPI (year over year)",
  },
  {
    seriesId: "UNRATE",
    slug: "unemployment",
    units: "lin",
    unit: "%",
    titleTr: "İşsizlik oranı",
    titleEn: "Unemployment rate",
  },
  {
    seriesId: "FEDFUNDS",
    slug: "fed-funds",
    units: "lin",
    unit: "%",
    titleTr: "Fed politika faizi",
    titleEn: "Fed funds rate",
  },
  {
    seriesId: "PCEPILFE",
    slug: "core-pce",
    units: "pc1",
    unit: "%",
    titleTr: "Çekirdek PCE (yıllık)",
    titleEn: "Core PCE (year over year)",
  },
  {
    seriesId: "PAYEMS",
    slug: "payrolls",
    units: "chg",
    unit: "bin",
    titleTr: "Tarım dışı istihdam (aylık değişim)",
    titleEn: "Nonfarm payrolls (monthly change)",
  },
] as const;

export type MacroSeriesDefinition = (typeof MACRO_SERIES)[number];

async function fredFetch<T>(
  path: string,
  params: Record<string, string>,
  opts: { revalidate: number; tags?: string[] },
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
    const res = await fetch(url, {
      headers: { accept: "application/json" },
      next: { revalidate: opts.revalidate, tags: opts.tags },
    });

    if (res.status === 429) {
      return fail("fred", "rate-limited", "FRED istek limiti aşıldı");
    }
    if (!res.ok) {
      return fail("fred", "upstream-error", `FRED ${res.status}`);
    }

    return ok((await res.json()) as T, "fred");
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

export async function getSeries(
  definition: MacroSeriesDefinition,
  limit = 60,
): Promise<ProviderResult<MacroSeriesData>> {
  const result = await fredFetch<RawObservations>(
    "/series/observations",
    {
      series_id: definition.seriesId,
      units: definition.units,
      sort_order: "desc",
      limit: String(limit),
    },
    { revalidate: 21600, tags: ["macro", `macro:${definition.slug}`] },
  );
  if (!result.ok) return result;

  const raw = result.data?.observations ?? [];
  // FRED eksik gözlemleri "." olarak yollar.
  const observations: MacroObservation[] = raw
    .filter((o) => o.value !== "." && o.value !== "")
    .map((o) => ({ date: o.date, value: Number(o.value) }))
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
      observations,
      latestValue: latest.value,
      prevValue: prev?.value ?? null,
      periodLabel: latest.date.slice(0, 7),
    },
    "fred",
    { fetchedAt: result.fetchedAt },
  );
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
