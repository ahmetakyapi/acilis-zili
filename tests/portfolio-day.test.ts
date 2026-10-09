import test from "node:test";
import assert from "node:assert/strict";
import { dayMove, dayTotals } from "../lib/portfolio";

/** Portföyün günlük değişimi — yalnızca seansı kanıtlanan kotasyon (lib/portfolio.ts). */

test("kanıtlanmayan kotasyon değişim vermez", () => {
  assert.deepEqual(dayMove(10, { change: 2, changePct: 1 }, false), { changeUsd: null, changePct: null });
  assert.deepEqual(dayMove(10, { change: null, changePct: null }, true), { changeUsd: null, changePct: null });
  assert.deepEqual(dayMove(10, { change: 2, changePct: 1 }, true), { changeUsd: 20, changePct: 1 });
});

test("toplam yalnızca kapsananlardan; oran önceki değere göre", () => {
  const total = dayTotals([
    { changeUsd: 20, changePct: 2, valueUsd: 1020 },
    { changeUsd: -10, changePct: -1, valueUsd: 990 },
    { changeUsd: null, changePct: null, valueUsd: 500 },
  ]);
  assert.equal(total.changeUsd, 10);
  assert.equal(total.covered, 2);
  assert.equal(total.excluded, 1);
  assert.ok(Math.abs((total.changePct ?? 0) - (10 / 2000) * 100) < 1e-12);
});

test("hiç kapsanan yoksa oran yok", () => {
  assert.equal(dayTotals([{ changeUsd: null, changePct: null, valueUsd: 100 }]).changePct, null);
});
