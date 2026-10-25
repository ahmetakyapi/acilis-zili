import test from "node:test";
import assert from "node:assert/strict";

import { runBacktest, signalState, triggerIndexes, type SignalContext } from "../lib/risk/backtest";
import {
  asOfAlign,
  computeRegimes,
  currentStreak,
  drawdownWithin,
  forwardStats,
  quantile,
  regimeOf,
  type DeskDay,
} from "../lib/risk/regime";

function day(i: number, over: Partial<DeskDay> = {}): DeskDay {
  const date = new Date(Date.UTC(2024, 0, 1 + i)).toISOString().slice(0, 10);
  return { date, spy: 100, sma50: 100, sma100: 99, sma200: 95, vix: 14, term: 14 / 17, vxn: 18, vxnVix: 18 / 14, hy: 3, breadth: 70, ...over };
}

test("rejim eşikleri: oran 0,25 ve 0,50", () => {
  assert.equal(regimeOf(0), "riskOn");
  assert.equal(regimeOf(0.249), "riskOn");
  assert.equal(regimeOf(0.25), "cautious");
  assert.equal(regimeOf(0.5), "riskOff");
});

test("sakin piyasa Risk Açık; stres her girdide puan yazar", () => {
  const calm = Array.from({ length: 30 }, (_, i) => day(i));
  const today = computeRegimes(calm).at(-1)!;
  assert.equal(today.regime, "riskOn");
  assert.equal(today.points, 0);
  /* vxnRatio dilimi için 126 gözlem gerekmiyor mu: 30 günde yok, girdi düşer. */
  assert.ok(!today.components.some((c) => c.key === "vxnRatio"));

  const stress = calm.map((d, i) =>
    i === calm.length - 1 ? { ...d, vix: 36, term: 36 / 30, spy: 90, breadth: 30, hy: 4 } : d,
  );
  const s = computeRegimes(stress).at(-1)!;
  const points = Object.fromEntries(s.components.map((c) => [c.key, c.points]));
  assert.equal(points.vixLevel, 2);
  assert.equal(points.vixChange, 2, "14 → 36 beş günde");
  assert.equal(points.term, 2, "36 / 30 > 1");
  assert.equal(points.trend, 2, "200 GO altında");
  assert.equal(points.breadth, 2);
  assert.equal(points.credit, 2, "+1 puan");
  assert.equal(s.regime, "riskOff");
});

test("trend: yalnız 100 GO altı 1 puan (erken uyarı), 200'ün de altı 2", () => {
  const base = Array.from({ length: 6 }, (_, i) => day(i));
  const below100 = computeRegimes([...base.slice(0, 5), day(5, { spy: 97, sma100: 99, sma200: 95 })]).at(-1)!;
  assert.equal(below100.components.find((c) => c.key === "trend")!.points, 1);
  const below200 = computeRegimes([...base.slice(0, 5), day(5, { spy: 94, sma100: 99, sma200: 95 })]).at(-1)!;
  assert.equal(below200.components.find((c) => c.key === "trend")!.points, 2);
});

test("eksik girdi puan sayılmaz; dörtten azı okunuyorsa rejim yok", () => {
  const sparse = [day(0, { vix: null, term: null, vxn: null, vxnVix: null, hy: null, breadth: null })];
  const r = computeRegimes(sparse)[0]!;
  assert.equal(r.components.length, 1);
  assert.equal(r.regime, null);
});

test("asOfAlign: gecikme sınırı içinde son gözlem, dışında null", () => {
  const out = asOfAlign(["2026-10-20", "2026-10-21", "2026-10-30"], [{ date: "2026-10-19", value: 1 }, { date: "2026-10-21", value: 2 }], 4);
  assert.deepEqual(out, [1, 2, null]);
});

test("ileri getiri dağılımı ve ≥%5 düşüş payı", () => {
  const closes = [100, 99, 94, 96, 101, 103];
  assert.equal(drawdownWithin(closes, 0, 3, 5), true);
  assert.equal(drawdownWithin(closes, 3, 2, 5), false);
  assert.equal(drawdownWithin(closes, 4, 3, 5), null, "ufuk dolmadı");
  assert.equal(quantile([1, 2, 3, 4], 0.5), 2.5);
  const days = closes.map((spy, i) => day(i, { spy }));
  const regimes = computeRegimes(days);
  const stats = forwardStats(days, regimes, 2);
  const total = stats.reduce((s, x) => s + x.days, 0);
  assert.equal(total, 4, "ufku dolan dört gün");
});

test("currentStreak", () => {
  const days = Array.from({ length: 8 }, (_, i) => day(i));
  const regimes = computeRegimes(days);
  const streak = currentStreak(regimes)!;
  assert.equal(streak.regime, "riskOn");
  assert.equal(streak.sessions, 8);
});

test("geriye dönük test: kenar tetikleme, bekleme ve taban", () => {
  /* SPY 200 GO'yu 10. günde aşağı kesiyor, 3 gün sonra geri çıkıp 15'te yeniden kesiyor. */
  const n = 70;
  const days = Array.from({ length: n }, (_, i) => {
    const below = (i >= 10 && i < 13) || (i >= 15 && i < 18) || i === 40;
    return day(i, { spy: below ? 90 - (i === 40 ? 0 : i * 0.1) : 100 + i * 0.01, sma200: 95 });
  });
  const regimes = computeRegimes(days);
  const ctx: SignalContext = { days, regimes, volPctile: days.map(() => null) };
  assert.equal(signalState("spyBelow200", ctx, 10), true);
  const idx = triggerIndexes("spyBelow200", ctx, 10);
  assert.deepEqual(idx, [10, 40], "15. gün beklemeye düşer");
  const bt = runBacktest(ctx)!;
  const s = bt.signals.find((x) => x.key === "spyBelow200")!;
  assert.equal(s.triggers, 2);
  assert.equal(s.scored, 2);
  assert.equal(s.hitRate, 0, "tetiklemeden sonra %5 düşüş yok (90 → 100)");
  assert.ok(bt.base.scored > 0);
  const vol = bt.signals.find((x) => x.key === "volPctile")!;
  assert.equal(vol.triggers, 0, "okunamayan ölçü tetiklemez");
});
