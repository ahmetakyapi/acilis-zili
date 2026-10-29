import "server-only";

import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { puzzlePlayers, puzzleRuns } from "@/lib/schema";
import { advanceRun, displayName, rankRuns, type BoardEntry, type BoardRow, type RunStatus } from "@/lib/puzzle-board";

/**
 * Günün sıralamasının veri katmanı (29 Ekim) — kurallar `lib/puzzle-board.ts`,
 * tablo `lib/schema.ts` → `puzzleRuns`.
 *
 * TABLO YOKKEN SESSİZ. Migration deploy'da uygulanmıyor (CLAUDE.md
 * "Altyapı"); o arada yazma yolları hatayı yutar (oyun etkilenmez) ve
 * okuma `available: false` döner, panel "sıralama hazırlanıyor" yerine hiç
 * basılmaz. Kalıp `lib/earnings-vote-data.ts`.
 */

/** Tabloda gösterilen satır sayısı. */
export const BOARD_TOP = 20;
/** Bir günün sıralamasında okunan en çok kazanan — bunun ötesi sayılır ama sıralanmaz. */
const BOARD_SCAN = 5000;

/** Okur o günün bulmacasını açtı: kayıt yoksa saat burada başlar. */
export async function startRun(userId: string, day: string): Promise<void> {
  try {
    await db.insert(puzzleRuns).values({ userId, day }).onConflictDoNothing();
  } catch {
    /* Tablo yok ya da veritabanı düştü: sıralama bu oyunu görmez, oyun sürer. */
  }
}

/** Sunucunun değerlendirdiği tahmin listesini kayda işler (`advanceRun`). */
export async function recordRun(userId: string, day: string, guesses: readonly string[], status: RunStatus): Promise<void> {
  try {
    const [row] = await db
      .select({ guesses: puzzleRuns.guesses, status: puzzleRuns.status, flagged: puzzleRuns.flagged, finishedAt: puzzleRuns.finishedAt })
      .from(puzzleRuns)
      .where(and(eq(puzzleRuns.userId, userId), eq(puzzleRuns.day, day)))
      .limit(1);
    const stored = row ? { guesses: row.guesses, status: row.status as RunStatus, flagged: row.flagged } : null;
    const next = advanceRun(stored, guesses, status);
    if (stored && next === stored) return;
    const finishedAt = next.status !== "playing" ? row?.finishedAt ?? new Date() : null;
    await db
      .insert(puzzleRuns)
      .values({ userId, day, guesses: next.guesses, status: next.status, flagged: next.flagged, finishedAt })
      .onConflictDoUpdate({
        target: [puzzleRuns.userId, puzzleRuns.day],
        set: { guesses: next.guesses, status: next.status, flagged: next.flagged, finishedAt, updatedAt: new Date() },
      });
  } catch {
    /* Sessiz — gerekçe dosya başında. */
  }
}

export type Board = {
  available: boolean;
  /** O gün bulmacayı açan giriş yapmış okur. */
  players: number;
  solved: number;
  rows: BoardRow[];
  /** İsteyen okurun sırası (kazandıysa) ve oyunu — tabloda olmasa da. */
  you: { rank: number | null; row: BoardRow | null; guesses: number; status: RunStatus; nickname: string | null; name: string } | null;
};

const EMPTY: Board = { available: false, players: 0, solved: 0, rows: [], you: null };

export async function getBoard(day: string, userId: string | null, anonymousPrefix: string): Promise<Board> {
  try {
    const [counts] = await db
      .select({
        players: sql<number>`count(*)::int`,
        solved: sql<number>`count(*) filter (where ${puzzleRuns.status} = 'won' and not ${puzzleRuns.flagged})::int`,
      })
      .from(puzzleRuns)
      .where(eq(puzzleRuns.day, day));
    const winners = await db
      .select({
        userId: puzzleRuns.userId,
        nickname: puzzlePlayers.nickname,
        guesses: sql<number>`jsonb_array_length(${puzzleRuns.guesses})::int`,
        startedAt: puzzleRuns.startedAt,
        finishedAt: puzzleRuns.finishedAt,
      })
      .from(puzzleRuns)
      .leftJoin(puzzlePlayers, eq(puzzlePlayers.userId, puzzleRuns.userId))
      .where(and(eq(puzzleRuns.day, day), eq(puzzleRuns.status, "won"), eq(puzzleRuns.flagged, false)))
      .limit(BOARD_SCAN);
    const entries: BoardEntry[] = winners.flatMap((row) =>
      row.finishedAt ? [{ userId: row.userId, nickname: row.nickname, guesses: row.guesses, startedAt: row.startedAt, finishedAt: row.finishedAt }] : [],
    );
    const ranked = rankRuns(entries);
    const toRow = (entry: BoardEntry): BoardRow => ({
      name: displayName(entry, anonymousPrefix),
      guesses: entry.guesses,
      seconds: Math.max(0, Math.round((entry.finishedAt.getTime() - entry.startedAt.getTime()) / 1000)),
      finishedAt: entry.finishedAt.toISOString(),
      you: entry.userId === userId,
    });

    let you: Board["you"] = null;
    if (userId) {
      const [mine] = await db
        .select({ guesses: puzzleRuns.guesses, status: puzzleRuns.status })
        .from(puzzleRuns)
        .where(and(eq(puzzleRuns.userId, userId), eq(puzzleRuns.day, day)))
        .limit(1);
      const [player] = await db.select({ nickname: puzzlePlayers.nickname }).from(puzzlePlayers).where(eq(puzzlePlayers.userId, userId)).limit(1);
      const index = ranked.findIndex((entry) => entry.userId === userId);
      you = {
        rank: index >= 0 ? index + 1 : null,
        row: index >= 0 ? toRow(ranked[index]!) : null,
        guesses: mine?.guesses.length ?? 0,
        status: (mine?.status as RunStatus | undefined) ?? "playing",
        nickname: player?.nickname ?? null,
        name: displayName({ userId, nickname: player?.nickname ?? null }, anonymousPrefix),
      };
    }
    return { available: true, players: counts?.players ?? 0, solved: counts?.solved ?? 0, rows: ranked.slice(0, BOARD_TOP).map(toRow), you };
  } catch {
    return EMPTY;
  }
}

/** Takma adı yazar; boş ad anonim demek. Başarısızsa false. */
export async function setNickname(userId: string, nickname: string): Promise<boolean> {
  try {
    const value = nickname === "" ? null : nickname;
    await db
      .insert(puzzlePlayers)
      .values({ userId, nickname: value })
      .onConflictDoUpdate({ target: puzzlePlayers.userId, set: { nickname: value, updatedAt: new Date() } });
    return true;
  } catch {
    return false;
  }
}
