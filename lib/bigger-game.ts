/**
 * "Hangisi Büyük?" — Hisseyi Bil'in yanındaki ikinci oyunun SAF kuralları
 * (29 Ekim, sahibinin isteği: "başka bu tarz bir oyun varsa ayrı bir
 * tabda o oyunu da oynatabiliriz"). Ekran `components/puzzle/BiggerGame.tsx`,
 * havuz `lib/stock-puzzle-data.ts` → `biggerPool`, testi
 * `tests/bigger-game.test.ts`.
 *
 * OYUN: solda piyasa değeri açık bir şirket, sağda gizli bir şirket. Okur
 * sağdakinin "Daha Büyük" mü "Daha Küçük" mü olduğunu söyler. Bilirse sağ
 * şirket sola geçer, yeni bir rakip gelir; bilemezse oyun biter. Skor
 * kesintisiz doğru sayısı, en iyisi tarayıcıda.
 *
 * ZORLAŞAN EŞLEŞME: rakip rastgele ama oranla seçilir. Başta iki değer
 * arasında en az üç kat fark var (Apple ile bir enerji şirketi), skor
 * arttıkça pencere daralır; on doğrudan sonra iki değer birbirinin 1,6
 * katı içinde. Pencerede aday yoksa (havuzun ucundaki dev şirketler)
 * pencere genişletilir, oyun takılmaz.
 *
 * Rastgelelik dışarıdan verilir (`random`), testler tohumlu sayı kullanır.
 */

export type BiggerCompany = { symbol: string; name: string; logoUrl: string | null; sector: string | null; marketCap: number };
export type BiggerChoice = "bigger" | "smaller";

/** Skora göre iki değerin oranının ALT ve ÜST sınırı (büyük / küçük). */
export function ratioWindow(score: number): { min: number; max: number } {
  if (score < 3) return { min: 3, max: Infinity };
  if (score < 6) return { min: 1.8, max: 6 };
  if (score < 10) return { min: 1.3, max: 3 };
  return { min: 1.05, max: 1.6 };
}

const ratioOf = (a: number, b: number) => Math.max(a, b) / Math.min(a, b);

/**
 * Sıradaki rakip: bilinen şirketten farklı, yakın zamanda görülmemiş ve
 * oranı pencerede. Aday yoksa pencere iki kez genişler, sonra herhangi
 * biri. Eşit değer seçilmez (cevabı olmayan soru).
 */
export function pickChallenger(
  pool: readonly BiggerCompany[],
  known: BiggerCompany,
  score: number,
  seen: ReadonlySet<string>,
  random: () => number = Math.random,
): BiggerCompany | null {
  const base = pool.filter((company) => company.symbol !== known.symbol && company.marketCap !== known.marketCap && company.marketCap > 0);
  if (base.length === 0) return null;
  const fresh = base.filter((company) => !seen.has(company.symbol));
  const from = fresh.length > 0 ? fresh : base;
  const { min, max } = ratioWindow(score);
  for (const widen of [1, 1.5, 3]) {
    const lo = Math.max(1.01, min / widen);
    const hi = max * widen;
    const fits = from.filter((company) => {
      const ratio = ratioOf(company.marketCap, known.marketCap);
      return ratio >= lo && ratio <= hi;
    });
    if (fits.length > 0) return fits[Math.floor(random() * fits.length) % fits.length]!;
  }
  return from[Math.floor(random() * from.length) % from.length]!;
}

/** Başlangıç şirketi: havuzun büyük yarısından — okurun tanıdığı bir ad. */
export function pickStarter(pool: readonly BiggerCompany[], random: () => number = Math.random): BiggerCompany | null {
  if (pool.length === 0) return null;
  const sorted = [...pool].sort((a, b) => b.marketCap - a.marketCap);
  const top = sorted.slice(0, Math.max(1, Math.ceil(sorted.length / 2)));
  return top[Math.floor(random() * top.length) % top.length]!;
}

/** Okurun cevabı doğru mu — rakip, bilinene göre. */
export function isRight(known: BiggerCompany, challenger: BiggerCompany, choice: BiggerChoice): boolean {
  return choice === "bigger" ? challenger.marketCap > known.marketCap : challenger.marketCap < known.marketCap;
}

/** Paylaşım metni: skor ve doğruların kareleri; şirket adı yok. */
export function biggerShareText({ title, score, best, url }: { title: string; score: number; best: number; url: string }): string {
  const squares = score > 0 ? "🟩".repeat(Math.min(score, 20)) + (score > 20 ? ` +${score - 20}` : "") : "⬜";
  return `${title} ${score}\n${squares}\n🏆 ${best}\n${url}`;
}

/** Depodan okunan en iyi skor — bozuksa 0. */
export function parseBest(value: string | null): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n < 10_000 ? n : 0;
}
