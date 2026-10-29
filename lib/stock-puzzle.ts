/**
 * "Hisseyi Bil" — günlük hisse bulmacasının SAF mantığı (24 Ekim).
 *
 * Veritabanına, sağlayıcıya, tarayıcıya dokunmaz: günün seçimi, ipucu
 * sırası, tahmin karşılaştırması, paylaşım metni ve seri hesabı burada,
 * hepsi `tests/stock-puzzle.test.ts`te sınanıyor. Veriyi toplayan sunucu
 * yolu `lib/stock-puzzle-data.ts`, oyunun istemcisi
 * `components/puzzle/StockPuzzle.tsx`.
 *
 * İSTEMCİYE DE İNİYOR (paylaşım metni, seri, geri sayım), o yüzden burada
 * sunucuya kilitli hiçbir modül içe aktarılmaz — endeks tohumu bile.
 */
import { TR_ZONE, nextZoneMidnight, zoneDateKey } from "./session-clock";

/** Tahmin hakkı — Wordle'ın altısı; ipucu sayısıyla da aynı. */
export const MAX_GUESSES = 6;

/**
 * Bulmacanın günü TÜRKİYE TAKVİMİYLE. Dil ne olursa olsun herkes aynı gün
 * aynı hisseyi görmeli: paylaşılan "#12" İstanbul'daki okur ile New
 * York'taki okur için aynı bulmaca. İngilizce arayüz de bu yüzden TR gece
 * yarısında döner (geri sayım bunu söylüyor).
 */
export const PUZZLE_ZONE = TR_ZONE;

/** 1 numaralı bulmacanın günü — "#N" bu günden sayılır. */
export const PUZZLE_EPOCH = "2026-10-24";

/**
 * Havuzun tavanı: piyasa değeri sırasında ilk 200 endeks üyesi. 150'nin
 * altında havuz birkaç ayda bir kendini tekrarlıyor, 250'nin üstünde
 * okuyucunun adını hiç duymadığı şirketler giriyor (S&P 500'ün kuyruğu
 * ~20 milyar dolar). Kural `lib/stock-puzzle-data.ts` → `puzzlePool`.
 */
export const POOL_SIZE = 200;

/** Siluetin nokta sayısı — bir yıl ~250 işlem günü, 64 nokta şekli taşıyor
    ama gün gün fiyatı taşımıyor (cevabı barlarla eşleştirmek zorlaşsın). */
export const SILHOUETTE_POINTS = 64;

const DAY_MS = 86_400_000;

/* ---------------------------------------------------------------------------
   İpuçları
   --------------------------------------------------------------------------- */

/**
 * İpucu BASAMAKLARI, GENELDEN ÖZELE (25 Ekim; ilk sürümde tek sıra, altı
 * ipucuydu). Başta yalnız siluet; her yanlış tahmin (ya da joker) bir
 * basamak açar, basamakta iki ipucu. Sıra kuralı: bir basamak havuzu
 * daraltır ama tek başına cevabı vermez (ölçü `tests/stock-puzzle.test.ts`
 * → "early steps never pin the answer"): sektör 11 kova, temettü
 * öder/ödemez iki kova; piyasa değeri yedi bant, oynaklık sürekli bir
 * sayı; endüstri (GICS alt sektörü) havuzda çoğunlukla 2-10 şirket, o
 * yüzden dördüncü basamakta; harf kutuları ve baş harf sonda, işi
 * bitiren ipuçları.
 *
 * Verisi olmayan ipucu ATLANIR, yerine uydurma bir değer konmaz; basamak
 * boş kalırsa bile basamak sayılır (açılma sırası herkes için aynı).
 * Kaynaklar ve havuzdaki kapsama `lib/stock-puzzle-data.ts` başında.
 */
export const CLUE_STEPS = [
  ["silhouette"],
  ["sector", "dividend"],
  ["capBand", "beta"],
  ["ipoYear", "revenueGrowth"],
  ["industry", "netMargin"],
  ["letters", "initial"],
] as const;

export type ClueKind = (typeof CLUE_STEPS)[number][number];

export const CLUE_ORDER: readonly ClueKind[] = CLUE_STEPS.flat();

/** İpucunun basamağı (0 başta açık). */
export function stepOf(kind: ClueKind): number {
  return CLUE_STEPS.findIndex((step) => (step as readonly ClueKind[]).includes(kind));
}

/**
 * BAŞTA İKİ BASAMAK AÇIK (29 Ekim, sahibinin isteği: "biraz daha fazla
 * ipucu verelim, kolaylaştıralım"). İlk sürümde oyun yalnız siluetle
 * başlıyordu; ilk tahmin çoğu zaman kör bir atıştı ve sahibinin 25-29
 * Ekim arşivinde beş bulmacanın üçü "Bilinemedi". Şimdi siluetin yanında
 * sektör ve temettü baştan açık; her yanlış yine bir basamak açar, dört
 * yanlıştan sonra bütün ipuçları ortada ve iki hak kalıyor.
 */
export const START_STEPS = 2;

/** İpucunun açılması için gereken yanlış sayısı (0: baştan açık). */
export function missesToOpen(kind: ClueKind): number {
  return Math.max(0, stepOf(kind) - (START_STEPS - 1));
}

