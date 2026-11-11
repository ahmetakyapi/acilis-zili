import { DEFAULT_LOCALE, LOCALES } from "./i18n/config";

/**
 * ESKİ ADRESLER → YENİ ADRESLER (11 Kasım 2026).
 *
 * Sahibinin isteği: "`/gun` … böyle path isimleri saçma, her path ismini
 * mantıklı ve düzgün yapalım." Kısaltma ya da iç takma ad olan altı rota
 * okurun anlayacağı adla yeniden adlandırıldı. Eski adresler ÖLMÜYOR:
 * arama motorunun dizini, paylaşılmış bağlantılar, rutinlerin eski
 * yazılarındaki iç bağlantılar ve sosyal medyada duran paylaşım görselleri
 * (`/gun/2026-10-23/kart`, `/gun/bugun/kart`) hepsi bu adlara bağlı. Her
 * biri KALICI (308) yönlendirmeyle, alt yoluyla ve sorgu dizesiyle
 * (`?bicim=dikey`) birlikte yeni adresine TEK ADIMDA gider.
 *
 * NEDEN `next.config.ts → redirects()` VE `proxy.ts` DEĞİL: Next 16'nın
 * yürütme sırası `headers → redirects → proxy → dosya sistemi`
 * (node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/
 * proxy.md → "Execution order"). Yapılandırma yönlendirmesi proxy'den ÖNCE
 * koşuyor; yani `/en/gun/...` dil önekinin yeniden yazılmasına, çerez
 * yönlendirmesine ya da oturum kapısına hiç girmeden tek 308 ile
 * `/en/seans-silueti/...`e gidiyor. Proxy'ye koysaydık her istekte koşan
 * fonksiyona bir tablo taraması eklerdik ve `/en/...` için önce dil, sonra
 * ad diye iki adımlı zincir riski doğardı. Sorgu dizesini Next kendisi
 * taşıyor (redirects.md: "query values … will be passed through").
 *
 * EŞLEME SAF ve testli (`tests/route-redirects.test.ts`): kurallar bu
 * tablodan üretiliyor, test de aynı tablonun eski→yeni çevirisini sınıyor.
 * Yeni bir yeniden adlandırma buraya satır ekler; eski satır SİLİNMEZ
 * (paylaşılmış bağlantı yıllarca yaşar).
 *
 * DOKUNULMAYANLAR: `/api/teknik` (Teknik Analist rutininin yazma ucu) ve
 * `/api/cron/risk` adları aynı kaldı — `/api` altı bu tabloya girmez,
 * rutin promptları ve cron kayıtları değişmesin diye.
 */
export const RENAMED_ROUTES = [
  { from: "/gun", to: "/seans-silueti" },
  { from: "/teknik", to: "/teknik-analiz" },
  { from: "/tema", to: "/temalar" },
  { from: "/u", to: "/uye" },
  { from: "/raporum", to: "/zil-raporu" },
  { from: "/risk", to: "/risk-masasi" },
] as const;

/** Adreste önek taşıyan diller (`/en`) — varsayılan dil öneksiz. */
const PREFIXES = ["", ...LOCALES.filter((l) => l !== DEFAULT_LOCALE).map((l) => `/${l}`)];

export type LegacyRedirect = {
  source: string;
  destination: string;
  permanent: true;
};

/**
 * `next.config.ts → redirects()` kuralları. Her eski ad için dört kural:
 * çıplak ad ve alt yollar, öneksiz ve `/en` önekli. Çıplak ad ayrı kural,
 * çünkü `/:path*`ın sıfır parçalı eşleşmesine güvenip hedefte sondaki
 * eğik çizgi tartışmasına girmek istemedik.
 */
export function legacyRedirects(): LegacyRedirect[] {
  return RENAMED_ROUTES.flatMap(({ from, to }) =>
    PREFIXES.flatMap((prefix) => [
      { source: `${prefix}${from}`, destination: `${prefix}${to}`, permanent: true as const },
      { source: `${prefix}${from}/:path*`, destination: `${prefix}${to}/:path*`, permanent: true as const },
    ]),
  );
}

/**
 * Bir adresin (yol + isteğe bağlı sorgu/çapa) yeni karşılığı; eski bir ad
 * değilse `null`. Kuralların davranışının saf eşi — test ve site içi
 * kullanım (ör. eski yolları okuyan bir yardımcı) için.
 */
export function legacyTarget(url: string): string | null {
  const cut = url.search(/[?#]/);
  const path = cut === -1 ? url : url.slice(0, cut);
  const rest = cut === -1 ? "" : url.slice(cut);
  for (const prefix of PREFIXES) {
    if (prefix && path !== prefix && !path.startsWith(`${prefix}/`)) continue;
    const bare = prefix ? path.slice(prefix.length) : path;
    for (const { from, to } of RENAMED_ROUTES) {
      if (bare === from) return `${prefix}${to}${rest}`;
      if (bare.startsWith(`${from}/`)) return `${prefix}${to}${bare.slice(from.length)}${rest}`;
    }
    if (prefix) return null;
  }
  return null;
}
