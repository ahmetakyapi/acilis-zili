import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  change24h,
  composeLead,
  cpiLadder,
  eventProbabilities,
  expectedMoveBps,
  fedMoveOf,
  historyLine,
  ladderMedian,
  leadFacts,
  liquidityOf,
  nextMeeting,
  normalize,
  priceOf,
  ratePath,
  resolvedOutcome,
  shouldRefresh,
  percentShares,
  wholePercent,
  SNAPSHOT_VERSION,
  type ProbabilitySnapshot,
  type ProbEvent,
  type ProbOutcome,
} from "../lib/probabilities";
import { probabilitiesEn, probabilitiesTr } from "../lib/i18n/dictionaries/probabilities";

/* Fikstürler Kalshi'nin 25 Ekim 2026 yanıtından (KXFEDDECISION-26OCT,
   CONTROLH-2026, CONTROLS-2026, KXCPI-26OCT) kısaltıldı. */

function outcome(key: string, bid: number | null, ask: number | null, last: number | null, extra: Partial<ProbOutcome> = {}): ProbOutcome {
  return {
    key,
    ticker: `T-${key}`,
    bid,
    ask,
    last,
    prevBid: null,
    prevAsk: null,
    prevLast: null,
    openInterest: 100_000,
    volume24h: 1_000,
    result: null,
    ...extra,
  };
}

function event(kind: ProbEvent["kind"], outcomes: ProbOutcome[], extra: Partial<ProbEvent> = {}): ProbEvent {
  return { kind, eventTicker: `E-${kind}`, strikeAt: null, closesAt: null, outcomes, history: [], ...extra };
}

const fedOct = event(
  "fed",
  [
    outcome("cut50", 0, 0.01, 0.01, { prevBid: 0, prevAsk: 0.01, prevLast: 0.01 }),
    outcome("cut25", 0, 0.01, 0.01, { prevBid: 0, prevAsk: 0.01, prevLast: 0.01 }),
    outcome("hold", 0.93, 0.94, 0.94, { prevBid: 0.92, prevAsk: 0.93, prevLast: 0.93 }),
    outcome("hike25", 0.05, 0.06, 0.06, { prevBid: 0.07, prevAsk: 0.08, prevLast: 0.08 }),
    outcome("hike50", 0, 0.01, 0.01, { prevBid: 0, prevAsk: 0.01, prevLast: 0.01 }),
  ],
  { eventTicker: "KXFEDDECISION-26OCT", strikeAt: "2026-10-28T18:00:00Z" },
);

const fedDec = event(
  "fed",
  [
    outcome("cut50", 0, 0.01, 0.01),
    outcome("cut25", 0.01, 0.02, 0.01),
    outcome("hold", 0.23, 0.24, 0.24),
    outcome("hike25", 0.73, 0.74, 0.74),
    outcome("hike50", 0.03, 0.05, 0.05),
  ],
  { eventTicker: "KXFEDDECISION-26DEC", strikeAt: "2026-12-09T19:00:00Z" },
);

const house = event("house", [outcome("dem", 0.905, 0.906, 0.906), outcome("rep", 0.094, 0.096, 0.097)], {
  strikeAt: "2026-11-03T23:00:00Z",
});
const senate = event("senate", [outcome("dem", 0.62, 0.63, 0.63, { prevBid: 0.66, prevAsk: 0.67, prevLast: 0.67 }), outcome("rep", 0.36, 0.37, 0.37, { prevBid: 0.32, prevAsk: 0.33, prevLast: 0.33 })], {
  strikeAt: "2026-11-03T23:00:00Z",
});

test("price: tight book reads the mid, wide book falls back to the last trade", () => {
  assert.equal(priceOf(0.62, 0.63, 0.7), 0.625);
  assert.ok(Math.abs(priceOf(0.06, 0.13, 0.35)! - 0.095) < 1e-9);
  assert.equal(priceOf(0.05, 0.4, 0.35), 0.35);
  assert.equal(priceOf(null, null, 0.4), 0.4);
  assert.equal(priceOf(0.1, 0.4, null), 0.25);
  assert.equal(priceOf(null, null, null), null);
});