export type Clue =
  | { kind: "silhouette"; points: number[] }
  /** GICS ana sektörü, İngilizce anahtar — ekranda `sectorLabel` ile.
      `gics` ekrana inen ipucunda ham adı taşır (karonun sektör simgesi,
      `components/puzzle/ClueBoard.tsx`); dile çevrilen ad `sector`te. */
  | { kind: "sector"; sector: string; gics?: string }
  /** Yıllık temettü verimi, yüzde; 0 ödemiyor demek. */
  | { kind: "dividend"; yieldPct: number }
  | { kind: "capBand"; band: number }
  /** Piyasaya göre oynaklık (beta, 1 = piyasa kadar). */
  | { kind: "beta"; beta: number }
  | { kind: "ipoYear"; year: number }
  /** Son 12 ayın gelir büyümesi, yüzde (Finnhub `revenueGrowthTTMYoy`). */
  | { kind: "revenueGrowth"; pct: number }
  /** GICS alt sektörü, İngilizce anahtar — ekranda `industryLabel` ile. */
  | { kind: "industry"; industry: string }
  /** Son 12 ayın net kâr marjı, yüzde. */
  | { kind: "netMargin"; pct: number }
  /** Sembolün kalıbı: harf yerine "•", noktalama olduğu gibi ("•••.•"). */
  | { kind: "letters"; shape: string }
  | { kind: "initial"; letter: string };

/** Bulmacanın cevabı hakkında bilinenler — sunucu doldurur. */
export type PuzzleFacts = {
  symbol: string;
  name: string;
  sector: string | null;
  marketCap: number | null;
  ipoYear: number | null;
  revenueGrowth: number | null;
  silhouette: number[] | null;
  dividendYield?: number | null;
  beta?: number | null;
  industry?: string | null;
  netMargin?: number | null;
};

/**
 * Piyasa değeri bantları (dolar, alt sınırlar). Bant N:
 * [CAP_BANDS[N], CAP_BANDS[N+1]); sonuncunun üstü açık.
 *
 * Havuzun tabanı 63 milyar (24 Ekim, 200. sıra Targa Resources) ve
 * dağılım çok çarpık: 200 hissenin 80'i 100 milyarın altında, 1 trilyonun
 * üstünde 11. Bantlar bu yüzden altta sık, üstte seyrek; eşit aralıklı
 * bantlarda ilk bant havuzun yarısını tutuyor ve ipucu bir şey
 * daraltmıyordu. Ölçüm: [0,100,200,500,1000,3000] milyarda 80/64/36/9/7/4;
 * bugünkü bantlarla 25/55/34/42/24/9/11.
 */
export const CAP_BANDS = [0, 75e9, 100e9, 150e9, 250e9, 500e9, 1e12] as const;

export function capBandOf(marketCap: number): number {
  let band = 0;
  for (let i = 0; i < CAP_BANDS.length; i++) if (marketCap >= CAP_BANDS[i]) band = i;
  return band;
}

/**
 * Halka arz yılı yalnızca 1980'den bu yana. Sağlayıcının `ipo` alanı eski
 * şirketlerde verinin başladığı günü yazıyor, halka arzı değil: Coca-Cola
 * 1950 görünüyor (1919'da halka açıldı). O alan yanlışsa ipucu da yanlış;
 * 1980 öncesi için ipucu hiç basılmıyor. Apple (1980), Nvidia (1999),
 * Walmart (1972 → basılmıyor) yerelde ölçüldü; havuzun 200 hissesinden
 * 139'unda ipucu var (24 Ekim).
 */
export const IPO_YEAR_FLOOR = 1980;

/** Görünen addan baş harf — "The" ve noktalama atlanmaz, ad olduğu gibi. */
function initialOf(name: string): string | null {
  const match = /\p{L}|\p{N}/u.exec(name);
  return match ? match[0].toLocaleUpperCase("en-US") : null;
}

const round1 = (value: number) => Math.round(value * 10) / 10;
const finite = (value: number | null | undefined): value is number => typeof value === "number" && Number.isFinite(value);

/** Sembolün harf kalıbı — harf ve rakam "•", noktalama korunur. */
export function symbolShape(symbol: string): string {
  return symbol.replace(/[A-Z0-9]/g, "•");
}

/** Bilinenlerden ipucu listesi, basamak sırasıyla, eksik olan atlanmış. */
export function cluesFor(facts: PuzzleFacts): Clue[] {
  const out: Clue[] = [];
  for (const kind of CLUE_ORDER) {
    switch (kind) {
      case "silhouette":
        if (facts.silhouette && facts.silhouette.length >= 2) out.push({ kind, points: facts.silhouette });
        break;
      case "sector":
        if (facts.sector) out.push({ kind, sector: facts.sector });
        break;
      case "dividend":
        if (finite(facts.dividendYield) && facts.dividendYield >= 0) out.push({ kind, yieldPct: Math.round(facts.dividendYield * 100) / 100 });
        break;
      case "capBand":
        if (facts.marketCap !== null && facts.marketCap > 0) out.push({ kind, band: capBandOf(facts.marketCap) });
        break;
      case "beta":
        if (finite(facts.beta)) out.push({ kind, beta: Math.round(facts.beta * 100) / 100 });
        break;
      case "ipoYear":
        if (facts.ipoYear !== null && facts.ipoYear >= IPO_YEAR_FLOOR) out.push({ kind, year: facts.ipoYear });
        break;
      case "revenueGrowth":
        if (finite(facts.revenueGrowth)) out.push({ kind, pct: round1(facts.revenueGrowth) });
        break;
      case "industry":
        if (facts.industry) out.push({ kind, industry: facts.industry });
        break;
      case "netMargin":
        if (finite(facts.netMargin)) out.push({ kind, pct: round1(facts.netMargin) });
        break;
      case "letters":
        out.push({ kind, shape: symbolShape(facts.symbol) });
        break;
      case "initial": {
        const letter = initialOf(facts.name);
        if (letter) out.push({ kind, letter });
        break;
      }
    }
  }
  return out;
}

/**
 * Görünen ipuçları: açık basamaklardakiler. Başta `START_STEPS` basamak
 * (siluet; sektör ve temettü), her yanlış tahmin ve her joker bir fazlası.
 * Bitmiş bulmacada hepsi açılır (sonuç kartı ne bilinmesi gerektiğini
 * gösterir).
 */
export function visibleClues(clues: readonly Clue[], misses: number, finished: boolean): Clue[] {
  if (finished) return [...clues];
  const opened = START_STEPS + Math.max(0, misses);
  return clues.filter((clue) => stepOf(clue.kind) < opened);
}

