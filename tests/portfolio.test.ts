import test from "node:test";
import assert from "node:assert/strict";

import {
  parseTaxHandoff,
  portfolioTotals,
  positionView,
  sectorWeights,
} from "../lib/portfolio";

const POS = { id: "p", symbol: "NVDA", quantity: 10, costUsd: 100, boughtAt: "2025-01-02" };

test("dolar ve lira K/Z farklı kurlarla kurulur", () => {
  const view = positionView(POS, 110, 35, 48);
  assert.equal(view.pnlUsd, 100);
  assert.equal(view.costTl, 35_000);
  assert.equal(view.valueTl, 52_800);
  assert.equal(view.pnlTl, 17_800);
});

test("fiyatı olmayan pozisyon toplamın dışında kalır ve toplam kısmi olur", () => {
  const a = positionView(POS, 110, 35, 48);
  const b = positionView({ ...POS, id: "q", symbol: "XYZ" }, null, 35, 48);
  const totals = portfolioTotals([a, b], 48);
  assert.equal(totals.valueUsd, 1100);
  assert.equal(totals.costUsd, 1000);
  assert.equal(totals.partial, true);
  /* Kurun katkısı: 17.800 − 100 × 48 = 13.000 */
  assert.equal(totals.fxEffectTl, 13_000);
});

test("kur yoksa lira toplamları boş, dolar toplamı yerinde", () => {
  const totals = portfolioTotals([positionView(POS, 110, null, null)], null);
  assert.equal(totals.pnlUsd, 100);
  assert.equal(totals.pnlTl, null);
});

test("sektör ağırlıkları değere göre ve yüzde toplamı 100", () => {
  const weights = sectorWeights([
    { sector: "Teknoloji", valueUsd: 300 },
    { sector: "Enerji", valueUsd: 100 },
    { sector: "Teknoloji", valueUsd: 100 },
    { sector: "Sağlık", valueUsd: null },
  ]);
  assert.deepEqual(weights.map((w) => w.sector), ["Teknoloji", "Enerji"]);
  assert.equal(weights[0].pct, 80);
});

test("aktarım güvenilmez girdi gibi okunur", () => {
  assert.deepEqual(parseTaxHandoff("bozuk"), []);
  assert.deepEqual(
    parseTaxHandoff(
      JSON.stringify([
        { symbol: "NVDA", quantity: 2, costUsd: 100, boughtAt: "2025-01-02" },
        { symbol: "<script>", quantity: 2, costUsd: 100, boughtAt: "2025-01-02" },
        { symbol: "AMD", quantity: -1, costUsd: 100, boughtAt: "2025-01-02" },
      ]),
    ),
    [{ symbol: "NVDA", quantity: 2, costUsd: 100, boughtAt: "2025-01-02" }],
  );
});
