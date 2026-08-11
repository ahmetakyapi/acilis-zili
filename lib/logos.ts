import { LOCAL_LOGOS, LOGO_FILE_OVERRIDES } from "./logo-manifest";

/**
 * Şirket logosunun adresi — önce DEPODAN.
 *
 * Logolar bir süre doğrudan Finnhub'dan geliyordu ve her biri `next/image`
 * üzerinden Vercel'in görsel iyileştiricisine düşüyordu. Ücretsiz kota bir
 * ayda doldu, iyileştirici HTTP 402 dönmeye başladı ve yeni dönüşüm isteyen
 * her logo ekranda KIRIK göründü — NVDA duruyor, GOOGL yok. Kota her ay
 * yenileniyor ama çözüm o değildi: aynı duvara yeniden çarpardık.
 *
 * Logolar artık depoda, 128 piksellik webp olarak (`public/logos/`) ve statik
 * dosya olarak servis ediliyor: ücretsiz, anlık, kotasız. Ortalama 1,4 KB —
 * altmış logolu bir listede toplam 84 KB, iyileştiricinin ürettiğinden farksız.
 * İndiren betik: `scripts/build-logos.mjs` (`npm run build:logos`).
 *
 * MANİFESTE GİRMEMİŞ SEMBOL kırık görünmüyor, kaynaktaki adrese düşüyor.
 * Günlük senkron yeni bir sembol eklediğinde betik henüz koşmamış olabilir;
 * o logo optimize edilmeden, olduğu gibi yüklenir. Tek bir sembol için
 * kabul edilebilir bir bedel ve durum gözle görülüyor — betiği çalıştırınca
 * kendiliğinden düzeliyor.
 *
 * DOSYA ADI SEMBOLE EŞİT DEĞİL olabilir: Windows'ta rezerve cihaz adı taşıyan
 * semboller (CON, PRN, AUX, NUL, COM1-9, LPT1-9) diskte alt çizgiyle duruyor,
 * yoksa depo Windows'ta klonlanamıyor. Eşleme manifestte, gerekçesi
 * `scripts/build-logos.mjs` içinde.
 */
export function logoSrc(
  symbol: string,
  remote: string | null | undefined,
): string | null {
  if (LOCAL_LOGOS.has(symbol)) {
    return `/logos/${LOGO_FILE_OVERRIDES.get(symbol) ?? symbol}.webp`;
  }
  return remote ?? null;
}
