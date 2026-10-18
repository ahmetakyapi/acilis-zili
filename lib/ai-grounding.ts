/**
 * Claude'un yazdığı metnin SAYI denetimi (17 Ekim) — pazar özeti yorumu,
 * "Bu Hafta Neden Hareket Etti" ve bilanço notu aynı kuralı kullanır.
 * Modele yalnız biçimlenmiş sayılar verilir; çıktıdaki her sayı girdinin
 * metninde de geçmek ZORUNDA. Geçmeyen tek sayı metni düşürür (CLAUDE.md
 * "Veri dürüstlüğü": uydurma kesinlik yok).
 */
const NUMBER = /\d+(?:[.,]\d+)*/g;

export function numbersGrounded(output: string, input: string): boolean {
  return missingNumbers(output, input).length === 0;
}

/** Tanı için: girdide birebir geçmeyen sayılar. */
export function missingNumbers(output: string, input: string): string[] {
  const allowed = new Set(input.match(NUMBER) ?? []);
  return (output.match(NUMBER) ?? []).filter((n) => !allowed.has(n));
}

/**
 * Dil sınırı aşan denetim (17 Ekim, haber notları): girdi İngilizce haber
 * metni, çıktı Türkçe — "16.8" Türkçede "16,8", "848,250" ise "848.250"
 * yazılır. Ayraçlar tek biçime indirilip karşılaştırılır; rakam dizisi
 * aynı kalmak zorunda. Gevşeklik bilinçli: "1.5" ile "1,5" aynı sayılır,
 * yeni bir rakam dizisi hâlâ metni düşürür.
 */
const unify = (n: string) => n.replace(/,/g, ".");

export function numbersGroundedAcrossLocales(output: string, input: string): boolean {
  const allowed = new Set((input.match(NUMBER) ?? []).map(unify));
  return (output.match(NUMBER) ?? []).every((n) => allowed.has(unify(n)));
}

/** Tanı için: girdide karşılığı olmayan sayılar (ayraçlar tek biçimde). */
export function ungroundedNumbers(output: string, input: string): string[] {
  const allowed = new Set((input.match(NUMBER) ?? []).map(unify));
  return (output.match(NUMBER) ?? []).filter((n) => !allowed.has(unify(n)));
}
