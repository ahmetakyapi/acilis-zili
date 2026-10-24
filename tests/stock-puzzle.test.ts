import test from "node:test";
import assert from "node:assert/strict";
import {
  CLUE_ORDER,
  MAX_GUESSES,
  capBandOf,
  cluesFor,
  compareGuess,
  currentStreak,
  dayNumberOf,
  emptyStats,
  firstSentence,
  nextPuzzleAt,
  parseProgress,
  parseStats,
  pickDaily,
  puzzleDayKey,
  puzzleNumber,
  recordGame,
  shareGrid,
  shareText,
  silhouetteOf,
  statusOf,
  visibleClues,
  type PuzzleFacts,
} from "../lib/stock-puzzle";

/* "Hisseyi Bil" saf mantığı — günün seçimi, ipucu sırası, karşılaştırma,
   paylaşım metni ve seri. Sunucu ve istemci bu kurallara güveniyor. */

const facts: PuzzleFacts = {
  symbol: "NVDA",
  name: "Nvidia",
  sector: "Information Technology",
  marketCap: 4.5e12,
  ipoYear: 1999,
  revenueGrowth: 62.48,
  silhouette: [0, 0.5, 1],
};

test("clues follow the hard-to-easy order", () => {
  assert.deepEqual(cluesFor(facts).map((clue) => clue.kind), [...CLUE_ORDER]);
});

test("missing data skips a clue instead of inventing one", () => {
  const kinds = cluesFor({ ...facts, silhouette: null, ipoYear: 1950, revenueGrowth: null }).map((clue) => clue.kind);
  assert.deepEqual(kinds, ["sector", "capBand", "initial"]);
});

test("first letter and rounded growth", () => {
  const clues = cluesFor({ ...facts, name: "3M" });
  assert.deepEqual(clues.at(-1), { kind: "initial", letter: "3" });
  assert.deepEqual(clues.find((clue) => clue.kind === "revenueGrowth"), { kind: "revenueGrowth", pct: 62.5 });
});

test("one clue at start, one more per miss, all when finished", () => {
  const clues = cluesFor(facts);
  assert.equal(visibleClues(clues, 0, false).length, 1);
  assert.equal(visibleClues(clues, 3, false).length, 4);
  assert.equal(visibleClues(clues, 9, false).length, clues.length);
  assert.equal(visibleClues(clues, 0, true).length, clues.length);
});

test("cap bands split low, open at the top", () => {
  assert.equal(capBandOf(63e9), 0);
  assert.equal(capBandOf(75e9), 1);
  assert.equal(capBandOf(120e9), 2);
  assert.equal(capBandOf(999e9), 5);
  assert.equal(capBandOf(4.5e12), 6);
});

test("puzzle number counts from the epoch", () => {
  assert.equal(puzzleNumber("2026-10-24"), 1);
  assert.equal(puzzleNumber("2026-10-25"), 2);
  assert.equal(puzzleNumber("2027-10-24"), 366);
});

test("day key is Istanbul's calendar day", () => {
  /* 21:30 UTC = 00:30 İstanbul ertesi gün (UTC+3). */
  assert.equal(puzzleDayKey(new Date("2026-10-24T21:30:00Z")), "2026-10-25");
  assert.equal(puzzleDayKey(new Date("2026-10-24T20:59:00Z")), "2026-10-24");
  assert.equal(nextPuzzleAt(Date.parse("2026-10-24T12:00:00Z")).toISOString(), "2026-10-24T21:00:00.000Z");
});

test("daily pick is deterministic and order independent", () => {
  const pool = ["AAPL", "MSFT", "NVDA", "AMZN", "META"];
  const day = dayNumberOf("2026-10-24");
  assert.equal(pickDaily(pool, day), pickDaily([...pool].reverse(), day));
  assert.equal(pickDaily([], day), null);
});

test("the pick follows the rank, so a secret rank hides tomorrow", () => {
  const pool = Array.from({ length: 50 }, (_, i) => `S${i}`);
  const days = Array.from({ length: 50 }, (_, i) => dayNumberOf("2026-10-24") + i);
  const publicPicks = days.map((day) => pickDaily(pool, day));
  /* Başka bir sırla kurulmuş anahtar başka bir dizi verir: kamuya açık
     varsayılanı bilen biri gizli sıranın cevabını hesaplayamaz. */
  const secret = (symbol: string, cycle: number) => `${(symbol.length * 7919 + cycle) % 101}:${symbol.split("").reverse().join("")}`;
  const secretPicks = days.map((day) => pickDaily(pool, day, secret));
  assert.notDeepEqual(secretPicks, publicPicks);
  assert.equal(new Set(secretPicks).size, pool.length);
});

