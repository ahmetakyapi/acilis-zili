/**
 * "Yeni" rozetinin kararı — saf, istemcide de koşar (25 Ekim).
 *
 * Okurun son gördüğü giriş günü tarayıcıda (`components/changelog/
 * seen-store.ts`); burada yalnız kıyas var, test bunu sınıyor.
 *
 * DEPO BOŞKEN NE OLMALI? İki okur aynı boş depoyu taşıyor: siteyi ilk kez
 * açan ve rozetten ÖNCE gelmiş eski okur. Boşta rozet hiç basılmasaydı eski
 * okur ilk büyük sürümü hiç fark etmezdi — rozetin var olma sebebi o okur.
 * Boşta HEP basılsaydı yeni gelen okur aylar önceki bir girişe "yeni" diye
 * çağrılırdı ve rozet "sen bunu görmedin" demek yerine "burada bir sayfa
 * var" demeye başlardı. Orta yol: depo boşsa rozet yalnız en son giriş
 * TAZEYKEN (son `FRESH_DAYS` gün) görünür. Okur bir kez /yenilikler'i
 * açınca gün yazılır ve bundan sonrası düz kıyas: yayımlanan her yeni giriş,
 * kaç gün sonra gelirse gelsin rozeti yakar.
 */

/** Boş depoda rozetin yandığı süre — bir sürüm haftası ve biraz payı. */
export const FRESH_DAYS = 10;

const DAY_MS = 86_400_000;

/** Depodan okunan değer: geçerli bir gün değilse yok sayılır. */
export function parseSeen(raw: string | null): string | null {
  return raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
}

/**
 * Rozet yansın mı? `today` UTC günü ("2026-10-25"); günler ISO dizesi
 * olduğu için sözlük sırası takvim sırası.
 */
export function shouldBadge(latest: string, seen: string | null, today: string): boolean {
  if (seen) return latest > seen;
  const age = (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${latest}T00:00:00Z`)) / DAY_MS;
  return Number.isFinite(age) && age <= FRESH_DAYS;
}
