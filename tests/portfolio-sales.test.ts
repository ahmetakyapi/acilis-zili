import test from "node:test";
import assert from "node:assert/strict";
import { planFifoSale, planSaleUndo, saleViews, yearTotals, type SaleLot, type SalePart } from "../lib/portfolio-sales";

/** Portföy satışı: FIFO planı ve gerçekleşen kâr (lib/portfolio-sales.ts). */

const lot = (id: string, quantity: number, costUsd: number, boughtAt: string): SaleLot => ({ id, quantity, costUsd, boughtAt, note: null });

test("FIFO en eski partiden başlar ve kısmi tüketir", () => {
  const plan = planFifoSale([lot("b", 5, 120, "2026-03-01"), lot("a", 10, 100, "2026-01-10")], 12, "2026-06-01");
  assert.ok(plan.ok);
  if (!plan.ok) return;
  assert.deepEqual(plan.steps.map((s) => [s.lot.id, s.take, s.exhausted]), [["a", 10, true], ["b", 2, false]]);
});

test("satış gününden sonra alınmış parti tüketilmez", () => {
  const plan = planFifoSale([lot("a", 10, 100, "2026-01-10"), lot("b", 5, 120, "2026-07-01")], 12, "2026-06-01");
  assert.deepEqual(plan, { ok: false, reason: "tooMany", available: 10 });
  const none = planFifoSale([lot("b", 5, 120, "2026-07-01")], 1, "2026-06-01");
  assert.deepEqual(none, { ok: false, reason: "noLots", available: 0 });
});

test("tamamı satılınca her parti tükenir; aynı gün alınanlarda kayıt sırası", () => {
  const plan = planFifoSale([lot("x", 1.5, 10, "2026-02-02"), lot("y", 2.5, 11, "2026-02-02")], 4, "2026-02-02");
  assert.ok(plan.ok);
  if (!plan.ok) return;
  assert.deepEqual(plan.steps.map((s) => [s.lot.id, s.take, s.exhausted]), [["x", 1.5, true], ["y", 2.5, true]]);
});

const part = (saleId: string, quantity: number, costUsd: number, boughtAt: string, soldAt = "2026-06-01", priceUsd = 150): SalePart => ({
  saleId,
  symbol: "NVDA",
  quantity,
  priceUsd,
  soldAt,
  costUsd,
  boughtAt,
});

test("gerçekleşen kâr: dolar ve iki günün kuruyla lira", () => {
  const rates: Record<string, number> = { "2026-01-10": 30, "2026-03-01": 32, "2026-06-01": 40 };
  const [view] = saleViews([part("s1", 10, 100, "2026-01-10"), part("s1", 2, 120, "2026-03-01")], (d) => rates[d] ?? null);
  assert.equal(view.quantity, 12);
  assert.equal(view.proceedsUsd, 1800);
  assert.equal(view.costTotalUsd, 1240);
  assert.equal(view.pnlUsd, 560);
  assert.equal(view.costTl, 10 * 100 * 30 + 2 * 120 * 32);
  assert.equal(view.proceedsTl, 1800 * 40);
  assert.equal(view.pnlTl, 1800 * 40 - (30000 + 7680));
  assert.equal(view.lots, 2);
  assert.equal(view.firstBoughtAt, "2026-01-10");
});

test("bir kur eksikse lira tarafı boş, yıl toplamı da kısmi değil boş", () => {
  const views = saleViews(
    [part("s1", 1, 100, "2026-01-10"), part("s2", 1, 100, "2026-01-11", "2026-05-01")],
    (d) => (d === "2026-01-11" ? null : 35),
  );
  const s2 = views.find((v) => v.saleId === "s2")!;
  assert.equal(s2.pnlTl, null);
  const [year] = yearTotals(views);
  assert.equal(year.count, 2);
  assert.equal(year.pnlUsd, 100);
  assert.equal(year.pnlTl, null);
});

test("satışlar yeniden eskiye, yıllar yeniden eskiye", () => {
  const views = saleViews(
    [part("a", 1, 1, "2025-01-01", "2025-03-01"), part("b", 1, 1, "2025-01-01", "2026-03-01")],
    () => 1,
  );
  assert.deepEqual(views.map((v) => v.saleId), ["b", "a"]);
  assert.deepEqual(yearTotals(views).map((y) => y.year), ["2026", "2025"]);
});

test("geri alma: aynı gün ve maliyetteki iki partinin parçaları kalan partiye TOPLANIR", () => {
  /* A(5) ve B(5) aynı gün, aynı fiyat; 7 satılınca A tükenir, B 3'e iner. */
  const lots = [lot("a", 5, 100, "2025-03-03"), lot("b", 5, 100, "2025-03-03")];
  const plan = planFifoSale(lots, 7, "2025-06-01");
  assert.ok(plan.ok);
  if (!plan.ok) return;
  const remaining = plan.steps
    .filter((step) => !step.exhausted)
    .map((step) => ({ ...step.lot, quantity: step.lot.quantity - step.take }));
  assert.deepEqual(remaining.map((l) => [l.id, l.quantity]), [["b", 3]]);

  const parts = plan.steps.map((step) => ({ quantity: step.take, costUsd: step.lot.costUsd, boughtAt: step.lot.boughtAt }));
  const undo = planSaleUndo(parts, remaining);
  /* İki parça da B'ye düşer; tek güncelleme, 5 + 2 — eldeki toplam yine 10. */
  assert.deepEqual(undo.restore, [{ lotId: "b", quantity: 7 }]);
  assert.deepEqual(undo.reopen, []);
  assert.equal(remaining[0].quantity + undo.restore[0].quantity, 10);
});

test("geri alma: eşi kalmamış parça yeniden açılır, maliyeti farklı parti eşleşmez", () => {
  const parts = [
    { quantity: 2, costUsd: 100, boughtAt: "2025-03-03" },
    { quantity: 1.5, costUsd: 120, boughtAt: "2025-03-03" },
    { quantity: 4, costUsd: 90, boughtAt: "2025-01-02" },
  ];
  const undo = planSaleUndo(parts, [lot("b", 3, 100, "2025-03-03"), lot("c", 1, 90, "2025-01-03")]);
  assert.deepEqual(undo.restore, [{ lotId: "b", quantity: 2 }]);
  assert.deepEqual(undo.reopen, [parts[1], parts[2]]);
});
