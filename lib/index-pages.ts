import type { Locale } from "./i18n/config";

/**
 * Endeks bileşen sayfaları — `/piyasalar/sp-500`, `/piyasalar/nasdaq-100`,
 * `/piyasalar/dow-jones` (14 Kasım 2026, SEO denetimi ikinci tur).
 *
 * NEDEN: üç endeksin bileşen listesi `/piyasalar?endeks=sp500` gibi sorgu
 * adreslerinde yaşıyordu ve üçünün canonical'ı `/piyasalar`dı; "s&p 500
 * hisseleri" aramasının sitede gösterilecek bir adresi yoktu. Her endeks
 * artık kendi yolunda, kendi başlığı, canonical'ı ve hreflang'iyle. Eski
 * sorgu adresleri KALICI (308) yönlendirmeyle yenisine gider
 * (`legacyIndexTarget`; yönlendirmeyi `/piyasalar` sayfası yapar, çünkü
 * `next.config.ts → redirects()` sorgu değerini hedefe de taşır ve
 * `/piyasalar/sp-500?endeks=sp500` gibi ikinci bir adres üretirdi).
 *
 * SAF MODÜL, TOHUMSUZ. Üye listeleri (`db/seed/indices`, 71 KB)
 * `components/markets/index-shared.ts`te; site haritası, `llms.txt` ve
 * yönlendirme yalnız adı ve adresi ister. `key` eski sorgu değeri ve
 * `INDEX_TABS` anahtarıyla aynı; sıra da aynı (testi `tests/index-pages.test.ts`).
 */
export const INDEX_PAGES = [
  { key: "nasdaq", slug: "nasdaq-100", name: "Nasdaq 100" },
  { key: "sp500", slug: "sp-500", name: "S&P 500" },
  { key: "dow", slug: "dow-jones", name: "Dow Jones" },
] as const;

export type IndexPage = (typeof INDEX_PAGES)[number];
export type IndexPageKey = IndexPage["key"];

export const MARKETS_PATH = "/piyasalar";

export const INDEX_PAGE_SLUGS: readonly string[] = INDEX_PAGES.map((page) => page.slug);

/** Dil öneksiz yol: `/piyasalar/sp-500`. */
export function indexPagePath(key: IndexPageKey): string {
  return `${MARKETS_PATH}/${INDEX_PAGES.find((page) => page.key === key)!.slug}`;
}

export function indexPageBySlug(slug: string): IndexPage | null {
  return INDEX_PAGES.find((page) => page.slug === slug) ?? null;
}

type Search = Record<string, string | string[] | undefined>;

/** Sorgu dizesi; boş değer ve dizi (tekrarlanan anahtar) taşınmaz. */
function queryOf(search: Search, drop: string): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    if (key === drop || typeof value !== "string" || value === "") continue;
    query.set(key, value);
  }
  const text = query.toString();
  return text ? `?${text}` : "";
}

/**
 * Eski `?endeks=` adresinin yeni karşılığı (dil öneksiz); eski bir adres
 * değilse `null`. Öteki parametreler (sıralama, derinlik, sektör sıralaması)
 * korunur, `endeks` düşer: yönlendirme TEK adımda temiz adrese iner.
 * Tanınmayan değer (`?endeks=xyz`) yönlendirilmez; kök varsayılanıyla açılır.
 */
export function legacyIndexTarget(search: Search): string | null {
  const page = INDEX_PAGES.find((entry) => entry.key === search.endeks);
  return page ? `${indexPagePath(page.key)}${queryOf(search, "endeks")}` : null;
}

/**
 * Başlık, açıklama ve `h1`.
 *
 * Başlık + kök şablonun marka eki (" · Açılış Zili" 14, " · Opening Bell" 15)
 * 65 karakteri aşmaz; açıklama 110–160 (test ölçüyor). Açıklama tablonun
 * GERÇEKTEN yaptığını söyler: sıralama anahtarları değişim, fiyat, ad,
 * piyasa değeri ve haftalık (`SORT_KEYS`); sektöre göre sıralama YOK, o
 * yüzden yazılmadı.
 */
