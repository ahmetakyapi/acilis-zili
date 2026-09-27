/**
 * Arama için harf katlama — küçült, Türkçe harfleri ASCII'ye indir, harf ve
 * rakam dışını at: "F/K" → "fk", "Çekirdek" → "cekirdek".
 *
 * AYRI DOSYADA, `"use client"` bir modülde değil: sözlük dizini aranacak
 * metni sunucuda bir kez katlıyor, sorguyu tarayıcıda. İstemci modülünden
 * dışa aktarılan bir fonksiyon sunucuya gerçek değer olarak gelmiyor
 * (CLAUDE.md "İstemci ile sunucu sınırı"); iki taraf aynı kuralı buradan
 * okuyor ki "fk" yazan okuyucu F/K'yı bulsun.
 */
const FOLD: Record<string, string> = {
  ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u",
};

export function foldForSearch(text: string, locale: string): string {
  return [...text.toLocaleLowerCase(locale === "en" ? "en-US" : "tr-TR")]
    .map((ch) => FOLD[ch] ?? ch)
    .join("")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}
