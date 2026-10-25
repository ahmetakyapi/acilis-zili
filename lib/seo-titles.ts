import type { Locale } from "./i18n/config";

/**
 * Arama sonucu başlıkları — hisse ve bilanço analizi sayfaları (25 Ekim).
 *
 * NEDEN: Search Console'un ilk on gününde (14–24 Ekim) bu iki sayfa tipi
 * sitenin gösterimlerinin üçte birini aldı (EN analiz 862, hisse 513) ve
 * TEK tık getirmedi. Başlıklar yalnız ad + dönem + sembol diyordu
 * ("Nebius Group Q2 2026 (NBIS)"); arayan kişinin sorduğu şeyi —
 * "sonuçlar", "hisse", "stock" — taşımıyordu. Sorgular bunu gösteriyor:
 * "mstr hisse", "ge vernova hisse", "nebius second quarter 2026 results".
 *
 * KURAL: başlık sayfanın GERÇEKTEN gösterdiğini söyler, vaat etmez. "Yorum",
 * "al-sat", "hedef" gibi tavsiye çağrıştıran kelime yok (sayfada görüş
 * duruyor ama arama sonucunda tavsiye vaadi gibi okunuyor).
 *
 * UZUNLUK: Google başlığı ~60 karakterde (yaklaşık 580 piksel) kesiyor.
 * Kök şablon sona " · Açılış Zili" ekliyor; marka kesilebilir, anahtar
 * kısım kesilmemeli. Bu yüzden markasız kısım `TITLE_BUDGET`ı aşarsa daha
 * kısa kalıba düşülür. Saf modül, `tests/seo-titles.test.ts` ölçüyor.
 */
export const TITLE_BUDGET = 60;

/** İlk sığan aday; hiçbiri sığmazsa en kısası (sonuncusu). */
function firstFitting(candidates: readonly string[]): string {
  return candidates.find((title) => title.length <= TITLE_BUDGET) ?? candidates[candidates.length - 1];
}

/**
 * Bilanço analizi: "Nebius Group (NBIS) 2Ç 2026 Bilanço Sonuçları".
 * Sembol şirket adının hemen yanında — aramada ikisi birlikte yazılıyor.
 */
export function analysisTitle(
  company: string,
  symbol: string,
  periodLabel: string,
  locale: Locale,
): string {
  const head = `${company} (${symbol}) ${periodLabel}`;
  return locale === "en"
    ? firstFitting([`${head} Earnings Results`, `${head} Earnings`, head])
    : firstFitting([`${head} Bilanço Sonuçları`, `${head} Bilançosu`, head]);
}

/**
 * Hisse ve fon sayfası.
 *
 * Fon için "Hisse" yanlış olur (fonun bilançosu da yok): ETF ve yalnız
 * fiyat + grafik. Sitedeki fonların hepsi borsa yatırım fonu
 * (`db/seed/symbols.ts` → `FUND_META`); adı zaten "ETF" içeriyorsa
 * ikinci kez yazılmaz.
 */
export function stockTitle(
  name: string,
  symbol: string,
  locale: Locale,
  { fund = false }: { fund?: boolean } = {},
): string {
  const head = `${name} (${symbol})`;
  if (fund) {
    const etf = /\bETF\b/i.test(name) ? head : `${head} ETF`;
    return locale === "en"
      ? firstFitting([`${etf}: Price and Chart`, etf, head])
      : firstFitting([`${etf}: Fiyat ve Grafik`, etf, head]);
  }
  return locale === "en"
    ? firstFitting([`${head} Stock: Price, Chart and Earnings`, `${head} Stock`, head])
    : /* Tamlama: "Nvidia (NVDA) Hissesi", "Hisse:" değil (25 Ekim). */
      firstFitting([`${head} Hissesi: Fiyat, Grafik ve Bilanço`, `${head} Hissesi`, head]);
}
