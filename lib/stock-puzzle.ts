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
 * İpucu sırası ZORDAN KOLAYA. Siluet tek başına neredeyse hiçbir şey
 * söylemiyor (yüz şirketin grafiği birbirine benzer), baş harf ise son
 * tahminden önce işi bitiriyor. Verisi olmayan ipucu ATLANIR, yerine
 * uydurma bir değer konmaz; sıradaki bir basamak öne gelir.
 */
export const CLUE_ORDER = [
  "silhouette",
  "sector",
  "capBand",
  "ipoYear",
  "revenueGrowth",
  "initial",
] as const;

export type ClueKind = (typeof CLUE_ORDER)[number];

export type Clue =
  | { kind: "silhouette"; points: number[] }
  /** GICS ana sektörü, İngilizce anahtar — ekranda `sectorLabel` ile. */
  | { kind: "sector"; sector: string }
  | { kind: "capBand"; band: number }
  | { kind: "ipoYear"; year: number }
  /** Son 12 ayın gelir büyümesi, yüzde (Finnhub `revenueGrowthTTMYoy`). */
  | { kind: "revenueGrowth"; pct: number }
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

/** Bilinenlerden ipucu listesi, `CLUE_ORDER` sırasıyla, eksik olan atlanmış. */
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
      case "capBand":
        if (facts.marketCap !== null && facts.marketCap > 0) out.push({ kind, band: capBandOf(facts.marketCap) });
        break;
      case "ipoYear":
        if (facts.ipoYear !== null && facts.ipoYear >= IPO_YEAR_FLOOR) out.push({ kind, year: facts.ipoYear });
        break;
      case "revenueGrowth":
        if (facts.revenueGrowth !== null && Number.isFinite(facts.revenueGrowth)) {
          out.push({ kind, pct: Math.round(facts.revenueGrowth * 10) / 10 });
        }
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
 * Görünen ipuçları: başta bir, her yanlış tahminde bir fazlası. Bitmiş
 * bulmacada hepsi açılır (sonuç kartı ne bilinmesi gerektiğini gösterir).
 */
export function visibleClues(clues: readonly Clue[], wrongGuesses: number, finished: boolean): Clue[] {
  if (finished) return [...clues];
  return clues.slice(0, Math.min(clues.length, 1 + Math.max(0, wrongGuesses)));
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

export type CompanyBrief = {
  symbol: string;
  sector: string | null;
  marketCap: number | null;
};

/**
 * Yanlış tahminin geri bildirimi — o da bir ipucu.
 *
 * `cap`: CEVABIN piyasa değeri tahminden büyükse "up" (ok yukarı: "daha
 * büyüğünü ara"), küçükse "down". Biri bilinmiyorsa null; doğru tahminde
 * "same". Sektör de iki taraf biliniyorsa karşılaştırılır.
 */
export type GuessFeedback = {
  symbol: string;
  correct: boolean;
  sameSector: boolean | null;
  cap: "up" | "down" | "same" | null;
};

export function compareGuess(guess: CompanyBrief, answer: CompanyBrief): GuessFeedback {
  const correct = guess.symbol === answer.symbol;
  if (correct) return { symbol: guess.symbol, correct, sameSector: true, cap: "same" };
  const sameSector = guess.sector && answer.sector ? guess.sector === answer.sector : null;
  const cap =
    guess.marketCap !== null && answer.marketCap !== null && guess.marketCap > 0 && answer.marketCap > 0
      ? answer.marketCap >= guess.marketCap
        ? "up"
        : "down"
      : null;
  return { symbol: guess.symbol, correct, sameSector, cap };
}

export type PuzzleStatus = "playing" | "won" | "lost";

export function statusOf(feedback: readonly Pick<GuessFeedback, "correct">[]): PuzzleStatus {
  if (feedback.some((item) => item.correct)) return "won";
  return feedback.length >= MAX_GUESSES ? "lost" : "playing";
}

/* ---------------------------------------------------------------------------
   Paylaşım
   --------------------------------------------------------------------------- */

/**
 * Izgara kareleri — markanın mavisi yanlış, yeşil doğru, siyah kullanılmayan
 * hak. Sarı yok: sektörü tutan yanlış tahmin de yanlış (sonuçta işaret
 * dili renk anlamı taşımalı, CLAUDE.md "Renk anlam taşır").
 */
export const SHARE_SQUARES = { miss: "🟦", hit: "🟩", empty: "⬛" } as const;

export function shareGrid(feedback: readonly Pick<GuessFeedback, "correct">[]): string {
  const used = feedback.slice(0, MAX_GUESSES).map((item) => (item.correct ? SHARE_SQUARES.hit : SHARE_SQUARES.miss));
  const empty = Array<string>(Math.max(0, MAX_GUESSES - used.length)).fill(SHARE_SQUARES.empty);
  return [...used, ...empty].join("");
}

/**
 * Paylaşım metni: "Açılış Zili Hisseyi Bil #12 3/6", ızgara, bağlantı.
 * Cevap metne GİRMEZ — paylaşılan sonuç başkasının bulmacasını bozmasın.
 */
export function shareText({
  title,
  number,
  feedback,
  url,
}: {
  title: string;
  number: number;
  feedback: readonly Pick<GuessFeedback, "correct">[];
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
};

export function emptyStats(): PuzzleStats {
  return { played: 0, wins: 0, streak: 0, best: 0, lastPlayed: null, lastWon: null, distribution: Array(MAX_GUESSES).fill(0) };
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
  };
}

/**
 * Biten bir oyunu istatistiğe işler. AYNI GÜN İKİ KEZ SAYILMAZ (sayfa
 * yenilenince bitmiş oyun yeniden "bitiyor"). Seri, dünü kazanmışsa bir
 * artar, değilse 1'den başlar; kayıp seriyi sıfırlar.
 */
export function recordGame(stats: PuzzleStats, day: number, won: boolean, guesses: number): PuzzleStats {
  if (stats.lastPlayed !== null && stats.lastPlayed >= day) return stats;
  const next: PuzzleStats = { ...stats, distribution: [...stats.distribution], played: stats.played + 1, lastPlayed: day };
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
};

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
  answer?: {
    symbol: string;
    name: string;
    logoUrl: string | null;
    /** Şirketin tek cümlelik tanıtımı (depodaki iş tanımından); yoksa null. */
    blurb: string | null;
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

/** Tanımın ilk cümlesi — "1.5" ya da "S&P 500'e." ortasından bölünmez. */
export function firstSentence(text: string): string {
  const match = /^(.+?[.!?])(?:\s|$)/.exec(text.trim());
  return match ? match[1] : text.trim();
}