/* ---------------------------------------------------------------------------
   Günün seçimi
   --------------------------------------------------------------------------- */

/** "YYYY-MM-DD" → 1970'ten bu yana gün sayısı. */
export function dayNumberOf(dayKey: string): number {
  return Math.floor(Date.parse(`${dayKey}T00:00:00Z`) / DAY_MS);
}

/** Bulmaca numarası — `PUZZLE_EPOCH` 1. */
export function puzzleNumber(dayKey: string): number {
  return dayNumberOf(dayKey) - dayNumberOf(PUZZLE_EPOCH) + 1;
}

/** Bulmacanın bugünkü günü, TR takvimiyle. */
export function puzzleDayKey(now: Date = new Date()): string {
  return zoneDateKey(now, PUZZLE_ZONE);
}

/** Sonraki bulmacanın başladığı an (TR gece yarısı). */
export function nextPuzzleAt(nowMs: number): Date {
  return nextZoneMidnight(nowMs, PUZZLE_ZONE);
}

/** FNV-1a — tohum için kararlı, bağımlılıksız 32 bit özet. */
export function hash32(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Döngü içindeki sıranın anahtarı: (sembol, döngü) → sıralanabilir dize.
 * Sunucu bunu GİZLİ bir sırla türetir (`lib/stock-puzzle-data.ts` →
 * `secretRank`); buradaki varsayılan yalnız testler ve sırsız geliştirme
 * için, gizli değil.
 */
export type PuzzleRank = (symbol: string, cycle: number) => string;

export const publicRank: PuzzleRank = (symbol, cycle) =>
  hash32(`hisseyi-bil:${cycle}:${symbol}`).toString(16).padStart(8, "0");

/**
 * Günün cevabı.
 *
 * TEKRARSIZ DÖNGÜ: havuz her döngüde anahtara göre sıralanıyor (bir
 * permütasyon); gün, döngünün içindeki sırayı seçiyor. Havuz aynı kaldıkça
 * 200 gün boyunca hiçbir hisse ikinci kez gelmiyor. Rastgele özetle gün
 * başına seçmek aynı haftada iki kez Apple getirebiliyordu.
 *
 * SIRA GİZLİ (25 Ekim düzeltmesi). İlk sürüm karıştırmayı herkesin
 * bildiği bir tohumdan (`"hisseyi-bil:" + döngü`) kuruyordu; havuz kamuya
 * açık veriden (endeks üyeliği × piyasa değeri) çıktığı için yarının,
 * hatta bütün döngünün cevabı tarayıcıda hesaplanabiliyordu. Artık
 * anahtar `rank`tan geliyor ve sunucu onu sırdan HMAC ile üretiyor. Her
 * sembolün anahtarı AYRI özet: 32 bitlik tek bir tohumla karıştırılsaydı
 * birkaç günün cevabını bilen biri 2^32 tohumu deneyip döngünün kalanını
 * bulabilirdi; özet başına anahtarda deneyecek tohum yok.
 *
 * Havuz piyasa değeriyle değiştiği için (sıranın kenarındaki bir hisse
 * düşüp yenisi girdiğinde) seçilen sıra kayabilir; tekrar o zaman mümkün,
 * kabul edilmiş bir bedel. Gün İÇİNDE cevabın değişmemesini sunucu
 * sağlıyor: seçim günün anahtarıyla önbelleğe yazılıyor
 * (`lib/stock-puzzle-data.ts` → `dailyAnswer`).
 */
export function pickDaily(pool: readonly string[], dayNumber: number, rank: PuzzleRank = publicRank): string | null {
  if (pool.length === 0) return null;
  const unique = [...new Set(pool)];
  const length = unique.length;
  const cycle = Math.floor(dayNumber / length);
  const index = ((dayNumber % length) + length) % length;
  const keyed = unique.map((symbol) => ({ symbol, key: rank(symbol, cycle) }));
  keyed.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : a.symbol.localeCompare(b.symbol)));
  return keyed[index].symbol;
}

/* ---------------------------------------------------------------------------
   Siluet
   --------------------------------------------------------------------------- */

/**
 * Kapanışlardan eksensiz siluet: eşit aralıklı `points` nokta (ilk ve son
 * dahil), 0-1 arasına ölçeklenmiş, üç haneye yuvarlanmış. Fiyat da tarih
 * de gitmiyor; yalnız şekil. Düz ya da kısa seri siluet değil, `null`.
 */
export function silhouetteOf(closes: readonly number[], points: number = SILHOUETTE_POINTS): number[] | null {
  const clean = closes.filter((value) => Number.isFinite(value) && value > 0);
  if (clean.length < 2 || points < 2) return null;
  const count = Math.min(points, clean.length);
  const picked: number[] = [];
  for (let i = 0; i < count; i++) picked.push(clean[Math.round((i * (clean.length - 1)) / (count - 1))]);
  const min = Math.min(...picked);
  const max = Math.max(...picked);
  if (max - min <= 0) return null;
  return picked.map((value) => Math.round(((value - min) / (max - min)) * 1000) / 1000);
}

/* ---------------------------------------------------------------------------
   Tahmin
   --------------------------------------------------------------------------- */

/** Bir şirket hakkında karşılaştırmaya girenler — tahmin de cevap da. */
export type CompanyBrief = {
  symbol: string;
  sector: string | null;
  marketCap: number | null;
  /** Sağlayıcının halka arz yılı; 1980 öncesi güvenilmez (`IPO_YEAR_FLOOR`). */
  ipoYear: number | null;
  /** Son 12 ayın gelir büyümesi, yüzde. */
  revenueGrowth: number | null;
};

