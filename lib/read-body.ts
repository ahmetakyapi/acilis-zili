/**
 * GÖVDEYİ TAVANLA OKU (20 Ekim taraması).
 *
 * `request.text()` / `request.json()` gövdenin TAMAMINI belleğe alıyor.
 * 15 Ekim kalıbı (önce `Content-Length`, okuduktan sonra `raw.length`)
 * yarım önlemdi: parçalı (`Transfer-Encoding: chunked`) ya da HTTP/2 gövdesi
 * `Content-Length` taşımıyor, ilk denetim 0 okuyup geçiyor ve `text()` akışın
 * hepsini biriktirdikten SONRA uzunluk soruluyordu — kimliksiz birkaç paralel
 * istek tek `next start` sürecini OOM'a sürükleyebiliyordu. Route
 * handler'larda Next'in gövde sınırı yok (yalnız sunucu eylemlerinde), proxy
 * eşleyicisi `api/`yi dışarıda bırakıyor. Burada tavan AKIŞ SIRASINDA
 * sayılıyor: aşıldığı an okuma iptal edilip `null` dönüyor. İkinci kat
 * deploy/Caddyfile → `request_body`.
 *
 * Sayılan BAYT (eski denetim UTF-16 birimi sayıyordu); meşru yüklerin hepsi
 * tavanın çok altında, fark önemsiz. Okuma sırasında bağlantı koparsa hata
 * çağırana geçer — uçların hepsi okumayı zaten `try` içinde yapıyor.
 */
export async function readTextCapped(request: Request, max: number): Promise<string | null> {
  if (Number(request.headers.get("content-length") || 0) > max) return null;
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      /* İptal BEKLENMİYOR: kalan gövde zaten okunmayacak; beklemek yanıtı
         akışın kapanmasına bağlardı. */
      void reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  const all = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    all.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(all);
}
