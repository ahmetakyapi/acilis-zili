/**
 * TAVSİYE DENETİMİ (24 Ekim) — Claude'un portföy metninin son kontrolü.
 *
 * Türkiye'de kişiye özel al/sat önerisi SPK lisanslı yatırım
 * danışmanlığıdır (6362 sayılı SPK Kanunu, yatırım danışmanlığı faaliyeti).
 * Ürün ölçer, karşılaştırır, açıklar; "şu hisseyi al" demez. Prompt bu
 * çizgiyi modele açıkça veriyor ama prompt bir RİCA, denetim değil: model
 * nadiren de olsa "eklemelisin", "öneririm" yazabilir. Bu kontrol çıktıda
 * yönlendirme kalıbı bulursa metin HİÇ basılmaz (sayı denetimiyle aynı
 * kural, lib/ai-grounding.ts); ölçüler ekranda eksiksiz kalır.
 *
 * Kalıplar bilerek dar: gözlem cümlesi ("teknoloji ağırlığı S&P 500'ün
 * üstünde") geçmeli, emir ve öneri kipi düşmeli. Türkçede gereklilik eki
 * (-malı/-meli) yalnız al/sat/ekle/azalt/çeşitlendir gibi işlem fiillerinde
 * yakalanır; "bilinmeli" gibi zararsız kullanımlar geçer.
 * Sınama: tests/advice-guard.test.ts.
 */

/* `\b` JavaScript'te ASCII'ye bakar: "çeşitlendirmelisin"in başındaki ç
   kelime sınırı sayılmaz. Türkçe kalıplar harf sınırını bakışla kurar. */
const START = "(?<![\\p{L}\\p{N}])";
const END = "(?![\\p{L}\\p{N}])";
const ACTION_TR = "(?:al|sat|ekle|azalt|art[ıi]r|indir|çıkar|elden çıkar|tut|bulundur|çeşitlendir|dağıt|değiştir|yönel|kaydır|gir|çık|topla|boşalt)";
const tr = (body: string) => new RegExp(`${START}${body}`, "iu");

const PATTERNS_TR: readonly RegExp[] = [
  /* Gereklilik kipi: almalısın, satmalısınız, eklemelisin, azaltılmalı… */
  tr(`${ACTION_TR}\\p{L}{0,6}m[ae]l[ıi]`),
  /* Öneri fiilleri, birinci tekil/çoğul: öneririm, tavsiye ederiz… */
  tr(`(?:öner(?:ir|iyor|ece[kğ])[ıi]?[mz]|tavsiye ed(?:er|iyor|ece[kğ])[ıi]?[mz])`),
  tr(`tavsiyem(?:iz)?${END}`),
  /* Emir kipi işlem fiilleri: alın, satın alın, ekleyin, azaltın. */
  tr(`(?:satın al(?:ın|ınız)?|alınız|satınız|ekleyin(?:iz)?|azaltın(?:ız)?|çeşitlendirin(?:iz)?|almanı|satmanı|eklemeni)${END}`),
  /* "…almayı düşünebilirsin" */
  tr(`(?:almayı|satmayı|eklemeyi|azaltmayı)\\s+düşün`),
  tr(`(?:alım|giriş) fırsatı`),
  /* İsim-fiil + iyelik: "indirmeni öneririm", "almanı" (öneri fiili düşse de). */
  tr(`${ACTION_TR}\\p{L}{0,4}m[ae]n[ıi]${END}`),
  /* Cümle ya da yan cümle sonunda emir: "…dört boşluğa dağıt:", "esas al." */
  tr(`(?:dağıt|ekle|azalt|artır|indir|çeşitlendir|kaydır|sat|al)(?=\\s*[:.!;])`),
  /* 25 Ekim incelemesi — ilk sürümün geçirdiği öneri biçimleri:
     "eklemeniz gerekir", "almanız mantıklı olur", "almak lazım". */
  tr(`${ACTION_TR}\\p{L}{0,4}m(?:[ae]n(?:[ıi]z)?|[ae]k)\\s+(?:gerek|lazım|iyi\\s+olur|mantıklı|faydalı|yararlı|akıllıca|uygun\\s+olur)`),
  /* "almanızı", "eklemenizi" (öneri fiili cümlenin başka yerinde de olsa). */
  tr(`${ACTION_TR}\\p{L}{0,4}m[ae]n[ıi]z[ıi]${END}`),
  /* İkinci kişi olasılık: "ekleyebilirsin", "azaltabilirsiniz", "düşünebilirsin". */
  tr(`(?:${ACTION_TR}\\p{L}{0,3}|düşün)[ae]bilir(?:sin|siniz)${END}`),
  /* Edilgen öneri: "önerilir", "tavsiye edilir", "sağlık fonu eklenebilir". */
  tr(`(?:öneril(?:ir|ebilir)|tavsiye\\s+edil(?:ir|ebilir))${END}`),
  tr(`(?:eklen|azaltıl|artırıl|çeşitlendiril|dağıtıl|kaydırıl|satıl|satın\\s+alın)(?:ebilir|abilir|meli|malı)${END}`),
];