/**
 * KARŞILAŞTIRMA KAROLARI (25 Ekim, Wordle'ın renkli kareleri gibi).
 *
 * İlk sürüm yanlış tahmine yalnız iki çip veriyordu (aynı sektör mü, daha
 * büyük mü); okur her tahminden bir bit öğreniyordu ve ipucu kartları tek
 * bilgi kaynağıydı. Şimdi her tahmin dört karo: sektör, piyasa değeri,
 * halka arz yılı, gelir büyümesi. Her karo TAHMİN EDİLEN şirketin kendi
 * değerini (cevabın değil) ve cevabın ona göre yerini taşır:
 *
 *   `grade` — "match" tutuyor, "near" yakın, "far" uzak; renk bundan
 *   (yumuşak yeşil / pirinç / nötr). Sitenin görüş üçlüsüyle aynı aile:
 *   yeşil iyi, pirinç arada.
 *   `toward` — cevap bu değerin "up" üstünde, "down" altında; eşitse null.
 *   Ok yön demek, renk değil (fiyat hareketi değil, "daha büyüğünü ara").
 *
 * Eşikler aşağıda, adlı sabitler. Karo bir tarafın verisi yoksa null:
 * bilinmeyen bir şeyi "uzak" diye boyamak uydurma olurdu.
 *
 * CEVAP SIZMAZ: karo yalnız sınıf ve yön taşır, cevabın değerini değil.
 * Karşılaştırma sunucuda (`lib/stock-puzzle-data.ts` → `evaluatePuzzle`).
 */
export type Grade = "match" | "near" | "far";
export type Toward = "up" | "down" | null;

export type GuessTile = {
  /** null: yön biliniyor ama uzaklık bilinmiyor (yalnız 1980 öncesi halka arz). */
  grade: Grade | null;
  toward: Toward;
};

export const TILE_KINDS = ["sector", "cap", "ipo", "growth"] as const;
export type TileKind = (typeof TILE_KINDS)[number];

/** Halka arzda "yakın": beş yıl içinde. */
export const IPO_NEAR_YEARS = 5;
/** Gelir büyümesinde "tutuyor": iki puan içinde; "yakın": on puan içinde. */
export const GROWTH_MATCH_POINTS = 2;
export const GROWTH_NEAR_POINTS = 10;

const towardOf = (guess: number, answer: number): Toward => (answer > guess ? "up" : answer < guess ? "down" : null);

/** Piyasa değeri: aynı bant tutuyor, komşu bant yakın (bantlar ipucuyla aynı). */
export function capTile(guess: number | null, answer: number | null): GuessTile | null {
  if (guess === null || answer === null || guess <= 0 || answer <= 0) return null;
  const gap = Math.abs(capBandOf(guess) - capBandOf(answer));
  return { grade: gap === 0 ? "match" : gap === 1 ? "near" : "far", toward: towardOf(guess, answer) };
}

/**
 * Halka arz: aynı yıl tutuyor, beş yıl içi yakın. 1980 öncesi yıl
 * sağlayıcıda halka arz değil verinin başladığı gün (`IPO_YEAR_FLOOR`);
 * gerçek yıl o değerden ÖNCE. Bir taraf 1980 öncesiyse yön yine kesin
 * (öteki 1980 ve sonrası), uzaklık ancak öteki 1980'den beş yıldan
 * fazla sonraysa kesin; değilse `grade: null`. İkisi de öncesiyse karo yok.
 */
export function ipoTile(guess: number | null, answer: number | null): GuessTile | null {
  if (guess === null || answer === null) return null;
  const guessOld = guess < IPO_YEAR_FLOOR;
  const answerOld = answer < IPO_YEAR_FLOOR;
  if (guessOld && answerOld) return null;
  if (guessOld || answerOld) {
    const known = guessOld ? answer : guess;
    const grade: Grade | null = known - (IPO_YEAR_FLOOR - 1) > IPO_NEAR_YEARS ? "far" : null;
    return { grade, toward: guessOld ? "up" : "down" };
  }
  const gap = Math.abs(guess - answer);
  return { grade: gap === 0 ? "match" : gap <= IPO_NEAR_YEARS ? "near" : "far", toward: towardOf(guess, answer) };
}

/** Gelir büyümesi: puan farkıyla; iki puan içinde yön oku basılmaz. */
export function growthTile(guess: number | null, answer: number | null): GuessTile | null {
  if (guess === null || answer === null || !Number.isFinite(guess) || !Number.isFinite(answer)) return null;
  const gap = Math.abs(guess - answer);
  if (gap <= GROWTH_MATCH_POINTS) return { grade: "match", toward: null };
  return { grade: gap <= GROWTH_NEAR_POINTS ? "near" : "far", toward: towardOf(guess, answer) };
}

export function sectorTile(guess: string | null, answer: string | null): GuessTile | null {
  if (!guess || !answer) return null;
  return { grade: guess === answer ? "match" : "far", toward: null };
}

export type GuessFeedback = {
  symbol: string;
  correct: boolean;
  tiles: Record<TileKind, GuessTile | null>;
  /** Tahmin edilen şirketin KENDİ değerleri — karoda yazan sayı. Cevap değil. */
  values: {
    sector: string | null;
    marketCap: number | null;
    ipoYear: number | null;
    revenueGrowth: number | null;
  };
};

const MATCH_TILE: GuessTile = { grade: "match", toward: null };

export function compareGuess(guess: CompanyBrief, answer: CompanyBrief): GuessFeedback {
  const correct = guess.symbol === answer.symbol;
  const values = {
    sector: guess.sector,
    marketCap: guess.marketCap,
    ipoYear: guess.ipoYear,
    revenueGrowth: guess.revenueGrowth === null ? null : Math.round(guess.revenueGrowth * 10) / 10,
  };
  if (correct) {
    return { symbol: guess.symbol, correct, values, tiles: { sector: MATCH_TILE, cap: MATCH_TILE, ipo: MATCH_TILE, growth: MATCH_TILE } };
  }
  return {
    symbol: guess.symbol,
    correct,
    values,
    tiles: {
      sector: sectorTile(guess.sector, answer.sector),
      cap: capTile(guess.marketCap, answer.marketCap),
      ipo: ipoTile(guess.ipoYear, answer.ipoYear),
      growth: growthTile(guess.revenueGrowth, answer.revenueGrowth),
    },
  };
}

