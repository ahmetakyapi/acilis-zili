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

/* ==========================================================================
   TOPLAM UZUNLUK: "UZUNSA MARKA EKİ DÜŞER" (14 Kasım 2026, SEO ikinci tur)

   Denetimde yedi sayfa tipinin `<title>`ı 65 karakteri aşıyordu (şirket
   bilanço sayfası 90, yatırımcı 85, mercek 84, bülten 80, günün grafiği 75,
   hisse 73, analiz dizini 68). Ortak neden: kök şablon her başlığa
   " · Açılış Zili" (14) / " · Opening Bell" (15) ekliyor ve başlığın kendisi
   zaten 55–70 karakter. Kural tek: başlık + ek 65'i aşıyorsa ek DÜŞER
   (`title: { absolute }`); başlığın kendisi kesilmez — manşet rutinin
   yazdığı metin, yarım kelimeyle bitmesi ekten kötü.

   Aday listesi verilirse (kalıbı bizim yazdığımız başlıklar) önce EKLE
   sığan ilk aday, yoksa eksiz sığan ilk aday, o da yoksa en kısası (son).
   Sayfalar bunu `lib/page-meta.ts` → `fittedTitle` üzerinden kullanır;
   burası saf ve testli.
   ========================================================================== */

/** `<title>` tavanı (karakter), marka eki dahil. */
export const TITLE_LIMIT = 65;

/** Kök şablonun eki — `app/layout.tsx` → `%s · ${brand}`; adlar sözlükle aynı (test denetler). */
export const BRAND_SUFFIX: Record<Locale, string> = {
  tr: " · Açılış Zili",
  en: " · Opening Bell",
};

export function fitTitle(
  candidates: string | readonly string[],
  locale: Locale,
): { text: string; branded: boolean } {
  const list = typeof candidates === "string" ? [candidates] : candidates;
  const room = TITLE_LIMIT - BRAND_SUFFIX[locale].length;
  const branded = list.find((title) => title.length <= room);
  if (branded !== undefined) return { text: branded, branded: true };
  return { text: list.find((title) => title.length <= TITLE_LIMIT) ?? list[list.length - 1], branded: false };
}

/**
 * Şirket adının kısa hâli: "NVIDIA Corp" → "NVIDIA", "Micron Technology
 * Inc" → "Micron Technology" (yalnız sondaki ek). Tüzel ek başlıkta yer tutmasın. Teknik analiz sayfasının
 * `<title>`ı, `h1`i ve JSON-LD başlığı AYNI kırpmayı okur (14 Kasım; kırpma
 * önce sayfanın `generateMetadata`ında satır içi yazılıydı).
 */
export function shortCompanyName(name: string | null | undefined): string {
  return (name ?? "")
    .replace(/,?\s+(Corporation|Corp\.?|Incorporated|Inc\.?|Holdings?|Technologies|Technology|Group|Company|Co\.?|Ltd\.?|PLC|plc|N\.?V\.?|S\.?A\.?)$/g, "")
    .replace(/,?\s+(Corporation|Corp\.?|Inc\.?|Holdings?)$/g, "")
    .trim();
}

/** "Nvidia (NVDA)"; ad yoksa ya da sembolün kendisiyse yalnız sembol. */
export function technicalSubject(name: string | null | undefined, symbol: string): string {
  const company = shortCompanyName(name);
  return company && company.toUpperCase() !== symbol.toUpperCase() ? `${company} (${symbol})` : symbol;
}

/** Teknik analiz sayfasının `h1`i ve JSON-LD başlığı: "Nvidia (NVDA) Teknik Analiz". */
export function technicalHeading(name: string | null | undefined, symbol: string, locale: Locale): string {
  return `${technicalSubject(name, symbol)} ${locale === "en" ? "Technical Analysis" : "Teknik Analiz"}`;
}

/**
 * Aynı başlığın sembolden ÖNCEKİ ve SONRAKİ kısmı: kapakta görünen kısım
 * yalnız sembol (36–48 punto, tek satır); gerisi `h1`in metnine ekran dışı
 * olarak girer (`TechnicalCover`). ["Nvidia (", ") Teknik Analiz"].
 */
export function technicalHeadingParts(
  name: string | null | undefined,
  symbol: string,
  locale: Locale,
): [before: string, after: string] {
  const heading = technicalHeading(name, symbol, locale);
  const tail = ` ${locale === "en" ? "Technical Analysis" : "Teknik Analiz"}`;
  const at = heading.slice(0, heading.length - tail.length).lastIndexOf(symbol);
  return [heading.slice(0, at), heading.slice(at + symbol.length)];
}

/** Teknik analiz `<title>` adayları — uzun adda "ve Hisse Yorumu" düşer. */
export function technicalTitles(name: string | null | undefined, symbol: string, locale: Locale): string[] {
  const subject = technicalSubject(name, symbol);
  return locale === "en"
    ? [`${subject} Technical Analysis and Outlook`, `${subject} Technical Analysis`]
    : [`${subject} Teknik Analiz ve Hisse Yorumu`, `${subject} Teknik Analiz`];
}

/** Bilanço raporunun `h1`i: "NVIDIA 1Ç FY2027 Bilanço Analizi". */
export function analysisHeading(company: string, periodLabel: string, locale: Locale): string {
  return `${company} ${periodLabel} ${locale === "en" ? "Earnings Analysis" : "Bilanço Analizi"}`;
}

/**
 * Yatırımcı sayfası `<title>` adayları. Uzun kurum adında ("Berkshire
 * Hathaway") tam kalıp 85 karaktere çıkıyordu; sırayla kısalır.
 */
export function investorTitles(
  name: string,
  firm: string,
  kind: "congress" | "fund" | string,
  locale: Locale,
): string[] {
  if (kind === "congress") {
    return locale === "en"
      ? [`${name} Stock Trades: Disclosed Buys and Sells`, `${name} Stock Trades: Buys and Sells`, `${name} Stock Trades`]
      : [`${name} Hisse İşlemleri: Bildirilen Alım ve Satışlar`, `${name} Hisse İşlemleri: Alım ve Satışlar`, `${name} Hisse İşlemleri`];
  }
  return locale === "en"
    ? [
        `${name} Portfolio: ${firm} Holdings, Buys and Sells`,
        `${name} Portfolio: ${firm} Holdings`,
        `${name} Portfolio: Holdings, Buys and Sells`,
        `${name} Portfolio`,
      ]
    : [
        `${name} Portföyü: ${firm} Hisseleri, Alım ve Satışlar`,
        `${name} Portföyü: ${firm} Hisseleri`,
        `${name} Portföyü: Hisseler, Alım ve Satışlar`,
        `${name} Portföyü`,
      ];
}
