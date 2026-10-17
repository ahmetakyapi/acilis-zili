/**
 * Claude'un yazdığı metnin SAYI denetimi (17 Ekim) — pazar özeti yorumu,
 * "Bu Hafta Neden Hareket Etti" ve bilanço notu aynı kuralı kullanır.
 * Modele yalnız biçimlenmiş sayılar verilir; çıktıdaki her sayı girdinin
 * metninde de geçmek ZORUNDA. Geçmeyen tek sayı metni düşürür (CLAUDE.md
 * "Veri dürüstlüğü": uydurma kesinlik yok).
 */
const NUMBER = /\d+(?:[.,]\d+)*/g;

export function numbersGrounded(output: string, input: string): boolean {
  const allowed = new Set(input.match(NUMBER) ?? []);
  return (output.match(NUMBER) ?? []).every((n) => allowed.has(n));
}
