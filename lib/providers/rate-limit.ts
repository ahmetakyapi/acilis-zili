/**
 * 429'da KISA BEKLEYİP YENİDEN DENEME — sağlayıcı fetch kapılarının ortağı.
 *
 * NEDEN (18 Kasım 2026). Alpaca'nın ücretsiz planı dakikada 200 istek
 * veriyor; pencere dakikalık, günlük değil. New York açılışından hemen
 * sonra (10:06 ET) fiyat güncellemesi (~500 sembol, 200'lük paketler),
 * site trafiği ve teknik bağlam ucunun önbelleksiz 1 yıllık bar çekimi aynı
 * saniyeye bindi ve beş isteğin beşi 429 aldı; bir dakika sonra Alpaca yine
 * normal yanıt veriyordu. `alpacaFetch` 429'u beklemeden hata diye
 * döndürüyordu: teknik bağlamda barlar TEK çağrıyla geldiği için o çağrı
 * düşünce 16 hissenin hepsi `data_ok: false` oldu ve Teknik Analist o anda
 * bağlam çekseydi nöbet boş geçerdi. Dakikalık bir pencerede birkaç saniye
 * beklemek isteği büyük olasılıkla kurtarıyor.
 *
 * BEKLEME SÜRESİ YANITTAN. Önce standart `Retry-After` (saniye ya da HTTP
 * tarihi), yoksa `X-RateLimit-Reset` (Alpaca ve Finnhub gönderiyor; Unix
 * saniyesi), o da yoksa 1 sn, 2 sn… Üstüne 0–400 ms rastgele pay: aynı
 * saniyede 429 alan çağrılar aynı anda geri dönüp pencereyi yeniden
 * doldurmasın.
 *
 * TAVAN BİLEREK DÜŞÜK. Kapılar sayfa çiziminde de koşuyor; tek bekleme en
 * çok `RATE_LIMIT_MAX_WAIT_MS`, deneme sayısı `RATE_LIMIT_RETRIES`. Sıfırlanma
 * daha uzaktaysa tavan kadar beklenir — Alpaca'nın kalanı pencere içinde
 * kademeli doluyor, ikinci deneme çoğu zaman geçiyor. Geçmezse eski davranış:
 * `rate-limited` hatası, kart "veri alınamadı" der.
 *
 * ÖNBELLEK. Next'in veri önbelleği yalnız 200 yanıtını saklıyor
 * (`patch-fetch.js`: `res.status === 200`), yani 429 saklanmıyor ve yeniden
 * deneme aynı `fetch` seçenekleriyle ağa gerçekten çıkıyor.
 *
 * SEC BURADA YOK: SEC'in sınırı aşan adresi ~10 dakika engelliyor (403);
 * birkaç saniyelik yeniden deneme engeli uzatır. Onun kapısı sıradır
 * (`sec-gate.ts`).
 */

export const RATE_LIMIT_RETRIES = 2;
export const RATE_LIMIT_MAX_WAIT_MS = 6_000;
const MIN_WAIT_MS = 500;
const JITTER_MS = 400;

/** 429 yanıtından sonra kaç ms beklenmeli (`attempt`: 0'dan başlayan deneme sırası). */
export function rateLimitWaitMs(
  res: Pick<Response, "headers">,
  attempt: number,
  nowMs: number = Date.now(),
  random: () => number = Math.random,
): number {
  let base: number | null = null;

  const retryAfter = res.headers.get("retry-after");
  if (retryAfter !== null && retryAfter.trim() !== "") {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) base = seconds * 1000;
    else {
      const at = Date.parse(retryAfter);
      if (Number.isFinite(at)) base = at - nowMs;
    }
  }

  if (base === null) {
    const reset = Number(res.headers.get("x-ratelimit-reset"));
    if (res.headers.has("x-ratelimit-reset") && Number.isFinite(reset) && reset > 0) {
      /* Unix saniyesi; milisaniye gönderen olursa (> 1e12) olduğu gibi. */
      base = (reset > 1e12 ? reset : reset * 1000) - nowMs;
    }
  }

  if (base === null || base <= 0) base = 1000 * 2 ** attempt;
  const wait = Math.max(MIN_WAIT_MS, base) + Math.floor(random() * JITTER_MS);
  return Math.min(RATE_LIMIT_MAX_WAIT_MS, wait);
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * `attempt` 429 döndürdükçe bekleyip yeniden çağırır; son yanıtı döner.
 * `attempt` her seferinde YENİ istek açmalı (süre sınırı denemeye özgü).
 */
export async function retryOnRateLimit<T extends { res: Pick<Response, "status" | "headers"> }>(
  attempt: () => Promise<T>,
  options: { retries?: number; sleep?: (ms: number) => Promise<void>; now?: () => number } = {},
): Promise<T> {
  const retries = options.retries ?? RATE_LIMIT_RETRIES;
  const sleep = options.sleep ?? defaultSleep;
  const now = options.now ?? Date.now;
  for (let i = 0; ; i++) {
    const out = await attempt();
    if (out.res.status !== 429 || i >= retries) return out;
    await sleep(rateLimitWaitMs(out.res, i, now()));
  }
}
