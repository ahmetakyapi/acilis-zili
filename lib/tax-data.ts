import { cache } from "react";
import { unstable_cache } from "next/cache";
import { db } from "./db";
import { taxTariffs } from "./schema";
import { TAX_YEARS, withFetchedTariffs, type TaxBracket, type TaxYearRules } from "./tax";

/**
 * Hesaplayıcının yılları: koddakiler + GİB'den otomatik okunan yeniler
 * (28 Eylül). Günde bir değişebiliyor; cron yeni yıl yazınca etiketi
 * tazeliyor. Tablo yoksa ya da veritabanı düşmüşse yalnızca koddaki yıllar
 * — hata önbelleğin DIŞINDA yakalanıyor ki boş liste saklanmasın.
 */
export const TAX_TARIFFS_TAG = "tax-tariffs";

const loadFetched = unstable_cache(
  async () =>
    (await db.select({ year: taxTariffs.year, brackets: taxTariffs.brackets }).from(taxTariffs)).map((row) => ({
      year: row.year,
      brackets: row.brackets as TaxBracket[],
    })),
  ["tax-tariffs-v1"],
  { revalidate: 86_400, tags: [TAX_TARIFFS_TAG] },
);

export const getTaxYears = cache(async function getTaxYears(): Promise<Record<number, TaxYearRules>> {
  try {
    return withFetchedTariffs(TAX_YEARS, await loadFetched());
  } catch (error) {
    console.error(`[vergi] tarife tablosu okunamadı: ${error instanceof Error ? error.message : String(error)}`);
    return TAX_YEARS;
  }
});
