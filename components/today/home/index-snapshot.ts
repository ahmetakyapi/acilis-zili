import { type MarketStatus } from "@/lib/market-hours";
import { getQuotes } from "@/lib/providers";
import { ALL_MEMBERS, primaryOnly } from "@/db/seed/indices";

/* --------------------------------------------------------------------------
   Endeks evreninin BİR ANLIK GÖRÜNTÜSÜ — iki panel de bundan besleniyor.

   `getQuotes` istek boyunca `cache()`li ve anahtarı sıralanmış sembol dizesi
   (lib/providers/index.ts → quotesForKey), yani iki panel aynı listeyi
   sorduğunda sağlayıcıya BİR kez gidiliyor. Bu, hız kadar DOĞRULUK meselesi:
   ayrı ayrı çekilseler aynı ekranda aynı hissenin iki farklı yüzdesi
   durabilir ve deponun kuralı "aynı sayı iki yerde duruyorsa aynı kaynaktan
   gelmeli".

   Evren endeks üyeleri (S&P 500 + Nasdaq 100 + Dow, tekilleştirilmiş) ve
   bu da bir veri dürüstlüğü kararı: takip edilen 800 şirketin tamamı
   alınsaydı sıralamanın tepesine mikro şirketler çıkardı — ölçüldü, bir
   seansta 156 bin dolarlık bir şirket %250 hareketle listeyi açıyordu.
   Endeks üyeliği "haber değeri olan isim" için ucuz ve savunulabilir bir
   süzgeç, üstelik künye kaç sembolün tarandığını yazıyor.
   -------------------------------------------------------------------------- */
const MOVER_UNIVERSE = primaryOnly(ALL_MEMBERS);

export async function indexSnapshot(status: MarketStatus) {
  const symbols = MOVER_UNIVERSE.map((member) => member.symbol);
  return { symbols, result: await getQuotes(symbols, status) };
}