/**
 * JOKER (25 Ekim): okur bir tahmin hakkını harcayıp sıradaki basamağı
 * erken açar. Listede `JOKER` işaretiyle durur, sunucu onu boş bir satır
 * olarak değerlendirir (karo yok, ıska sayılır). Son hakta joker yok —
 * bulmacayı kaybettirmekten başka işi olmazdı; açılacak basamak
 * kalmadıysa da yok.
 */
export const JOKER = "*";
export const isJoker = (symbol: string) => symbol === JOKER;

export function jokerFeedback(): GuessFeedback {
  return {
    symbol: JOKER,
    correct: false,
    tiles: { sector: null, cap: null, ipo: null, growth: null },
    values: { sector: null, marketCap: null, ipoYear: null, revenueGrowth: null },
  };
}

export function jokerAllowed(entries: number, stepsLeft: number): boolean {
  return entries < MAX_GUESSES - 1 && stepsLeft > 0;
}

/**
 * "Çok Yakın!" — yanlış ama aynı sektörde ve aynı piyasa değeri bandında.
 * Havuzda bu ikisini birlikte tutan şirket genellikle birkaç tane; okur
 * doğru mahallede olduğunu bilsin.
 */
export function isClose(feedback: Pick<GuessFeedback, "correct" | "tiles">): boolean {
  return !feedback.correct && feedback.tiles.sector?.grade === "match" && feedback.tiles.cap?.grade === "match";
}

/** "Saf Bilgi" rozeti: joker kullanmadan, ilk iki tahminde bildin. */
export const PURE_MAX_GUESSES = 2;

export function isPureWin(feedback: readonly Pick<GuessFeedback, "correct" | "symbol">[]): boolean {
  const hit = feedback.findIndex((row) => row.correct);
  return hit >= 0 && hit < PURE_MAX_GUESSES && !feedback.slice(0, hit).some((row) => isJoker(row.symbol));
}

export type PuzzleStatus = "playing" | "won" | "lost";

export function statusOf(feedback: readonly Pick<GuessFeedback, "correct">[]): PuzzleStatus {
  if (feedback.some((item) => item.correct)) return "won";
  return feedback.length >= MAX_GUESSES ? "lost" : "playing";
}

/* ---------------------------------------------------------------------------
   Siluetin ekseni — oyun ilerledikçe açılır
   --------------------------------------------------------------------------- */

/**
 * Siluetin ölçüsü: örneklenmiş kapanışların en düşüğü, en yükseği ve
 * sonuncusu, ilk ve son barın ET günü. YALNIZ SUNUCUDA, cevabın parçası.
 */
export type SilhouetteRange = { low: number; high: number; last: number; from: string; to: string };

/** Kaçıncı yanlış tahminden sonra siluetin yüzde ekseni açılır (29 Ekim:
    3'ten 2'ye, kolaylaştırma turu — `START_STEPS`). */
export const AXIS_AFTER_MISSES = 2;

/**
 * Oyun ilerledikçe siluet bilgi açar (25 Ekim). Başta eksensiz şekil; üç
 * yanlıştan sonra yalnızca YAYILIM (en yüksek / en düşük - 1, yüzde): okur
 * şekli "başlangıca göre yüzde" eksenine oturtabilir, yılın getirisi
 * okunur ama fiyat ve tarih yine yok. Fiyat ve tarih yalnız bitmiş
 * bulmacada (`answer.chart`). Siluet şekli zaten açık olduğundan tek sayı
 * cevabı vermiyor, havuzu daraltıyor: altıncı ipucunun (baş harf) yerini
 * almıyor, üçüncüyle dördüncü arasına bir basamak ekliyor.
 */
export function axisFor(range: SilhouetteRange | null, misses: number, finished: boolean): { spreadPct: number } | null {
  if (!range || range.low <= 0 || range.high <= range.low) return null;
  if (!finished && misses < AXIS_AFTER_MISSES) return null;
  return { spreadPct: Math.round((range.high / range.low - 1) * 1000) / 10 };
}

/**
 * Siluet yüksekliğinin (0-1) başlangıca göre yüzdesi. Nokta y'nin değeri
 * `low * (1 + y * spread)`; ilk noktanınki aynı formülle. Yalnız oran
 * gerekiyor, fiyat değil — ekseni istemci bu yüzden fiyatsız çizebiliyor.
 */
export function pctFromStart(y: number, first: number, spreadPct: number): number {
  const spread = spreadPct / 100;
  return ((1 + y * spread) / (1 + first * spread) - 1) * 100;
}

/* ---------------------------------------------------------------------------
   Paylaşım
   --------------------------------------------------------------------------- */

/**
 * Izgara kareleri — her tahmin bir satır, her karo bir kare (25 Ekim).
 * Yeşil tutuyor, sarı yakın, beyaz uzak, siyah bilinmiyor. Ekrandaki karo
 * renkleriyle aynı anlam (sarı = pirinç). Doğru tahmin dört yeşil.
 */
export const SHARE_SQUARES = { match: "🟩", near: "🟨", far: "⬜", unknown: "⬛", joker: "🃏" } as const;

export function shareGrid(feedback: readonly Pick<GuessFeedback, "tiles" | "symbol">[]): string {
  return feedback
    .slice(0, MAX_GUESSES)
    .map((row) =>
      isJoker(row.symbol)
        ? SHARE_SQUARES.joker
        : TILE_KINDS.map((kind) => SHARE_SQUARES[row.tiles[kind]?.grade ?? (row.tiles[kind] ? "far" : "unknown")]).join(""),
    )
    .join("\n");
}

