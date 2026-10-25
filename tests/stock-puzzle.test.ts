import test from "node:test";
import assert from "node:assert/strict";
import {
  AXIS_AFTER_MISSES,
  CLUE_ORDER,
  CLUE_STEPS,
  JOKER,
  archiveDays,
  isArchiveDay,
  isClose,
  isPureWin,
  jokerAllowed,
  jokerFeedback,
  parseHistory,
  recordArchiveGame,
  stepOf,
  symbolShape,
  MAX_GUESSES,
  SHARE_SQUARES,
  axisFor,
  capTile,
  growthTile,
  ipoTile,
  parseProgressCookie,
  pctFromStart,
  progressCookieValue,
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
  type CompanyBrief,
  type PuzzleFacts,
} from "../lib/stock-puzzle";
import { ALL_MEMBERS, primaryOnly } from "../db/seed/indices";

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
  dividendYield: 0.03,
  beta: 2.27,
  industry: "Semiconductors",
  netMargin: 55.6,
};

test("clues follow the general-to-specific steps", () => {
  assert.deepEqual(cluesFor(facts).map((clue) => clue.kind), [...CLUE_ORDER]);
  assert.deepEqual(CLUE_STEPS[0], ["silhouette"]);
  /* Daraltan ama bitirmeyen basamaklar önde, işi bitirenler sonda. */
  assert.ok(stepOf("sector") < stepOf("capBand"));
  assert.ok(stepOf("capBand") < stepOf("industry"));
  assert.ok(stepOf("industry") < stepOf("letters"));
  assert.equal(stepOf("initial"), CLUE_STEPS.length - 1);
});

test("missing data skips a clue instead of inventing one", () => {
  const kinds = cluesFor({ ...facts, silhouette: null, ipoYear: 1950, revenueGrowth: null, dividendYield: null, beta: undefined, industry: null, netMargin: null }).map((clue) => clue.kind);
  assert.deepEqual(kinds, ["sector", "capBand", "letters", "initial"]);
});

test("first letter and rounded growth", () => {
  const clues = cluesFor({ ...facts, name: "3M" });
  assert.deepEqual(clues.at(-1), { kind: "initial", letter: "3" });
  assert.deepEqual(clues.find((clue) => clue.kind === "revenueGrowth"), { kind: "revenueGrowth", pct: 62.5 });
});

test("one step at start, one more per miss or joker, all when finished", () => {
  const clues = cluesFor(facts);
  assert.deepEqual(visibleClues(clues, 0, false).map((clue) => clue.kind), ["silhouette"]);
  assert.deepEqual(visibleClues(clues, 1, false).map((clue) => clue.kind), ["silhouette", "sector", "dividend"]);
  assert.equal(visibleClues(clues, 3, false).length, 7);
  assert.equal(visibleClues(clues, 9, false).length, clues.length);
  assert.equal(visibleClues(clues, 0, true).length, clues.length);
});

test("ticker shape hides letters but keeps punctuation", () => {
  assert.equal(symbolShape("BRK.B"), "•••.•");
  assert.deepEqual(cluesFor({ ...facts, symbol: "MS" }).find((clue) => clue.kind === "letters"), { kind: "letters", shape: "••" });
  /* Temettü verimi bilinmiyorsa ipucu yok; "ödemiyor" uydurulmaz. */
  assert.equal(cluesFor({ ...facts, dividendYield: null }).some((clue) => clue.kind === "dividend"), false);
});

/* ZORLUK DENGESİ: endeks tohumunun gerçek sektör/alt sektör verisiyle, ilk
   basamakların tek başına cevabı vermediği ölçülür. Havuzun kendisi
   (ilk 200) piyasa değerine bağlı; burada tohumun tamamı, havuzdan geniş
   ama aynı sınıflandırma. */
test("early steps never pin the answer", () => {
  const members = primaryOnly(ALL_MEMBERS).filter((member) => member.sector && member.sub);
  for (const symbol of ["NVDA", "MS", "KO", "XOM", "AAPL", "LLY"]) {
    const answer = members.find((member) => member.symbol === symbol);
    assert.ok(answer, symbol);
    const sameSector = members.filter((member) => member.sector === answer.sector);
    /* 1. basamak (sektör) en az on aday bırakır. */
    assert.ok(sameSector.length >= 10, `${symbol} sektörde ${sameSector.length}`);
    /* 4. basamağa kadar (endüstri) bile çoğunlukla birden çok aday. */
    const sameSub = members.filter((member) => member.sub === answer.sub);
    assert.ok(sameSub.length >= 2, `${symbol} alt sektörde ${sameSub.length}`);
  }
});

test("joker spends a guess, never the last one", () => {
  assert.equal(jokerAllowed(0, 3), true);
  assert.equal(jokerAllowed(MAX_GUESSES - 1, 3), false);
  assert.equal(jokerAllowed(2, 0), false);
  const joker = jokerFeedback();
  assert.equal(joker.symbol, JOKER);
  assert.equal(statusOf([joker, joker]), "playing");
  assert.equal(shareGrid([joker]), SHARE_SQUARES.joker);
});

