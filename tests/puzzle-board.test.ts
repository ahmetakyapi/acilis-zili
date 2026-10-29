import test from "node:test";
import assert from "node:assert/strict";
import { advanceRun, anonymousTag, cleanNickname, displayName, formatDuration, rankRuns, type BoardEntry } from "../lib/puzzle-board";

/** Günün sıralaması — saf kurallar (lib/puzzle-board.ts). */

test("guesses are recorded one at a time; a bulk list is flagged", () => {
  const first = advanceRun(null, ["NVDA"], "playing");
  assert.deepEqual(first, { guesses: ["NVDA"], status: "playing", flagged: false });
  const second = advanceRun(first, ["NVDA", "AAPL"], "won");
  assert.deepEqual(second, { guesses: ["NVDA", "AAPL"], status: "won", flagged: false });
  /* Geri yükleme aynı listeyi yeniden gönderir: dokunulmaz. */
  assert.deepEqual(advanceRun(first, ["NVDA"], "playing"), first);
  /* Altı tahmin birden: işaretli. */
  assert.equal(advanceRun(null, ["A", "B", "C", "D", "E", "F"], "lost").flagged, true);
  assert.equal(advanceRun(first, ["NVDA", "B", "C"], "playing").flagged, true);
  /* Başka bir sırayla değiştirilmiş liste de. */
  assert.equal(advanceRun(first, ["MSFT", "AAPL"], "playing").flagged, true);
  /* Bitmiş oyun değişmez. */
  assert.deepEqual(advanceRun(second, ["NVDA", "AAPL", "KO"], "won"), second);
});

test("ranking: fewer guesses, then shorter time, then earlier finish", () => {
  const at = (iso: string) => new Date(iso);
  const entries: BoardEntry[] = [
    { userId: "a", nickname: null, guesses: 3, startedAt: at("2026-10-29T08:00:00Z"), finishedAt: at("2026-10-29T08:02:00Z") },
    { userId: "b", nickname: null, guesses: 2, startedAt: at("2026-10-29T09:00:00Z"), finishedAt: at("2026-10-29T09:30:00Z") },
    { userId: "c", nickname: null, guesses: 3, startedAt: at("2026-10-29T07:00:00Z"), finishedAt: at("2026-10-29T07:01:00Z") },
  ];
  assert.deepEqual(rankRuns(entries).map((e) => e.userId), ["b", "c", "a"]);
});

test("names are anonymous unless a nickname is chosen", () => {
  assert.equal(anonymousTag("3f2a9c1e-0000-4000-8000-000000000000"), "3F2A");
  assert.equal(displayName({ userId: "3f2a9c1e", nickname: null }, "Oyuncu"), "Oyuncu 3F2A");
  assert.equal(displayName({ userId: "3f2a9c1e", nickname: "  " }, "Oyuncu"), "Oyuncu 3F2A");
  assert.equal(displayName({ userId: "x", nickname: "Boğa" }, "Oyuncu"), "Boğa");
});

test("nickname rules", () => {
  assert.equal(cleanNickname("  Wall   Street  Kurdu "), "Wall Street Kurdu");
  assert.equal(cleanNickname("Şahin_34"), "Şahin_34");
  assert.equal(cleanNickname(""), "");
  assert.equal(cleanNickname("a"), null);
  assert.equal(cleanNickname("<script>"), null);
  assert.equal(cleanNickname("x".repeat(21)), null);
  assert.equal(cleanNickname("-baştan tire"), null);
});

test("duration label", () => {
  const units = { h: "sa", m: "dk", s: "sn" };
  assert.equal(formatDuration(48, units), "48 sn");
  assert.equal(formatDuration(252, units), "4 dk 12 sn");
  assert.equal(formatDuration(7500, units), "2 sa 5 dk");
  assert.equal(formatDuration(-5, units), "0 sn");
});
