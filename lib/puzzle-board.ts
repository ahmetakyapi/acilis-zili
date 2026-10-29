/**
 * Hisseyi Bil — günün sıralaması, SAF kurallar (29 Ekim). Tablo ve
 * gerekçe `lib/schema.ts` → `puzzleRuns`; veritabanı yolu
 * `lib/puzzle-board-data.ts`; ekran `components/puzzle/PuzzleLeaderboard.tsx`;
 * testi `tests/puzzle-board.test.ts`.
 *
 * SIRALAMA: önce az tahmin, sonra kısa süre, eşitse önce bitiren. Yalnız
 * bilinmiş ve `flagged` olmayan oyunlar sıralanır; bilinemeyenler ve
 * sürenler "Oynayan" sayısında.
 */

export type RunStatus = "playing" | "won" | "lost";

export type StoredRun = { guesses: string[]; status: RunStatus; flagged: boolean };

/**
 * Gelen tahmin listesiyle kaydın yeni hâli. Sunucu kimin hangi tahmini
 * önceden yaptığını ancak sırayla gördüğünde bilir:
 *   aynı liste ............ değişiklik yok (geri yükleme, sayfa yenileme)
 *   kayıt + bir tahmin .... eklenir
 *   başka her şey ......... liste alınır ama satır işaretlenir (`flagged`)
 * Bitmiş oyunun kaydı bir daha değişmez.
 */
export function advanceRun(stored: StoredRun | null, incoming: readonly string[], status: RunStatus): StoredRun {
  if (!stored) return { guesses: [...incoming], status, flagged: incoming.length > 1 };
  if (stored.status !== "playing") return stored;
  const same = stored.guesses.length === incoming.length && stored.guesses.every((symbol, i) => symbol === incoming[i]);
  if (same) return { ...stored, status };
  const extends1 = incoming.length === stored.guesses.length + 1 && stored.guesses.every((symbol, i) => symbol === incoming[i]);
  return { guesses: [...incoming], status, flagged: stored.flagged || !extends1 };
}

export type BoardRow = {
  /** Gösterilen ad — takma ad ya da anonim (`displayName`). */
  name: string;
  guesses: number;
  /** Başlangıçtan bitişe saniye. */
  seconds: number;
  finishedAt: string;
  /** İsteyen okurun kendi satırı mı. */
  you: boolean;
};

export type BoardEntry = { userId: string; nickname: string | null; guesses: number; startedAt: Date; finishedAt: Date };

/** Sıralama: tahmin, süre, bitiş anı. */
export function rankRuns(entries: readonly BoardEntry[]): BoardEntry[] {
  const secondsOf = (entry: BoardEntry) => Math.max(0, entry.finishedAt.getTime() - entry.startedAt.getTime());
  return [...entries].sort(
    (a, b) => a.guesses - b.guesses || secondsOf(a) - secondsOf(b) || a.finishedAt.getTime() - b.finishedAt.getTime(),
  );
}

/** Kimlikten türeyen anonim ad: "Oyuncu 3F2A" — hesabın hiçbir bilgisi değil. */
export function anonymousTag(userId: string): string {
  return userId.replace(/[^0-9a-f]/gi, "").slice(0, 4).toUpperCase() || "0000";
}

export function displayName(entry: Pick<BoardEntry, "userId" | "nickname">, anonymousPrefix: string): string {
  return entry.nickname?.trim() || `${anonymousPrefix} ${anonymousTag(entry.userId)}`;
}

export const NICKNAME_MIN = 2;
export const NICKNAME_MAX = 20;

/**
 * Takma adı temizler; geçersizse null. Harf (her dilden), rakam, boşluk ve
 * `. _ -`; baştaki/sondaki boşluk atılır, iç boşluklar teke iner. Boş ad
 * "anonim kal" demek ve geçerli (`""`).
 */
export function cleanNickname(raw: string): string | null {
  const text = raw.normalize("NFC").replace(/\s+/g, " ").trim();
  if (text === "") return "";
  if (text.length < NICKNAME_MIN || text.length > NICKNAME_MAX) return null;
  if (!/^[\p{L}\p{N}][\p{L}\p{N} ._-]*$/u.test(text)) return null;
  return text;
}

/**
 * Süre künyesi: "48 sn", "4 dk 12 sn", "2 sa 5 dk". Birim ekleri küçük
 * (CLAUDE.md, geri sayımın birim ekleri istisnası); kalıp sözlükte.
 */
export function formatDuration(seconds: number, units: { h: string; m: string; s: string }): string {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h} ${units.h} ${m} ${units.m}`;
  if (m > 0) return `${m} ${units.m} ${s} ${units.s}`;
  return `${s} ${units.s}`;
}