/**
 * Paylaşım metni: "Açılış Zili Hisseyi Bil #12 3/6", ızgara, bağlantı.
 * Cevap metne GİRMEZ — paylaşılan sonuç başkasının bulmacasını bozmasın;
 * kareler yalnız tutuyor/yakın/uzak der, değer taşımaz.
 */
export function shareText({
  title,
  number,
  feedback,
  url,
}: {
  title: string;
  number: number;
  feedback: readonly Pick<GuessFeedback, "correct" | "tiles" | "symbol">[];
  url: string;
}): string {
  const status = statusOf(feedback);
  const score = status === "won" ? `${feedback.findIndex((item) => item.correct) + 1}/${MAX_GUESSES}` : `X/${MAX_GUESSES}`;
  return `${title} #${number} ${score}\n${shareGrid(feedback)}\n${url}`;
}

/* ---------------------------------------------------------------------------
   Seri ve dağılım (tarayıcıda saklanır)
   --------------------------------------------------------------------------- */

export type PuzzleStats = {
  played: number;
  wins: number;
  /** Bugüne kadarki kesintisiz kazanma serisi — gösterimde `currentStreak`. */
  streak: number;
  best: number;
  /** Son oynanan / son kazanılan günün numarası (`dayNumberOf`). */
  lastPlayed: number | null;
  lastWon: number | null;
  /** distribution[i]: i+1 tahminde kazanılan oyun sayısı. */
  distribution: number[];
  /** Arşivden çözülen bulmacalar — günlük seriye ve dağılıma girmez. */
  archiveWins: number;
  /** "Saf Bilgi" kazançları (`isPureWin`), günlük ve arşiv birlikte. */
  pureWins: number;
};

export function emptyStats(): PuzzleStats {
  return { played: 0, wins: 0, streak: 0, best: 0, lastPlayed: null, lastWon: null, distribution: Array(MAX_GUESSES).fill(0), archiveWins: 0, pureWins: 0 };
}

const nonNegative = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
const dayOrNull = (value: unknown): number | null =>
  typeof value === "number" && Number.isInteger(value) ? value : null;

/** Depodan okunan değeri tipe oturtur; bozuk ya da boşsa sıfır istatistik. */
export function parseStats(value: unknown): PuzzleStats {
  if (!value || typeof value !== "object") return emptyStats();
  const raw = value as Record<string, unknown>;
  const dist = Array.isArray(raw.distribution) ? raw.distribution : [];
  return {
    played: nonNegative(raw.played),
    wins: nonNegative(raw.wins),
    streak: nonNegative(raw.streak),
    best: nonNegative(raw.best),
    lastPlayed: dayOrNull(raw.lastPlayed),
    lastWon: dayOrNull(raw.lastWon),
    distribution: Array.from({ length: MAX_GUESSES }, (_, i) => nonNegative(dist[i])),
    archiveWins: nonNegative(raw.archiveWins),
    pureWins: nonNegative(raw.pureWins),
  };
}

/**
 * Biten bir oyunu istatistiğe işler. AYNI GÜN İKİ KEZ SAYILMAZ (sayfa
 * yenilenince bitmiş oyun yeniden "bitiyor"). Seri, dünü kazanmışsa bir
 * artar, değilse 1'den başlar; kayıp seriyi sıfırlar.
 */
export function recordGame(stats: PuzzleStats, day: number, won: boolean, guesses: number, pure = false): PuzzleStats {
  if (stats.lastPlayed !== null && stats.lastPlayed >= day) return stats;
  const next: PuzzleStats = { ...stats, distribution: [...stats.distribution], played: stats.played + 1, lastPlayed: day };
  if (won && pure) next.pureWins += 1;
  if (won) {
    next.wins += 1;
    next.streak = stats.lastWon === day - 1 ? stats.streak + 1 : 1;
    next.best = Math.max(stats.best, next.streak);
    next.lastWon = day;
    const slot = Math.min(MAX_GUESSES, Math.max(1, guesses)) - 1;
    next.distribution[slot] += 1;
  } else {
    next.streak = 0;
  }
  return next;
}

/**
 * Arşivden bitirilen bulmaca (25 Ekim): seriyi BOZMAZ, günlük dağılıma
 * girmez; yalnız "Arşivden Çözülen" sayacı. Aynı günün iki kez sayılmaması
 * çağıranın işi (geçmiş kaydında gün zaten bitmişse çağrılmaz).
 */
export function recordArchiveGame(stats: PuzzleStats, won: boolean, pure = false): PuzzleStats {
  if (!won) return stats;
  return { ...stats, archiveWins: stats.archiveWins + 1, pureWins: stats.pureWins + (pure ? 1 : 0) };
}

/**
 * Ekrandaki seri: son kazanç bugün ya da dünse saklanan seri, değilse 0 —
 * bir gün atlayan okur ertesi gün "Seri 5" görmesin.
 */
export function currentStreak(stats: PuzzleStats, today: number): number {
  return stats.lastWon !== null && today - stats.lastWon <= 1 ? stats.streak : 0;
}

/* ---------------------------------------------------------------------------
   Uç sözleşmesi — sunucu (`/api/bulmaca`, sayfa) ile istemci arasında
   --------------------------------------------------------------------------- */

/** Arama kutusunun seçeneği — havuzdaki bir şirket. */
export type PoolOption = {
  symbol: string;
  name: string;
  logoUrl: string | null;
  /** Katlanmış arama metni: sembol, iki ad, takma adlar (`foldForSearch`). */
  haystack: string;
  /* ADAY SÜZGECİNİN GİRDİSİ (29 Ekim) — havuzdaki HER şirketin kamuya açık
     değerleri, cevabınki değil; cevap bunlardan çıkarılamaz, yalnız açılmış
     ipuçlarıyla birlikte daraltır (`fitsClues`). */
  /** GICS sektörü, İngilizce anahtar (ipucunun `gics` alanıyla aynı). */
  sector?: string | null;
  marketCap?: number | null;
  /** GICS alt sektörü, ekrandaki dilin adıyla (ipucunun `industry`siyle aynı). */
  industry?: string | null;
};

