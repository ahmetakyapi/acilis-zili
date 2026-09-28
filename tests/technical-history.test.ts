import test from "node:test";
import assert from "node:assert/strict";
import { groupPlanHistory, planHistoryScale, type PlanHistoryEntry } from "../lib/technical";

const row = (sessionDate: string, slot: string, entryLow: number | null, stop: number | null, stance = "buy"): PlanHistoryEntry => ({
  sessionDate,
  slot,
  stance,
  entryLow,
  entryHigh: entryLow === null ? null : entryLow + 2,
  stop,
});

test("aynı gün aynı plan tek satırda birleşir, dilimler eskiden yeniye", () => {
  const runs = groupPlanHistory([
    row("2026-09-28", "lateday", 226, 224),
    row("2026-09-28", "midsession", 226, 224),
    row("2026-09-28", "premarket", 225, 221),
    row("2026-09-25", "lateday", 221, 217),
    row("2026-09-25", "midsession", 221, 217),
    row("2026-09-25", "premarket", 221, 217),
  ]);
  assert.equal(runs.length, 3);
  assert.deepEqual(runs[0]?.slots, ["midsession", "lateday"]);
  assert.equal(runs[0]?.entry.slot, "lateday");
  assert.deepEqual(runs[1]?.slots, ["premarket"]);
  assert.deepEqual(runs[2]?.slots, ["premarket", "midsession", "lateday"]);
});

test("gün sınırı ve görüş farkı birleşmeyi keser", () => {
  const runs = groupPlanHistory([
    row("2026-09-28", "premarket", 226, 224),
    row("2026-09-25", "lateday", 226, 224),
    row("2026-09-25", "midsession", 226, 224, "hold"),
  ]);
  assert.equal(runs.length, 3);
});

test("ölçek bütün seviyeleri kapsar, tek değerde yoktur", () => {
  assert.deepEqual(planHistoryScale([row("a", "premarket", 10, 8), row("b", "premarket", 12, null)]), { min: 8, max: 14 });
  assert.equal(planHistoryScale([{ ...row("a", "premarket", null, 5) }]), null);
  assert.equal(planHistoryScale([]), null);
});