test("no repeats within one pass through the pool", () => {
  const pool = Array.from({ length: 37 }, (_, i) => `S${i}`);
  const start = dayNumberOf("2026-10-24");
  const cycleStart = start - (start % pool.length);
  const picks = new Set(Array.from({ length: pool.length }, (_, i) => pickDaily(pool, cycleStart + i)));
  assert.equal(picks.size, pool.length);
});

test("silhouette is scaled to 0..1 and capped in points", () => {
  const closes = Array.from({ length: 250 }, (_, i) => 100 + i);
  const points = silhouetteOf(closes, 64);
  assert.ok(points);
  assert.equal(points.length, 64);
  assert.equal(points[0], 0);
  assert.equal(points.at(-1), 1);
  assert.equal(silhouetteOf([5, 5, 5]), null);
  assert.equal(silhouetteOf([5]), null);
});

test("guess feedback compares sector and size from the answer's side", () => {
  const answer = { symbol: "NVDA", sector: "Information Technology", marketCap: 4e12 };
  assert.deepEqual(compareGuess({ symbol: "AMD", sector: "Information Technology", marketCap: 3e11 }, answer), {
    symbol: "AMD",
    correct: false,
    sameSector: true,
    cap: "up",
  });
  assert.equal(compareGuess({ symbol: "XOM", sector: "Energy", marketCap: 5e12 }, answer).cap, "down");
  assert.equal(compareGuess({ symbol: "XOM", sector: null, marketCap: null }, answer).sameSector, null);
  assert.equal(compareGuess(answer, answer).correct, true);
});

test("status: won on a hit, lost after six misses", () => {
  const miss = { correct: false };
  assert.equal(statusOf([miss, { correct: true }]), "won");
  assert.equal(statusOf(Array(MAX_GUESSES).fill(miss)), "lost");
  assert.equal(statusOf([miss]), "playing");
});

test("share text hides the answer and pads with empty squares", () => {
  const text = shareText({
    title: "Açılış Zili Hisseyi Bil",
    number: 12,
    feedback: [{ correct: false }, { correct: false }, { correct: true }],
    url: "https://aciliszili.com/bulmaca",
  });
  assert.equal(text, "Açılış Zili Hisseyi Bil #12 3/6\n🟦🟦🟩⬛⬛⬛\nhttps://aciliszili.com/bulmaca");
  assert.equal(shareGrid(Array(6).fill({ correct: false })), "🟦🟦🟦🟦🟦🟦");
  assert.match(shareText({ title: "T", number: 1, feedback: Array(6).fill({ correct: false }), url: "u" }), /X\/6/);
});

test("streak grows on consecutive wins and resets on a loss or gap", () => {
  let stats = emptyStats();
  stats = recordGame(stats, 100, true, 3);
  stats = recordGame(stats, 101, true, 2);
  assert.equal(stats.streak, 2);
  assert.equal(stats.best, 2);
  assert.deepEqual(stats.distribution, [0, 1, 1, 0, 0, 0]);
  /* Aynı gün ikinci kez sayılmaz. */
  assert.equal(recordGame(stats, 101, true, 2), stats);
  assert.equal(currentStreak(stats, 102), 2);
  assert.equal(currentStreak(stats, 103), 0);
  stats = recordGame(stats, 103, true, 1);
  assert.equal(stats.streak, 1);
  stats = recordGame(stats, 104, false, 6);
  assert.equal(stats.streak, 0);
  assert.equal(stats.best, 2);
  assert.equal(stats.played, 4);
  assert.equal(stats.wins, 3);
});

test("stored values survive garbage", () => {
  assert.deepEqual(parseStats("bozuk"), emptyStats());
  assert.deepEqual(parseStats({ played: -3, distribution: [1, "x"] }).distribution, [1, 0, 0, 0, 0, 0]);
  assert.equal(parseProgress(null), null);
  assert.deepEqual(parseProgress({ day: "2026-10-24", guesses: ["AAPL", 3], status: "nope" }), {
    day: "2026-10-24",
    guesses: ["AAPL"],
    status: "playing",
  });
});

test("first sentence keeps decimals intact", () => {
  assert.equal(firstSentence("Nvidia yonga tasarlar. Merkezi Kaliforniya'da."), "Nvidia yonga tasarlar.");
  assert.equal(firstSentence("Pay 1.5 kat büyüdü. İkinci."), "Pay 1.5 kat büyüdü.");
});