test("close call and pure knowledge", () => {
  const answer = brief({ symbol: "NVDA" });
  assert.equal(isClose(compareGuess(brief({ symbol: "AVGO", marketCap: 1.5e12 }), answer)), true);
  assert.equal(isClose(compareGuess(brief({ symbol: "AMD", marketCap: 3e11 }), answer)), false);
  assert.equal(isClose(compareGuess(answer, answer)), false);
  const hit = compareGuess(answer, answer);
  const miss = compareGuess(brief({ symbol: "AMD", marketCap: 3e11 }), answer);
  assert.equal(isPureWin([hit]), true);
  assert.equal(isPureWin([miss, hit]), true);
  assert.equal(isPureWin([jokerFeedback(), hit]), false);
  assert.equal(isPureWin([miss, miss, hit]), false);
  assert.equal(isPureWin([miss]), false);
});

test("archive days: past only, from the first puzzle", () => {
  assert.equal(isArchiveDay("2026-10-24", "2026-10-25"), true);
  assert.equal(isArchiveDay("2026-10-25", "2026-10-25"), false);
  assert.equal(isArchiveDay("2026-10-26", "2026-10-25"), false);
  assert.equal(isArchiveDay("2026-10-23", "2026-10-25"), false);
  assert.equal(isArchiveDay("2026-02-31", "2027-01-01"), false);
  assert.deepEqual(archiveDays("2026-10-27", 10), ["2026-10-26", "2026-10-25", "2026-10-24"]);
  assert.deepEqual(archiveDays("2026-10-27", 1), ["2026-10-26"]);
});

test("archive solves never touch the daily streak", () => {
  let stats = recordGame(emptyStats(), 100, true, 2, true);
  assert.equal(stats.pureWins, 1);
  const before = stats;
  stats = recordArchiveGame(stats, true, false);
  assert.equal(stats.archiveWins, 1);
  assert.equal(stats.streak, before.streak);
  assert.deepEqual(stats.distribution, before.distribution);
  assert.equal(recordArchiveGame(stats, false), stats);
});

