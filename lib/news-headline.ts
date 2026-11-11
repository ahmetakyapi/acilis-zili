/**
 * Haber manşetinin TEKİLLEŞTİRME anahtarı (11 Kasım, ana sayfa haber bandı).
 *
 * Bant aynı manşetin iki kez girmesini küçük harfe çevrilmiş metni
 * karşılaştırarak engelliyordu. Ajanslar güncellenen haberi yeni bir kayıt
 * olarak yolluyor ve manşetin başına "Update:" / "UPDATE 2-" / "Güncelleme:"
 * ekliyor ya da sonuna "(Reuters)", "(updated)", "(2)" gibi bir parantez
 * koyuyor; anahtar bunları atınca aynı haberin iki sürümü tek satıra iner.
 *
 * Ucuz sigorta, benzerlik ölçüsü değil: yalnız ön ek, sondaki parantez,
 * boşluk ve sondaki noktalama normalleşiyor. Anlamı farklı iki manşeti
 * birleştirecek bir kural (kelime kırpma, sayı atma) bilerek yok.
 */
const UPDATE_PREFIX = /^\s*(?:update[ds]?|güncelleme|güncellendi|guncelleme)\b\s*\d*\s*[:\-–—|]\s*/iu;
const TRAILING_PAREN = /\s*[([][^()[\]]{0,40}[)\]]\s*$/u;
const TRAILING_PUNCT = /[\s.!?…:;,]+$/u;

export function newsHeadlineKey(headline: string): string {
  let text = headline.normalize("NFC").trim();
  /* Ön ek de parantez de birden çok kez gelebiliyor ("UPDATE 1-UPDATE 2-",
     "… (Reuters) (updated)"); sabitlenene dek soyuluyor. */
  for (let pass = 0; pass < 4; pass++) {
    const next = text.replace(UPDATE_PREFIX, "").replace(TRAILING_PAREN, "").trim();
    if (next === text) break;
    text = next;
  }
  /* Soyma her şeyi götürdüyse (manşetin tamamı parantezse) anahtar
     orijinalden kurulur; boş anahtar bütün boşları birleştirirdi. */
  if (!text) text = headline.trim();
  return text.replace(TRAILING_PUNCT, "").replace(/\s+/g, " ").toLocaleLowerCase("tr-TR");
}
