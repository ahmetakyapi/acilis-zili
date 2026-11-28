/**
 * Hata sınırından `/api/hata`ya bildirim — tarayıcıda çalışır.
 *
 * YALNIZCA TARAYICIDA DOĞAN HATA. `digest` taşıyan hata sunucuda doğdu ve
 * `instrumentation.ts` onu zaten yazdı; burada ikinci kez bildirmek aynı
 * arızayı iki satır ve iki sayı yapardı.
 *
 * Gönderilen yalnızca iki alan: yol ve mesaj. Yığın, tarayıcı künyesi ya
 * da oturum bilgisi gönderilmiyor (lib/schema.ts → appErrors). Aynı mesaj
 * sayfa ömrü boyunca bir kez: hata sınırı yeniden çizildikçe `useEffect`
 * tekrar koşuyor ve "Tekrar Dene" döngüsü sayıyı şişiriyordu.
 */

const reported = new Set<string>();

/**
 * ESKİ SÜRÜMÜN PARÇASI (28 Kasım). Yönetimdeki hata listesinde "Failed to
 * load chunk /_next/static/chunks/….css" iki günde ~40 kez: yeni sürüm
 * yayına çıkınca eski sürümün dosyaları sunucudan kalkıyor, açık kalmış
 * sekme sayfa değiştirirken eski parçayı istiyor ve hata ekranına düşüyor.
 * Okurun yapacağı tek şey sayfayı yenilemek; bunu biz bir kez yaparız.
 */
export function isChunkLoadError(message: string): boolean {
  return /Failed to load chunk|ChunkLoadError|Loading (CSS )?chunk [^ ]+ failed/i.test(message);
}

const CHUNK_RELOAD_KEY = "az-chunk-reload";
/** Aynı sekmede bu süre içinde ikinci yenileme yapılmaz (döngü olmasın); hata o zaman bildirilir. */
const CHUNK_RELOAD_WINDOW_MS = 60_000;

function reloadOnceForChunk(): boolean {
  try {
    const last = Number(window.sessionStorage.getItem(CHUNK_RELOAD_KEY) ?? 0);
    if (Date.now() - last < CHUNK_RELOAD_WINDOW_MS) return false;
    window.sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

export function reportClientError(error: Error & { digest?: string }): void {
  if (typeof window === "undefined" || error.digest) return;
  const message = error.message || error.name || "Error";
  if (isChunkLoadError(message) && reloadOnceForChunk()) return;
  const key = `${window.location.pathname}\n${message}`;
  if (reported.has(key)) return;
  reported.add(key);

  const body = JSON.stringify({ path: window.location.pathname, message });
  try {
    /* `sendBeacon` sayfa kapanırken de gidiyor ve yanıt beklemiyor; yoksa
       sıradan bir `fetch`, o da sessiz. Bildirim başarısızsa hiçbir şey
       yapılmıyor — hata ekranı zaten okuyucunun önünde. */
    const blob = new Blob([body], { type: "application/json" });
    if (navigator.sendBeacon?.("/api/hata", blob)) return;
    void fetch("/api/hata", {
      method: "POST",
      body,
      headers: { "content-type": "application/json" },
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    /* Bildirim bir hata daha üretmemeli. */
  }
}
