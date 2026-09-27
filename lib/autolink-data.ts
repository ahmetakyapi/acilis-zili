import { cache } from "react";
import { getCompanies } from "@/lib/data";
import { ALL_MEMBERS } from "@/db/seed/indices";
import { ALL_SYMBOL_SEEDS } from "@/db/seed/symbols";
import { glossaryMatchList } from "@/content/glossary";
import { createAutoLinker, type AutoLinker } from "@/lib/autolink";

/**
 * Otomatik bağlantının SUNUCU tarafı: bilinen sembol kümesi ve sözlük.
 *
 * Sembol kümesi `symbols` tablosundan (şirketler dizininin okuduğu, beş
 * dakikalık önbellekteki tablo — `getCompanies`), yani yazının içindeki
 * "(NVDA)" ancak sitede sayfası olan bir şirkete bağlanıyor. Endeks
 * fonları (SPY, QQQ…) dizinden süzüldüğü için tohumdan ekleniyor.
 *
 * Veritabanı düşerse küme statik tohuma iner (endeks üyeleri + popüler
 * semboller): bağlantı biraz daralır ama yazı yine çizilir. Hata burada
 * yutulmuyor, `getCompanies` zaten boş liste döndürüyor.
 *
 * İSTEK İÇİNDE TEKİL (`cache`): Mercek sayfası gövdeyi bir kez çiziyor ama
 * sözlük sayfası tanım ile örneği ayrı çizebilir; küme bir kez kurulsun.
 */
const knownSymbols = cache(async function knownSymbols(): Promise<ReadonlySet<string>> {
  const companies = await getCompanies();
  const set = new Set<string>(ALL_SYMBOL_SEEDS.map((seed) => seed.symbol));
  if (companies.length > 0) {
    for (const company of companies) set.add(company.symbol);
  } else {
    for (const member of ALL_MEMBERS) set.add(member.symbol);
  }
  return set;
});

/**
 * Bir yazının bağlayıcısı — HER ÇİZİM İÇİN YENİ. Nesne "bu hedef bağlandı"
 * bilgisini tutuyor; iki yazı aynı nesneyi paylaşırsa ikincisinde hiçbir
 * şey bağlanmaz.
 */
export async function articleAutoLinker(
  locale: string,
  options: { excludeTerm?: string } = {},
): Promise<AutoLinker> {
  return createAutoLinker({
    locale,
    terms: glossaryMatchList(locale),
    symbols: await knownSymbols(),
    excludeTerm: options.excludeTerm,
  });
}