test("fed strikes map to the five decision keys", () => {
  assert.equal(fedMoveOf({ Cut: ">25" }), "cut50");
  assert.equal(fedMoveOf({ Cut: "25" }), "cut25");
  assert.equal(fedMoveOf({ Hike: "0" }), "hold");
  assert.equal(fedMoveOf({ Hike: "25" }), "hike25");
  assert.equal(fedMoveOf({ Hike: ">25" }), "hike50");
  assert.equal(fedMoveOf({ Cut: "75" }), null);
  assert.equal(fedMoveOf(null), null);
});

test("mutually exclusive outcomes are scaled to add up to one", () => {
  const probs = eventProbabilities(fedOct)!;
  const total = Object.values(probs).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(total - 1) < 1e-9);
  assert.ok(probs.hold > 0.92 && probs.hold < 0.94);
  assert.equal(normalize({ a: null, b: null }), null);
});

test("a single-contract event reads yes directly and no as its complement", () => {
  const recession = event("recession", [outcome("yes", 0.2, 0.21, 0.21)]);
  const probs = eventProbabilities(recession)!;
  assert.ok(Math.abs(probs.yes - 0.205) < 1e-9);
  assert.ok(Math.abs(probs.no - 0.795) < 1e-9);
});

test("24-hour change is in whole percentage points of the normalized probability", () => {
  assert.equal(change24h(senate, "dem"), -4);
  assert.equal(change24h(fedOct, "hold"), 2);
  assert.equal(change24h(house, "dem"), null);
});

test("liquidity: open interest and the leading spread decide", () => {
  assert.equal(liquidityOf(house), "liquid");
  const thin = event("fed", [outcome("hold", 0.5, 0.7, 0.6, { openInterest: 3_000 }), outcome("hike25", 0.3, 0.4, 0.35, { openInterest: 3_000 })]);
  assert.equal(liquidityOf(thin), "thin");
  const deepSingle = event("recession", [outcome("yes", 0.2, 0.21, 0.21, { openInterest: 300_000 })]);
  assert.equal(liquidityOf(deepSingle), "liquid");
  const tiny = event("fed", [outcome("hold", 0.5, 0.51, 0.5, { openInterest: 500 })]);
  assert.equal(liquidityOf(tiny), "hidden");
});

test("expected path adds each meeting's expected move to today's midpoint", () => {
  const oct = eventProbabilities(fedOct)!;
  const dec = eventProbabilities(fedDec)!;
  const steps = ratePath([fedDec, fedOct], { lower: 3.5, upper: 3.75 });
  assert.equal(steps.length, 2);
  assert.equal(steps[0].eventTicker, "KXFEDDECISION-26OCT");
  assert.ok(Math.abs(steps[0].moveBps - expectedMoveBps(oct)) < 1e-9);
  assert.ok(Math.abs(steps[1].cumulativeBps - (expectedMoveBps(oct) + expectedMoveBps(dec))) < 1e-9);
  assert.ok(Math.abs(steps[1].expectedMid! - (3.625 + steps[1].cumulativeBps / 100)) < 1e-9);
  /* Aralık yoksa düzey yok, birikim var. */
  assert.equal(ratePath([fedOct], null)[0].expectedMid, null);
});

test("a hidden meeting cuts the path instead of being skipped", () => {
  const hidden = event("fed", [outcome("hold", 0.5, 0.51, 0.5, { openInterest: 100 })], { strikeAt: "2026-11-15T00:00:00Z" });
  const steps = ratePath([fedOct, hidden, fedDec], { lower: 3.5, upper: 3.75 });
  assert.equal(steps.length, 1);
});

