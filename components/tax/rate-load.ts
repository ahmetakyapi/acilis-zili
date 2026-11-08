/**
 * Vergi hesaplayıcının kur yüklemesi — saf durum makinesi (8 Kasım, durum
 * makinesi denetimi § 10). Düz modül: TaxCalculator `useReducer` ile
 * kullanır, testi tests/tax-rate-load.test.ts.
 *
 * ESKİSİ ÜÇ BAYRAKTI (`ratesFailed`, `pendingRates`, `retryTick`) ve iki
 * yoldan hatayı gizliyordu:
 * - İstek uçuştayken efekt temizlenince (`missingKey` değişti) `.finally`
 *   `cancelled` yüzünden `pendingRates(false)`u atlıyordu; yeni anahtar
 *   boşsa (okur daha önce yüklenmiş bir güne döndü) efekt hiç koşmuyor ve
 *   "yükleniyor" sonsuza dek kalıyordu. Uyarı `ratesFailed && !pending`
 *   olduğu için "Kur Alınamadı" ve "Tekrar Dene" görünmüyordu.
 * - 40 günden fazla gün varsa ikinci parti `setRatesFailed(...)` ile ilk
 *   partinin hatasını siliyordu.
 *
 * Şimdi: `phase` yalnız uçuşu söyler ve temizlikte HER DURUMDA `idle`a
 * döner (`cancel`). Hata gün başına: sunucunun "bu gün yok" cevabı zaten
 * `rates[date] === null` olarak yazılıyor; istek bütünüyle düşerse partinin
 * günleri `failed` kümesine girer. Bir parti yalnız KENDİ günlerini
 * kümeden çıkarır, başkasının hatasını silmez.
 */

export type RatePhase = "idle" | "loading";

export type RateLoad = {
  phase: RatePhase;
  /** İsteği bütünüyle düşen (ağ, `ok: false`) günler. */
  failed: ReadonlySet<string>;
};

export type RateLoadEvent =
  | { type: "start" }
  /** Parti bitti; `ok: false` partinin bütün günleri düştü demek. */
  | { type: "settle"; dates: readonly string[]; ok: boolean }
  /** Efekt temizlendi: cevap artık yazılmayacak, uçuş bitti sayılır. */
  | { type: "cancel" }
  /** "Tekrar Dene": düşen günler yeniden sorulabilir. */
  | { type: "retry" };

export const RATE_LOAD_IDLE: RateLoad = { phase: "idle", failed: new Set() };

export function rateLoadReducer(state: RateLoad, event: RateLoadEvent): RateLoad {
  switch (event.type) {
    case "start":
      return state.phase === "loading" ? state : { ...state, phase: "loading" };
    case "cancel":
      return state.phase === "idle" ? state : { ...state, phase: "idle" };
    case "settle": {
      const failed = new Set(state.failed);
      for (const date of event.dates) {
        if (event.ok) failed.delete(date);
        else failed.add(date);
      }
      return { phase: "idle", failed };
    }
    case "retry":
      return state.failed.size === 0 ? state : { ...state, failed: new Set() };
  }
}

/**
 * "Kur Alınamadı" uyarısı görünür mü: uçuş yokken gereken günlerden biri
 * ya sunucuda yok (`null`) ya da isteği düştü. Yalnız GEREKEN günlere
 * bakar — okur hatalı tarihi düzeltince uyarı kendiliğinden kalkar.
 */
export function ratesFailedOf(
  load: RateLoad,
  neededDates: readonly string[],
  rates: Readonly<Record<string, unknown>>,
): boolean {
  if (load.phase === "loading") return false;
  return neededDates.some((date) => rates[date] === null || load.failed.has(date));
}
