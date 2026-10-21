import { peekRateLimit, rateLimit } from "@/lib/rate-limit";

/* --------------------------------------------------------------------------
   Karşılaştırmanın YENİ KÜME kapısı (20 Ekim) — sayfa (`/karsilastir`) ve
   toplu bar ucu (`/api/karsilastir`) aynı sayaçtan okuyor.

   Bar ucu tanınan sembollere IP başına dakikada 300 istek tanıyordu;
   gerekçesi "tanınan evren kapalı bir küme, her yanıt önbellekli"ydi. Tek
   sembolde doğru, KÜMEDE değil: sağlayıcı isteği sembolleri tek adreste
   taşıyor ve Next'in veri önbelleği o adresi anahtar alıyor. Bin sembolden
   seçilen her yeni dörtlü önbelleği ıskalayıp Alpaca'ya gidiyordu ve tek
   adresten dakikada 300 yeni dörtlü, Alpaca'nın dakikada 200'lük ücretsiz
   kotasını sitenin tamamı için bitiriyordu. Sayfa aynı barları, üstüne
   kotasyon paketini hiç sınırsız istiyordu. Sıra artık anahtarı bölmüyor
   (`getBarsMulti` sıralıyor) ama sıralanmış küme uzayı da sonsuz.

   Sınır YENİ kümeye konuyor, tekrara değil; anahtar küme ile aralığın
   ikilisi. Yalnızca TEKRAR bedava: aynı küme aynı aralıkla, hak düşen ilk
   istekten sonraki 60 saniye içinde (sabit pencere, kayan değil) kim
   isterse istesin önbellekte sayılıyor. Gerisi birer hak: okuyucunun ilk
   kez açtığı her aralık (üzerinde durulan düğmenin önden yüklenmesi dahil),
   son dakikada kimsenin istemediği her hazır set ve paylaşılan bağlantı.
   Düşük trafikli sitede hazır set de paylaşılan bağlantı da çoğu zaman hak
   düşürür. Burada "aralık rayında gezinme, hazır setler ve paylaşılan
   bağlantılar sayaca dokunmuyor" yazıyordu; yanlıştı, sınırı ayarlayanı
   yanıltırdı. Yüklenmiş aralığa geri dönüş sunucuya hiç gitmiyor
   (CompareLive aralık başına saklıyor). 30: bir kümenin altı aralığının
   hepsini açmak 30'un 6'sı; dakikada beş ayrı kümeyi baştan sona gezen
   insan yok, binlerce dörtlüyü tarayan betik var.

   Kapı HER kümeye: tanınmayan sembol taşıyan küme önce kendi kovasından
   (uçta `compare-unknown`, sayfada `compare-page-unknown`), sonra bu
   sayaçtan geçiyor. IP başına yeni kombinasyon tavanı böylece bütün
   kapılar için tek: 30.

   Hakkı aşan isteğin kümesi "görüldü" diye YAZILMIYOR: yazılsaydı betik
   reddedilen her denemeyle sınırlayıcının tablosuna yeni anahtar ekler,
   tablo taşınca süresi yakın başka sayaçları sildirebilirdi
   (lib/rate-limit.ts → sweep).
   -------------------------------------------------------------------------- */

export const COMPARE_NEW_SET_LIMIT = 30;
const WINDOW_MS = 60_000;

/**
 * `ipKey`: çağıranın kimliği, `compare-new` kapsamıyla — uçta
 * `clientKey(request, "compare-new")`, sayfada `requestKey("compare-new")`;
 * ikisi aynı diziyi üretiyor, sayfa ile uç tek sayacı paylaşıyor.
 */
export function allowCompareSet(
  symbols: readonly string[],
  range: string,
  ipKey: string,
): { allowed: boolean; retryAfter: number } {
  const seen = `compare-seen:${[...symbols].sort().join(",")}:${range}`;
  if (!peekRateLimit(seen, 1).allowed) return { allowed: true, retryAfter: 0 };
  const result = rateLimit(ipKey, COMPARE_NEW_SET_LIMIT, WINDOW_MS);
  if (result.allowed) rateLimit(seen, 1, WINDOW_MS);
  return { allowed: result.allowed, retryAfter: result.retryAfter };
}