test("next meeting skips settled and long-past decisions", () => {
  const settled = { ...fedOct, outcomes: fedOct.outcomes.map((o) => (o.key === "hold" ? { ...o, result: "yes" as const } : { ...o, result: "no" as const })) };
  assert.equal(nextMeeting([settled, fedDec], new Date("2026-10-25T12:00:00Z"))?.eventTicker, "KXFEDDECISION-26DEC");
  assert.equal(nextMeeting([fedOct, fedDec], new Date("2026-10-25T12:00:00Z"))?.eventTicker, "KXFEDDECISION-26OCT");
  assert.equal(nextMeeting([fedOct, fedDec], new Date("2026-10-29T12:00:00Z"))?.eventTicker, "KXFEDDECISION-26DEC");
});

test("a chamber is resolved only when the source settles it, not when the price nears 1", () => {
  assert.equal(resolvedOutcome(house), null);
  const done = { ...house, outcomes: [{ ...house.outcomes[0], result: "yes" as const }, { ...house.outcomes[1], result: "no" as const }] };
  assert.equal(resolvedOutcome(done), "dem");
});

test("history line normalizes each day and skips incomplete days", () => {
  const withHistory: ProbEvent = {
    ...senate,
    history: [
      { t: 1, values: { dem: 0.6, rep: 0.38 } },
      { t: 2, values: { dem: 0.62 } },
      { t: 3, values: { dem: 0.66, rep: 0.36 } },
    ],
  };
  const line = historyLine(withHistory, ["dem"]);
  assert.deepEqual(line.map((p) => p.t), [1, 3]);
  assert.ok(Math.abs(line[0].p - 0.6 / 0.98) < 1e-9);
});

test("CPI ladder is made monotone and its median interpolates the 50% crossing", () => {
  const cpi = event("cpi", [
    outcome("0.1", 0.89, 0.9, 0.9),
    outcome("0.2", 0.63, 0.66, 0.62),
    outcome("0.3", 0.22, 0.23, 0.23),
    outcome("0.4", 0.07, 0.12, 0.1),
    outcome("0.5", 0.01, 0.02, 0.02, { openInterest: 1_000 }),
  ]);
  const ladder = cpiLadder(cpi);
  assert.deepEqual(ladder.map((s) => s.threshold), [0.1, 0.2, 0.3, 0.4]);
  for (let i = 1; i < ladder.length; i++) assert.ok(ladder[i].above <= ladder[i - 1].above);
  const median = ladderMedian(ladder)!;
  assert.ok(median > 0.2 && median < 0.3);
  assert.equal(ladderMedian([{ threshold: 0.1, above: 0.3, openInterest: 1e5 }, { threshold: 0.2, above: 0.1, openInterest: 1e5 }]), null);
});

const snapshot: ProbabilitySnapshot = {
  v: SNAPSHOT_VERSION,
  source: "kalshi",
  takenAt: "2026-10-25T13:00:00Z",
  fed: [fedOct, fedDec],
  congress: [house, senate],
  macro: [],
};

const tr = probabilitiesTr;
const templates = {
  fed: tr.leadFed,
  congressSame: tr.leadCongressSame,
  congressSplit: tr.leadCongressSplit,
  congressOne: tr.leadCongressOne,
  congressResult: tr.leadCongressResult,
  join: tr.leadJoin,
  joinResults: tr.leadJoinResults,
};
const fmt = {
  percent: (n: number) => `%${n}`,
  date: () => "28 Ekim",
  move: (m: keyof typeof tr.leadMove) => tr.leadMove[m],
  party: (k: string) => tr.leadParty[k as "dem" | "rep"],
  partyName: (k: string) => tr.parties[k as "dem" | "rep"],
  chamber: (k: "house" | "senate") => tr.leadChamber[k],
};

test("lead sentence: Fed and both chambers led by the same party", () => {
  const sentence = composeLead(leadFacts(snapshot, new Date("2026-10-25T13:00:00Z")), templates, fmt);
  assert.equal(
    sentence,
    "28 Ekim Fed toplantısında faizin sabit kalma olasılığı %93; Demokratların Temsilciler Meclisi'ni kazanma olasılığı %91, Senato'yu kazanma olasılığı %63.",
  );
});

