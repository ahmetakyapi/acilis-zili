/**
 * Sağlayıcı metninin temizliği.
 *
 * Haber başlıkları ve özetleri Finnhub'dan geldiği gibi basılıyordu ve
 * içlerinde iki tür bozukluk vardı. 400 haberde ölçüldü:
 *
 *   36 özet  ham HTML varlığı taşıyor — "Reddit&#39;s r/WallStreetBets"
 *   19 özet  kodlama bozukluğu taşıyor — "RenTec’s Q2 2026 13F",
 *            "CorporaciÃ³n AmÃ©rica Airports"
 *
 * İkisi de kaynağın kendi hatası ama ekranda bizim hatamız gibi duruyor.
 * Temizlik iki yerde birden çalışıyor: girişte (bundan sonra yazılan her
 * satır temiz) ve okumada (veritabanındaki mevcut satırlar da düzgün
 * görünsün — geçmişi silen bir migration yazmaya değmez, işlem idempotent
 * ve ucuz).
 */

/** Adı geçen HTML varlıkları — sağlayıcı akışlarında görülenler. */
const VARLIKLAR: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  rsquo: "’",
  lsquo: "‘",
  ldquo: "“",
  rdquo: "”",
  mdash: "—",
  ndash: "–",
  hellip: "…",
  eacute: "é",
  oacute: "ó",
};

/**
 * Kodlama bozukluğunu onarır — UTF-8 baytları Latin-1 diye okunmuş metin.
 *
 * Baytlar geri yazılıp doğru şekilde çözülüyor. Üç koruma var, çünkü bu
 * dönüşüm yanlış metne uygulanırsa metni bozar:
 *
 *   1. İşaretçi yoksa hiç dokunulmuyor.
 *   2. Latin-1 dışı GERÇEK bir karakter varsa (Türkçe "ş", "İ" gibi)
 *      dönüşüm onları öğütürdü — o yüzden vazgeçiliyor.
 *   3. Sonuçta değiştirme karakteri (U+FFFD) belirdiyse tahmin tutmamış
 *      demektir; özgün metin korunuyor.
 */
export function kodlamayiOnar(metin: string): string {
  if (!/Ã[-¿]|â€/.test(metin)) return metin;
  for (let i = 0; i < metin.length; i += 1) {
    if (metin.charCodeAt(i) > 0xff) return metin;
  }
  const onarilmis = Buffer.from(metin, "latin1").toString("utf8");
  return onarilmis.includes("�") ? metin : onarilmis;
}

/**
 * HTML varlıklarını çözer.
 *
 * İki tur: kaynakta çift kaçış görülüyor ("&amp;#39;"), tek tur onu
 * "&#39;" hâline getirip bırakıyordu. İkiden fazlası gereksiz ve
 * "&amp;amp;" gibi KASITLI yazılmış metni bozma riski taşıyor.
 */
export function varliklariCoz(metin: string): string {
  let sonuc = metin;
  for (let tur = 0; tur < 2; tur += 1) {
    const oncesi = sonuc;
    sonuc = sonuc.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (tam, ad: string) => {
      const kucuk = ad.toLowerCase();
      if (kucuk.startsWith("#x")) {
        const kod = Number.parseInt(kucuk.slice(2), 16);
        return Number.isFinite(kod) && kod > 0 && kod <= 0x10ffff
          ? String.fromCodePoint(kod)
          : tam;
      }
      if (kucuk.startsWith("#")) {
        const kod = Number.parseInt(kucuk.slice(1), 10);
        return Number.isFinite(kod) && kod > 0 && kod <= 0x10ffff
          ? String.fromCodePoint(kod)
          : tam;
      }
      return VARLIKLAR[kucuk] ?? tam;
    });
    if (sonuc === oncesi) break;
  }
  return sonuc;
}

/**
 * Sağlayıcıdan gelen serbest metni ekrana hazır hâle getirir.
 * Boş ya da yalnızca boşluktan ibaret metin `null` döner.
 */
export function saglayiciMetni(metin: string | null | undefined): string | null {
  if (!metin) return null;
  const temiz = varliklariCoz(kodlamayiOnar(metin))
    /* Kaynakların bir kısmı satır sonlarını ve sekmeleri metnin içinde
       bırakıyor; tek satırlık künyelerde bunlar boşluk gibi davranmalı. */
    .replace(/\s+/g, " ")
    .trim();
  return temiz || null;
}
