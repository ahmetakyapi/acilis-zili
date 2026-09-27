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

export function reportClientError(error: Error & { digest?: string }): void {
  if (typeof window === "undefined" || error.digest) return;
  const message = error.message || error.name || "Error";
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