test("lead sentence: split chambers and settled results", () => {
  const split = { ...snapshot, fed: [], congress: [house, { ...senate, outcomes: [outcome("dem", 0.3, 0.31, 0.3), outcome("rep", 0.69, 0.7, 0.7)] }] };
  assert.equal(
    composeLead(leadFacts(split), templates, fmt),
    "Temsilciler Meclisi'nde Demokratlar %91, Senato'da Cumhuriyetçiler %70 olasılıkla önde.",
  );
  const settle = (e: ProbEvent, winner: string) => ({ ...e, outcomes: e.outcomes.map((o) => ({ ...o, result: o.key === winner ? ("yes" as const) : ("no" as const) })) });
  const done = { ...snapshot, fed: [], congress: [settle(house, "dem"), settle(senate, "rep")] };
  assert.equal(composeLead(leadFacts(done), templates, fmt), "Temsilciler Meclisi'ni Demokratlar kazandı, Senato'yu Cumhuriyetçiler kazandı.");
  assert.equal(composeLead(leadFacts({ ...snapshot, fed: [], congress: [] }), templates, fmt), null);
});

test("stack percentages always add up to exactly 100", () => {
  assert.deepEqual(percentShares([0.205, 0.795]), [20, 80]);
  assert.deepEqual(percentShares([0.633, 0.367]), [63, 37]);
  const fed = percentShares([0.005, 0.005, 0.93, 0.055, 0.005]);
  assert.equal(fed.reduce((a, b) => a + b, 0), 100);
  assert.equal(fed[2], 93);
  assert.deepEqual(percentShares([0, 1]), [0, 100]);
  assert.deepEqual(percentShares([0, 0]), [0, 0]);
});

test("whole percent never rounds a live probability to 0 or 100", () => {
  assert.equal(wholePercent(0.004), 1);
  assert.equal(wholePercent(0.996), 99);
  assert.equal(wholePercent(0.634), 63);
  assert.equal(wholePercent(1), 100);
});

test("refresh: daily by default, hourly inside a watch window", () => {
  const watch = [{ from: "2026-11-03T22:00:00Z", to: "2026-11-05T12:00:00Z" }];
  const now = new Date("2026-10-25T13:07:00Z");
  assert.equal(shouldRefresh(now, null, watch), true);
  assert.equal(shouldRefresh(now, new Date("2026-10-25T08:00:00Z"), watch), false);
  assert.equal(shouldRefresh(now, new Date("2026-10-24T13:00:00Z"), watch), true);
  const night = new Date("2026-11-04T03:07:00Z");
  assert.equal(shouldRefresh(night, new Date("2026-11-04T02:07:00Z"), watch), true);
  assert.equal(shouldRefresh(night, new Date("2026-11-04T02:40:00Z"), watch), false);
});

/* Kural: sayfa hiçbir koşulda işlem/bahis bağlantısı basmaz. Sözlükte ve
   veri katmanında adres yok; sağlayıcı modülü yalnız API ucunu bilir. */
test("no links to trading or betting pages anywhere in the feature", () => {
  const strings = JSON.stringify([probabilitiesTr, probabilitiesEn]);
  assert.doesNotMatch(strings, /https?:\/\/|www\.|kalshi\.com|polymarket\.com/i);
  for (const file of ["lib/probabilities.ts", "components/probabilities/ProbabilityPanels.tsx", "components/probabilities/ProbabilityParts.tsx", "components/probabilities/FedOddsTag.tsx", "app/(app)/olasiliklar/page.tsx"]) {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(source, /https?:\/\/(?!127\.0\.0\.1)/, file);
  }
  const provider = readFileSync("lib/providers/kalshi.ts", "utf8");
  const urls = provider.match(/https?:\/\/[^\s"'`]+/g) ?? [];
  assert.deepEqual([...new Set(urls)], ["https://api.elections.kalshi.com/trade-api/v2"]);
});
