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

/** Cron ve çeviri gibi arka plan işleri daha sabırlı olabilir. */
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