/**
 * İPUÇLARINA UYAN ADAYLAR (29 Ekim, kolaylaştırma turu). Okur her
 * tahminden sonra 200 şirketlik havuzu kafasında süzüyordu; tahmin kutusu
 * artık açılmış ipuçlarıyla ve yanlış tahminlerin karolarıyla ÇELİŞMEYEN
 * şirketleri öne alıyor ve kaç tane kaldığını söylüyor. Yalnız ekranda
 * zaten açık bilgi kullanılır: sektör, piyasa değeri bandı, endüstri,
 * harf kalıbı, baş harf; yanlış tahminin sektör ve piyasa değeri karosu
 * (tutuyor / yakın / uzak, yön). Bir şirketin verisi yoksa o ölçüde
 * elenmez — bilinmeyen "uymuyor" sayılmaz.
 */
export function fitsClues(
  option: PoolOption,
  clues: readonly Clue[],
  guesses: readonly Pick<GuessFeedback, "symbol" | "correct" | "tiles" | "values">[],
  bySymbol: ReadonlyMap<string, PoolOption>,
): boolean {
  for (const clue of clues) {
    switch (clue.kind) {
      case "sector":
        if (clue.gics && option.sector && option.sector !== clue.gics) return false;
        break;
      case "capBand":
        if (option.marketCap && option.marketCap > 0 && capBandOf(option.marketCap) !== clue.band) return false;
        break;
      case "industry":
        if (option.industry && option.industry !== clue.industry) return false;
        break;
      case "letters":
        if (symbolShape(option.symbol) !== clue.shape) return false;
        break;
      case "initial": {
        const letter = initialOf(option.name);
        if (letter && letter !== clue.letter) return false;
        break;
      }
    }
  }
  for (const row of guesses) {
    if (isJoker(row.symbol) || row.correct) continue;
    if (row.symbol === option.symbol) return false;
    const guessSector = bySymbol.get(row.symbol)?.sector;
    const sector = row.tiles.sector;
    if (sector && guessSector && option.sector) {
      if (sector.grade === "match" && option.sector !== guessSector) return false;
      if (sector.grade === "far" && option.sector === guessSector) return false;
    }
    const cap = row.tiles.cap;
    const guessCap = row.values.marketCap;
    const optionCap = option.marketCap;
    if (cap && guessCap && guessCap > 0 && optionCap && optionCap > 0) {
      if (cap.toward === "up" && !(optionCap > guessCap)) return false;
      if (cap.toward === "down" && !(optionCap < guessCap)) return false;
      const gap = Math.abs(capBandOf(optionCap) - capBandOf(guessCap));
      if (cap.grade === "match" && gap !== 0) return false;
      if (cap.grade === "near" && gap !== 1) return false;
      if (cap.grade === "far" && gap < 2) return false;
    }
  }
  return true;
}

/** Uyan adaylar, piyasa değerine göre büyükten küçüğe (bilinen isim önce). */
export function candidatesFor(
  options: readonly PoolOption[],
  clues: readonly Clue[],
  guesses: readonly Pick<GuessFeedback, "symbol" | "correct" | "tiles" | "values">[],
): PoolOption[] {
  const bySymbol = new Map(options.map((option) => [option.symbol, option]));
  return options
    .filter((option) => fitsClues(option, clues, guesses, bySymbol))
    .sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0) || a.symbol.localeCompare(b.symbol));
}

/** Ekrana inen tahmin satırı. */
export type GuessRow = GuessFeedback & { name: string; logoUrl: string | null };

/**
 * İstemcinin gördüğü bulmaca. CEVAP YALNIZCA BİTMİŞ BULMACADA (`answer`)
 * gelir; oynanırken istemci açılmış ipuçlarını ve sıradaki ipuçlarının
 * TÜRÜNÜ (değerini değil) bilir.
 */
export type PuzzleState = {
  day: string;
  number: number;
  status: PuzzleStatus;
  clues: Clue[];
  /** Henüz açılmamış ipuçlarının türleri, sırasıyla. */
  upcoming: ClueKind[];
  guesses: GuessRow[];
  /** Siluetin yüzde ekseni — üç yanlıştan sonra (`axisFor`); öncesinde null. */
  axis: { spreadPct: number } | null;
  answer?: {
    symbol: string;
    name: string;
    logoUrl: string | null;
    /** Şirketin tek cümlelik tanıtımı (depodaki iş tanımından); yoksa null. */
    blurb: string | null;
    /** Siluetin gerçek ölçüsü: fiyat ve tarih ekseni (kapak kartı). */
    chart: SilhouetteRange | null;
  };
};

/** Tarayıcıdaki ilerleme kaydı — gün başına tahmin listesi ve son durum
    (ana sayfa girişi "çözüldü mü" sorusunu uca gitmeden buradan okuyor). */
export type PuzzleProgress = { day: string; guesses: string[]; status: PuzzleStatus };

const STATUSES: readonly PuzzleStatus[] = ["playing", "won", "lost"];

export function parseProgress(value: unknown): PuzzleProgress | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.day !== "string" || !Array.isArray(raw.guesses)) return null;
  const guesses = raw.guesses.filter((item): item is string => typeof item === "string").slice(0, MAX_GUESSES);
  const status = STATUSES.find((item) => item === raw.status) ?? "playing";
  return { day: raw.day, guesses, status };
}

