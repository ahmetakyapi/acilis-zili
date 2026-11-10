/** Tutar bu değerin altındaysa dört haneye KADAR: 0,0325 $ iki haneyle 0,03 olurdu. */
const SMALL_RATE = 0.1;
const SMALL_RATE_DIGITS = 4;
const BASE_DIGITS = 2;

/**
 * Küçük tutarın hane sayısı — yalnız GEREKEN kadar (10 Kasım 2026).
 *
 * Kural "0,1'in altı dört hane" idi ve bölünme sonrası yuvarlak ödemeleri
 * de dört haneyle basıyordu: NVDA'nın 0,01 dolarlık çeyrek temettüsü
 * "0,0100 $", yıl toplamı "0,0400 $" — yanındaki "0,51 $" ile aynı satırda,
 * iki ayrı hassasiyet. Dört hane gerçekten taşıyan tutar için duruyor
 * (0,0325 $); sondaki sıfırlar bilgi değil. Değer DEĞİŞMİYOR, yalnız yazımı:
 * iki haneden başlayıp, dört haneli yuvarlamayla aynı sayıyı veren en kısa
 * yazım seçiliyor.
 */
export function rateDigits(value: number): number {
  if (!(Math.abs(value) < SMALL_RATE)) return BASE_DIGITS;
  const full = Number(value.toFixed(SMALL_RATE_DIGITS));
  for (let digits = BASE_DIGITS; digits < SMALL_RATE_DIGITS; digits++) {
    if (Number(value.toFixed(digits)) === full) return digits;
  }
  return SMALL_RATE_DIGITS;
}
