/**
 * Dış çağrılara üst sınır.
 *
 * SORUN: `fetch` varsayılan olarak SÜRESİZ bekler. Sağlayıcı bağlantıyı kabul
 * edip yanıt vermemeye başladığında (kota tükenmesi, kısıtlama, ağ kara
 * deliği) sunucu bileşeni orada kilitleniyor ve okuyucu boş bir sayfaya
 * bakıyor. Sağlayıcının düşmesi bu üründe olağan bir durum ve tasarım zaten
 * ona göre — kart "veri alınamadı" der, sayfa çalışmaya devam eder. O
 * davranışa ulaşabilmek için çağrının bir noktada VAZGEÇMESİ gerekiyor.
 *
 * NEDEN `AbortSignal.timeout` DEĞİL: `signal` alanı `fetch` seçeneklerine
 * girdiğinde Next'in veri önbelleğiyle ilişkisi sürüme bağlı ve belirsiz.
 * Bu üründe önbellek ömürleri sağlayıcı kotasına göre tek tek ayarlanmış
 * (`quoteTtlSeconds`, `candleTtlSeconds`); önbelleği kazara devre dışı
 * bırakan bir değişiklik, çözdüğü sorundan büyük bir sorun üretir. Yarış
 * `fetch` seçeneklerine hiç dokunmuyor.
 *
 * KARŞILIĞI DÜRÜSTÇE: alttaki istek İPTAL EDİLMİYOR, yalnızca çağıran
 * beklemeyi bırakıyor. Bağlantı kendi kendine kapanana kadar açık kalır.
 * Çözülen şey sayfanın kilitlenmesi — asıl sorun oydu.
 */

/** Sağlayıcı çağrıları için üst sınır. Kotasyon ve profil uçları saniyeler sürer. */
export const PROVIDER_TIMEOUT_MS = 8_000;

/** Cron gibi arka plan işleri daha sabırlı olabilir. (Çeviri 20 Ekim'den beri
    süreyi SDK'ya veriyor — yarış ücretlenen yanıtı atıyordu, lib/translate.ts.) */
export const BACKGROUND_TIMEOUT_MS = 20_000;

export class TimeoutError extends Error {
  constructor(ms: number) {
    super(`${ms} ms içinde yanıt gelmedi`);
    this.name = "TimeoutError";
  }
}

/**
 * Verilen sözü süreye bağlar. Süre dolarsa `TimeoutError` atar — çağıran
 * taraf onu kendi `catch`inde zaten "network" hatasına çeviriyor.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number = PROVIDER_TIMEOUT_MS,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const guard = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(ms)), ms);
  });
  /* Zamanlayıcı her koşulda temizleniyor: temizlenmezse Node olay döngüsünü
     açık tutar ve sunucusuz fonksiyon boşuna saniyelerce yaşar. */
  return Promise.race([promise, guard]).finally(() => clearTimeout(timer));
}

/**
 * Yanıtı GÖVDESİYLE BİRLİKTE süreye bağlar (20 Ekim).
 *
 * `fetch` başlıklar gelince çözülüyor, gövde ise hâlâ akıyor olabilir (Next
 * önbelleğe yazarken okuyucuya akmakta olan bir kopya veriyor).
 * `withTimeout(fetch(...))` yalnız başlığı sınırlıyordu: kaynak başlığı
 * gönderip gövdenin ortasında durursa `res.json()` / `res.text()` undici'nin
 * 300 saniyelik gövde süresine kadar bekliyor, 8 saniyelik tavan amacını
 * kaybediyordu. Okuma (`read`) artık yarışın İÇİNDE; `fetch` seçeneklerine
 * yine dokunulmuyor, yukarıdaki önbellek gerekçesi aynen geçerli.
 */
export function withBody<B>(
  request: Promise<Response>,
  read: (res: Response) => B | Promise<B>,
  ms: number = PROVIDER_TIMEOUT_MS,
): Promise<{ res: Response; body: B }> {
  return withTimeout(
    request.then(async (res) => ({ res, body: await read(res) })),
    ms,
  );
}