export function indexPageCopy(
  page: IndexPage,
  locale: Locale,
): { title: string; description: string; heading: string } {
  const { name } = page;
  return locale === "en"
    ? {
        title: `${name} Stocks: Constituents and Daily Change`,
        description: `Full list of ${name} companies with price, daily change and market cap; sortable by change or market cap, 15-minute delayed.`,
        heading: `${name} Stocks`,
      }
    : {
        title: `${name} Hisseleri: Bileşenler ve Günlük Değişim`,
        description: `${name} endeksindeki şirketlerin tam listesi: fiyat, günlük değişim ve piyasa değeri; değişime ya da piyasa değerine göre sıralanabilir, 15 dakika gecikmeli.`,
        heading: `${name} Hisseleri`,
      };
}

/** Özetin anlattığı pencere — `themePhase` (lib/theme-stats.ts) ile aynı üçlü. */
export type IndexSummaryPhase = "day" | "pre-market" | "lastClose";

/**
 * Sayfanın ilk cümlesi: kaç şirket yükseldi, kaç şirket düştü.
 *
 * YALNIZ ELDEKİ VERİDEN ve yalnız HANGİ SEANSI anlattığı biliniyorsa (Veri
 * dürüstlüğü 4). `breadth` verilmezse (kotasyon yok, bayat paket ya da
 * üyelerin yüzdeleri iki ayrı güne ait) sayı YAZILMAZ; cümle listenin ne
 * olduğunu söyler. Sayılar "Yükselenlerin Payı" bloğunun sayılarıyla aynı
 * kaynaktan gelir (çağıran aynı sayacı verir), payda da onunki: değişimi
 * bilinen şirket. Payda üye sayısından azsa cümle bunu söyler.
 *
 * "N tanesi" kalıbı bilerek: "212'si / 213'ü / 216'sı" eki sayıya göre
 * değişiyor; "tanesi" her sayıda doğru (`yazim.md`: "819 şirketin 60 tanesi").
 */
export function indexSummary({
  name,
  members,
  breadth,
  locale,
}: {
  name: string;
  /** Endeksin sitede listelenen üye sayısı. */
  members: number;
  breadth: { counted: number; advancing: number; declining: number; phase: IndexSummaryPhase } | null;
  locale: Locale;
}): string {
  if (!breadth || breadth.counted <= 0) {
    return locale === "en"
      ? `All ${members} ${name} companies in one list: price, daily change, weekly change and market cap.`
      : `${name} endeksindeki ${members} şirket tek listede: fiyat, günlük değişim, haftalık değişim ve piyasa değeri.`;
  }
  const { counted, advancing, declining, phase } = breadth;
  const full = counted >= members;
  if (locale === "en") {
    const subject = full
      ? `${advancing} of the ${members} ${name} companies`
      : `${advancing} of the ${counted} ${name} companies with a quote`;
    return phase === "lastClose"
      ? `${subject} rose at the last close and ${declining} fell.`
      : phase === "pre-market"
        ? `${subject} are up in pre-market trading and ${declining} are down.`
        : `${subject} are up in today's session and ${declining} are down.`;
  }
  const subject = full
    ? `${name} endeksindeki ${members} şirketin ${advancing} tanesi`
    : `${name} endeksinde değişimi bilinen ${counted} şirketin ${advancing} tanesi`;
  return phase === "lastClose"
    ? `${subject} son kapanışta yükseldi, ${declining} tanesi düştü.`
    : phase === "pre-market"
      ? `${subject} açılış öncesi işlemlerde artıda, ${declining} tanesi ekside.`
      : `${subject} bugünkü seansta artıda, ${declining} tanesi ekside.`;
}