const PATTERNS_EN: readonly RegExp[] = [
  /\b(?:you|investors?|one|we)\s+(?:should|must|ought to|need to|might want to|may want to)\s+(?:\w+\s+)?(?:buy|sell|add|trim|reduce|increase|rebalance|diversify|hold|consider|shift|rotate|allocate|move|switch)\b/i,
  /\b(?:i|we)\s+(?:would\s+)?(?:recommend|suggest|advise)\b/i,
  /\b(?:recommend(?:ed|s)?|suggest(?:ed|s)?|advis(?:e|ed|able))\s+(?:to\s+)?(?:buy|sell|add|trim|reduc|increas|rebalanc|diversif|hold|allocat)/i,
  /\bconsider\s+(?:buying|selling|adding|trimming|reducing|increasing|rebalancing|diversifying|allocating|rotating)\b/i,
  /\b(?:buy|sell|add|trim)\s+(?:more\s+)?(?:shares|exposure|positions?)\b/i,
  /\b(?:buying|good)\s+opportunity\b/i,
  /\b(?:i|we)\s+would\s+(?:\w+\s+)?(?:buy|sell|add|trim|reduce|increase|rebalance|diversify|hold|allocate|move|switch|own)\b/i,
  /* Cümle başı emir: "Then add JPMorgan…", "Buy XLV…" ("Adding…" geçer: sınır yok). */
  /(?:^|[.!?;:]\s+)(?:then\s+|also\s+|so\s+|instead\s+)?(?:buy|sell|add|trim|reduce|increase|rebalance|diversify|allocate|rotate|shift|fund|consider|move|switch|aim)\b/i,
  /\bby\s+(?:trimming|selling|reducing|buying|adding|rotating)\b/i,
  /\baim(?:ing)?\s+for\b/i,
  /* 25 Ekim incelemesi: olasılık kipiyle öneri ve "değer" kalıpları. */
  /\b(?:you|investors?)\s+(?:could|can|may|might)\s+(?:\w+\s+)?(?:buy|sell|add|trim|reduce|rebalance|diversify|allocate|rotate|switch)\b/i,
  /\b(?:worth|makes?\s+sense\s+to|benefit\s+from|it\s+is\s+wise\s+to)\s+(?:buying|selling|adding|trimming|reducing|rebalancing|diversifying|allocating|rotating|buy|sell|add|trim|reduce|rebalance|diversify)\b/i,
  /\b(?:is|are|would\s+be)\s+(?:recommended|advisable)\b/i,
];

/** Metinde yakalanan yönlendirme kalıpları (boşsa temiz). */
export function adviceMatches(text: string, locale: "tr" | "en"): string[] {
  const patterns = locale === "en" ? [...PATTERNS_EN, ...PATTERNS_TR] : [...PATTERNS_TR, ...PATTERNS_EN];
  const found: string[] = [];
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match) found.push(match[0]);
  }
  return found;
}

export const isAdviceFree = (text: string, locale: "tr" | "en") => adviceMatches(text, locale).length === 0;