/* ---------------------------------------------------------------------------
   Arşiv — geçmiş günlerin bulmacaları
   --------------------------------------------------------------------------- */

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** Gün anahtarının takvimde gerçek bir gün olduğu ("2026-02-31" değil). */
export function isDayKey(value: string): boolean {
  if (!DAY_KEY.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}

/**
 * Arşivde oynanabilen gün: ilk bulmacadan (`PUZZLE_EPOCH`) bugüne kadar,
 * bugün HARİÇ (bugün günlük bulmaca) ve gelecek asla.
 */
export function isArchiveDay(day: string, today: string): boolean {
  return isDayKey(day) && day >= PUZZLE_EPOCH && day < today;
}

/** Gün anahtarını `n` gün kaydırır ("2026-10-29", -1 → "2026-10-28"). */
export function shiftDay(day: string, n: number): string {
  return new Date((dayNumberOf(day) + n) * DAY_MS).toISOString().slice(0, 10);
}

/**
 * Önceki ve sonraki bulmacanın adresi (29 Ekim, oyun şeridinin okları —
 * `components/puzzle/GameNav.tsx`). İlk bulmacadan önce yok; bugünden sonra
 * yok (yarın açılmaz); bugünün bulmacası `/bulmaca`.
 */
export function neighborHrefs(day: string, today: string): { prev: string | null; next: string | null } {
  const prev = shiftDay(day, -1);
  const next = shiftDay(day, 1);
  return {
    prev: prev >= PUZZLE_EPOCH && prev < today ? `/bulmaca/${prev}` : null,
    next: day >= today ? null : next === today ? "/bulmaca" : `/bulmaca/${next}`,
  };
}

/** Arşivin günleri, yeniden eskiye; en çok `limit` gün. */
export function archiveDays(today: string, limit: number): string[] {
  const out: string[] = [];
  let cursor = dayNumberOf(today) - 1;
  const first = dayNumberOf(PUZZLE_EPOCH);
  while (cursor >= first && out.length < limit) {
    out.push(new Date(cursor * DAY_MS).toISOString().slice(0, 10));
    cursor -= 1;
  }
  return out;
}

/**
 * Tarayıcıdaki oyun geçmişi — gün başına tahminler, durum ve bitmişse
 * cevabın sembolüyle logosu (arşiv ızgarası çözülen günde logoyu bu
 * kayıttan basar; sunucu arşiv sayfasına cevap koymaz).
 */
export type HistoryEntry = {
  guesses: string[];
  status: PuzzleStatus;
  answer: { symbol: string; logoUrl: string | null } | null;
};
export type PuzzleHistory = Record<string, HistoryEntry>;

/** Geçmişin tavanı — en yeni bu kadar gün tutulur. */
export const HISTORY_LIMIT = 400;

export function parseHistory(value: unknown): PuzzleHistory {
  if (!value || typeof value !== "object") return {};
  const out: PuzzleHistory = {};
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([day]) => isDayKey(day))
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .slice(0, HISTORY_LIMIT);
  for (const [day, raw] of entries) {
    const progress = parseProgress({ ...(raw as object), day });
    if (!progress) continue;
    const answerRaw = (raw as Record<string, unknown>).answer as Record<string, unknown> | null | undefined;
    const answer =
      answerRaw && typeof answerRaw.symbol === "string"
        ? { symbol: answerRaw.symbol, logoUrl: typeof answerRaw.logoUrl === "string" ? answerRaw.logoUrl : null }
        : null;
    out[day] = { guesses: progress.guesses, status: progress.status, answer };
  }
  return out;
}

/* ---------------------------------------------------------------------------
   İlerleme çerezi — sunucu bitmiş/yarım oyunu ilk çizimde bassın
   --------------------------------------------------------------------------- */

/**
 * GÜNÜN TAHMİNLERİ ÇEREZDE DE (25 Ekim). İlerleme yalnız tarayıcı
 * deposundayken sunucu her zaman BOŞ bulmacayı basıyordu; istemci açılınca
 * depodan geri yükleyip ikinci bir istekle durumu kuruyordu. Arada okur
 * boş oyunu görüyor, sonra her şey yer değiştiriyordu: 390'da bitmiş
 * bulmacada CLS 0,59, 1440'ta 0,07 (ölçüldü). Çerezle sunucu ilk çizimde
 * okurun durumunu basıyor; depo yine asıl kayıt (seri, dağılım).
 *
 * Çerez yalnız bugünün tahmin sembollerini taşır, kimlik değil; değer
 * `gün|SEMBOL|SEMBOL` (virgül çerezde yasak). İki gün yaşar; ertesi gün
 * gün alanı tutmadığı için zaten yok sayılır. KVKK çerez tablosunda.
 */
export const PROGRESS_COOKIE = "az-bulmaca";
/** Arşiv oyununun çerezi — son oynanan arşiv günü (günlükle karışmasın). */
export const ARCHIVE_COOKIE = "az-bulmaca-arsiv";
export const PROGRESS_COOKIE_MAX_AGE = 2 * 24 * 60 * 60;

const SYMBOL_PATTERN = /^[A-Z][A-Z.-]{0,9}$/;
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function progressCookieValue(day: string, guesses: readonly string[]): string {
  return [day, ...guesses.slice(0, MAX_GUESSES)].join("|");
}

/** Çerezden bugünün tahminleri; başka gün, bozuk değer ya da fazlası boş liste. */
export function parseProgressCookie(value: string | undefined, today: string): string[] {
  if (!value) return [];
  const [day, ...guesses] = value.split("|");
  if (!DAY_PATTERN.test(day ?? "") || day !== today) return [];
  if (guesses.length > MAX_GUESSES || !guesses.every((symbol) => isJoker(symbol) || SYMBOL_PATTERN.test(symbol))) return [];
  const real = guesses.filter((symbol) => !isJoker(symbol));
  if (new Set(real).size !== real.length) return [];
  return guesses;
}

/** Tanımın ilk cümlesi — "1.5" ya da "S&P 500'e." ortasından bölünmez. */
export function firstSentence(text: string): string {
  const match = /^(.+?[.!?])(?:\s|$)/.exec(text.trim());
  return match ? match[1] : text.trim();
}