test("history survives garbage and keeps the answer only when given", () => {
  const history = parseHistory({
    "2026-10-24": { guesses: ["AAPL", "MS"], status: "won", answer: { symbol: "MS", logoUrl: "/logos/MS.webp" } },
    "2026-10-25": { guesses: ["*"], status: "playing" },
    bozuk: { guesses: [] },
  });
  assert.deepEqual(Object.keys(history).sort(), ["2026-10-24", "2026-10-25"]);
  assert.deepEqual(history["2026-10-24"].answer, { symbol: "MS", logoUrl: "/logos/MS.webp" });
  assert.equal(history["2026-10-25"].answer, null);
  assert.deepEqual(parseHistory("x"), {});
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

const brief = (over: Partial<CompanyBrief> & { symbol: string }): CompanyBrief => ({
  sector: "Information Technology",
  marketCap: 4e12,
  ipoYear: 1999,
  revenueGrowth: 60,
  ...over,
});

test("guess tiles grade each attribute from the answer's side", () => {
  const answer = brief({ symbol: "NVDA" });
  const amd = compareGuess(brief({ symbol: "AMD", marketCap: 3e11, ipoYear: 1995, revenueGrowth: 20 }), answer);
  assert.equal(amd.correct, false);
  assert.deepEqual(amd.tiles, {
    sector: { grade: "match", toward: null },
    /* 300 milyar bant 4, 4 trilyon bant 6: iki bant ötede, cevap büyük. */
    cap: { grade: "far", toward: "up" },
    ipo: { grade: "near", toward: "up" },
    growth: { grade: "far", toward: "up" },
  });
  /* Karoda tahminin KENDİ değerleri yazar, cevabınki değil. */
  assert.deepEqual(amd.values, { sector: "Information Technology", marketCap: 3e11, ipoYear: 1995, revenueGrowth: 20 });
  const xom = compareGuess(brief({ symbol: "XOM", sector: "Energy", marketCap: 5e12, ipoYear: 1999, revenueGrowth: 59 }), answer);
  assert.deepEqual(xom.tiles.sector, { grade: "far", toward: null });
  assert.deepEqual(xom.tiles.cap, { grade: "match", toward: "down" });
  assert.deepEqual(xom.tiles.ipo, { grade: "match", toward: null });
  assert.deepEqual(xom.tiles.growth, { grade: "match", toward: null });
  const hit = compareGuess(answer, answer);
  assert.equal(hit.correct, true);
  assert.ok(Object.values(hit.tiles).every((tile) => tile?.grade === "match"));
});

test("unknown data leaves the tile empty instead of painting it far", () => {
  const answer = brief({ symbol: "NVDA" });
  const tiles = compareGuess(brief({ symbol: "X", sector: null, marketCap: null, ipoYear: null, revenueGrowth: null }), answer).tiles;
  assert.deepEqual(tiles, { sector: null, cap: null, ipo: null, growth: null });
});

test("cap tile: same band matches, a neighbor band is near", () => {
  assert.deepEqual(capTile(120e9, 140e9), { grade: "match", toward: "up" });
  assert.deepEqual(capTile(120e9, 180e9), { grade: "near", toward: "up" });
  assert.deepEqual(capTile(2e12, 80e9), { grade: "far", toward: "down" });
  assert.equal(capTile(0, 80e9), null);
});

test("ipo tile is honest about pre-1980 provider dates", () => {
  assert.deepEqual(ipoTile(2004, 2008), { grade: "near", toward: "up" });
  assert.deepEqual(ipoTile(2004, 2010), { grade: "far", toward: "up" });
  /* Sağlayıcının 1950'si gerçekte "1950 ya da önce": yön kesin. */
  assert.deepEqual(ipoTile(1950, 1999), { grade: "far", toward: "up" });
  /* 1982 ile "1980 öncesi" arası beş yıl da olabilir, otuz da: uzaklık yok. */
  assert.deepEqual(ipoTile(1982, 1950), { grade: null, toward: "down" });
  assert.equal(ipoTile(1950, 1960), null);
});

test("growth tile: within two points matches without an arrow", () => {
  assert.deepEqual(growthTile(10, 11.5), { grade: "match", toward: null });
  assert.deepEqual(growthTile(10, 19), { grade: "near", toward: "up" });
  assert.deepEqual(growthTile(10, -5), { grade: "far", toward: "down" });
});

test("axis opens after the third miss and at the end, never before", () => {
  const range = { low: 100, high: 150, last: 120, from: "2025-10-24", to: "2026-10-23" };
  assert.equal(axisFor(range, AXIS_AFTER_MISSES - 1, false), null);
  assert.deepEqual(axisFor(range, AXIS_AFTER_MISSES, false), { spreadPct: 50 });
  assert.deepEqual(axisFor(range, 0, true), { spreadPct: 50 });
  assert.equal(axisFor(null, 6, true), null);
  assert.equal(axisFor({ ...range, high: 100 }, 6, true), null);
});

test("percent from start rebuilds the path from the spread alone", () => {
  /* low 100, high 150, ilk nokta 120 (y = 0.4): üst çizgi %25, alt -%16,7. */
  assert.equal(Math.round(pctFromStart(1, 0.4, 50) * 10) / 10, 25);
  assert.equal(Math.round(pctFromStart(0, 0.4, 50) * 10) / 10, -16.7);
  assert.equal(pctFromStart(0.4, 0.4, 50), 0);
});

test("progress cookie keeps today's valid list only", () => {
  const value = progressCookieValue("2026-10-25", ["AAPL", "BRK.B"]);
  assert.equal(value, "2026-10-25|AAPL|BRK.B");
  assert.deepEqual(parseProgressCookie(value, "2026-10-25"), ["AAPL", "BRK.B"]);
  assert.deepEqual(parseProgressCookie(value, "2026-10-26"), []);
  assert.deepEqual(parseProgressCookie("2026-10-25|aapl", "2026-10-25"), []);
  assert.deepEqual(parseProgressCookie("2026-10-25|A|A", "2026-10-25"), []);
  assert.deepEqual(parseProgressCookie("2026-10-25|A|B|C|D|E|F|G", "2026-10-25"), []);
  assert.deepEqual(parseProgressCookie(undefined, "2026-10-25"), []);
  /* Joker işareti çerezde geçerli ve birden çok olabilir. */
  assert.deepEqual(parseProgressCookie("2026-10-25|*|AAPL|*", "2026-10-25"), ["*", "AAPL", "*"]);
});

test("status: won on a hit, lost after six misses", () => {
  const miss = { correct: false };
  assert.equal(statusOf([miss, { correct: true }]), "won");
  assert.equal(statusOf(Array(MAX_GUESSES).fill(miss)), "lost");
  assert.equal(statusOf([miss]), "playing");
});

test("share grid is one row per guess, answer never written", () => {
  const answer = brief({ symbol: "NVDA" });
  const feedback = [
    compareGuess(brief({ symbol: "XOM", sector: "Energy", marketCap: 5e12, ipoYear: 1999, revenueGrowth: 59 }), answer),
    compareGuess(brief({ symbol: "AMD", marketCap: 3e11, ipoYear: 1995, revenueGrowth: null }), answer),
    compareGuess(answer, answer),
  ];
  const text = shareText({ title: "Açılış Zili Hisseyi Bil", number: 12, feedback, url: "https://aciliszili.com/bulmaca" });
  assert.equal(text, "Açılış Zili Hisseyi Bil #12 3/6\n⬜🟩🟩🟩\n🟩⬜🟨⬛\n🟩🟩🟩🟩\nhttps://aciliszili.com/bulmaca");
  assert.ok(!text.includes("NVDA"));
  const miss = compareGuess(brief({ symbol: "XOM", sector: "Energy" }), answer);
  assert.match(shareText({ title: "T", number: 1, feedback: Array(6).fill(miss), url: "u" }), /X\/6/);
  assert.deepEqual([...shareGrid([miss])], [SHARE_SQUARES.far, SHARE_SQUARES.match, SHARE_SQUARES.match, SHARE_SQUARES.match]);
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
