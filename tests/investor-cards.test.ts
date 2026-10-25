import test from "node:test";
import assert from "node:assert/strict";

import { diffPeriods, headlineMove, type HoldingRecord } from "../lib/investor-view";
import { capitalShares, leanTally } from "../components/investors/card-view";

/**
 * Dizin kartlarının saf hesapları (25 Ekim): çeyreğin öne çıkan hareketi,
 * takip edilen sermayedeki pay ve kartların üstündeki yön sayımı.
 */

function holding(cusip: string, amount: number, value: number): HoldingRecord {
  return { cusip, position: "long", issuer: cusip, titleOfClass: "COM", amount, amountType: "SH", value };
}

test("headline: price growth alone is not a move; traded size picks the winner", () => {
  const previous = [holding("APPLE", 100, 1000), holding("SMALL", 100, 100), holding("HALF", 100, 1000)];
  const current = [
    holding("APPLE", 100, 5000), // değer beş katı, adet aynı: hareket değil
    holding("SMALL", 200, 200), // iki katı ama küçük: 100 $ el değiştirdi
    holding("HALF", 50, 500), // yarıya indi: 500 $ el değiştirdi
  ];
  const best = headlineMove(diffPeriods(current, previous));
  assert.equal(best?.cusip, "HALF");
  assert.equal(best?.move, "decreased");
  assert.equal(Math.round(best?.changePct ?? 0), -50);
});

test("headline: a new position and a full exit count at their whole value", () => {
  const previous = [holding("OUT", 100, 900), holding("KEEP", 100, 1000)];
  const current = [holding("KEEP", 110, 1100), holding("IN", 10, 400)];
  const best = headlineMove(diffPeriods(current, previous));
  assert.deepEqual(best, { cusip: "OUT", issuer: "OUT", move: "soldOut", changePct: null });
  const noExit = headlineMove(diffPeriods([holding("KEEP", 110, 1100), holding("IN", 10, 400)], [holding("KEEP", 100, 1000)]));
  assert.equal(noExit?.move, "new");
});

test("headline: no previous filing, no move", () => {
  assert.equal(headlineMove(diffPeriods([holding("A", 1, 1)], null)), null);
  assert.equal(headlineMove(diffPeriods([holding("A", 1, 1)], [holding("A", 1, 1)])), null);
});

test("capital shares: only the current quarter's open funds, summing to 100", () => {
  const shares = capitalShares(
    [
      { slug: "a", value: 600, current: true },
      { slug: "b", value: 300, current: true },
      { slug: "c", value: 100, current: true },
      { slug: "old", value: 5000, current: false },
    ],
  );
  assert.equal(shares.total, 1000);
  assert.deepEqual(
    shares.slices.map((slice) => [slice.slug, slice.share]),
    [["a", 60], ["b", 30], ["c", 10]],
  );
  assert.equal(shares.shareOf.get("old"), undefined);
});

test("lean tally: counts buyers, sellers and even funds", () => {
  assert.deepEqual(leanTally(["up", "up", "down", "flat", null]), { up: 2, down: 1, flat: 1 });
});
