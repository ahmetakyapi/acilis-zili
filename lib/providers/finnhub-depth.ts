import { finnhubFetch } from "./finnhub";
import { fail, ok, type ProviderResult } from "./types";
import type { RawInsiderRow } from "@/lib/insider";

/**
 * Hisse sayfasının derinlik panelleri için Finnhub uçları.
 *
 * Üçü de ücretsiz katmanda açık (28 Eylül'de denendi): `/stock/insider-
 * transactions`, `/stock/insider-sentiment`, `/stock/metric`. Kapalı olanlar
 * (`/stock/upgrade-downgrade`, `/stock/price-target`, `/stock/dividend`,
 * `/stock/revenue-breakdown`) 403 dönüyor; onları isteyen bir panel yok.
 */

/**
 * İçeriden işlemlerin tazeliği. Form 4 işlemden sonraki İKİ iş günü içinde
 * dosyalanıyor, yani veri zaten günlük ritimde geliyor; altı saat bir
 * dosyanın ekrana en geç yarım iş gününde düşmesi demek. Sembol başına tek
 * istek ve sayfa önbelleği sunucuda ortak: ziyaretle artmıyor.
 */
const INSIDER_REVALIDATE_S = 6 * 60 * 60;

type RawInsiderResponse = {
  data?: {
    name?: string;
    share?: number | null;
    change?: number | null;
    filingDate?: string | null;
    transactionDate?: string | null;
    transactionCode?: string | null;
    transactionPrice?: number | null;
    id?: string | null;
    isDerivative?: boolean | null;
  }[];
};

export async function getInsiderTransactions(
  symbol: string,
  from: string,
): Promise<ProviderResult<RawInsiderRow[]>> {
  const result = await finnhubFetch<RawInsiderResponse>(
    "/stock/insider-transactions",
    { symbol, from },
    { revalidate: INSIDER_REVALIDATE_S, tags: [`insider:${symbol}`] },
  );
  if (!result.ok) return result;
  const rows = (result.data?.data ?? []).map((row) => ({
    name: row.name?.trim() || "?",
    share: row.share ?? null,
    change: row.change ?? null,
    filingDate: row.filingDate ?? null,
    transactionDate: row.transactionDate ?? null,
    transactionCode: row.transactionCode ?? null,
    transactionPrice: row.transactionPrice ?? null,
    id: row.id ?? null,
    isDerivative: row.isDerivative ?? null,
  }));
  return ok(rows, "finnhub", { fetchedAt: result.fetchedAt });
}

export type InsiderSentimentRow = {
  year: number;
  month: number;
  change: number | null;
  mspr: number | null;
};

export async function getInsiderSentiment(
  symbol: string,
  from: string,
  to: string,
): Promise<ProviderResult<InsiderSentimentRow[]>> {
  const result = await finnhubFetch<{ data?: InsiderSentimentRow[] }>(
    "/stock/insider-sentiment",
    { symbol, from, to },
    { revalidate: INSIDER_REVALIDATE_S, tags: [`insider-sentiment:${symbol}`] },
  );
  if (!result.ok) return result;
  return ok(result.data?.data ?? [], "finnhub", { fetchedAt: result.fetchedAt });
}

/**
 * `/stock/metric?metric=all`in HAM alan sözlüğü.
 *
 * `getKeyMetrics` aynı ucun on bir alanını ekranın tipine çeviriyor; skor
 * kartı başka alanlar istiyor (büyüme, faaliyet marjı, cari oran). Aynı
 * adres, aynı parametre sırası ve aynı `revalidate` ile çağrılıyor: Next'in
 * veri önbelleği anahtarı adresten kuruluyor, yani sayfada iki fonksiyon da
 * çağrılsa sağlayıcıya bir kez gidiliyor.
 */
export async function getRawMetrics(
  symbol: string,
): Promise<ProviderResult<Record<string, unknown>>> {
  const result = await finnhubFetch<{ metric?: Record<string, unknown> }>(
    "/stock/metric",
    { symbol, metric: "all" },
    { revalidate: 86400, tags: [`metrics:${symbol}`] },
  );
  if (!result.ok) return result;
  const metric = result.data?.metric;
  if (!metric || Object.keys(metric).length === 0) {
    return fail("finnhub", "empty", "Metrik verisi yok");
  }
  return ok(metric, "finnhub", { fetchedAt: result.fetchedAt });
}
