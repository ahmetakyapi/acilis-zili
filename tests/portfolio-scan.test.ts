import test from "node:test";
import assert from "node:assert/strict";
import {
  checkPlans,
  checkScan,
  planLevels,
  scanInput,
  scanRows,
  weightedChange,
  type ScanHoldingInput,
} from "../lib/portfolio-scan-model";

/** Günlük portföy taraması — saf hesap (lib/portfolio-scan-model.ts). */

const bars = (closes: number[]) => closes.map((close) => ({ close, high: close + 1, low: close - 1 }));
const holding = (symbol: string, closes: number[], extra: Partial<ScanHoldingInput> = {}): ScanHoldingInput => ({
  symbol,
  name: symbol,
  sector: "Yarı İletken",
  quantity: 10,
  cost: 10 * 100,
  bars: bars(closes),
  earnings: null,
  technical: null,
  news: [],
  ...extra,
});
const day = (date: string) => date;

test("ölçüler tamamlanmış barlardan: son seans, 5 seans, maliyete göre", () => {
  const [row] = scanRows([holding("MU", [100, 100, 100, 100, 100, 100, 110])]);
  assert.ok(row);
  assert.equal(row.close, 110);
  assert.equal(Math.round(row.day! * 10) / 10, 10);
  assert.equal(Math.round(row.fiveSession! * 10) / 10, 10);
  assert.equal(Math.round(row.sinceCost! * 10) / 10, 10);
  assert.equal(row.month, null, "21 seans yoksa aylık değişim yok");
  assert.equal(row.weight, 100);
});

test("barı 6'dan kısa pozisyon dışarıda; ağırlıklar ölçülenlerle", () => {
  const rows = scanRows([holding("MU", [100, 100, 100, 100, 100, 100, 100]), holding("AMD", [100, 100])]);
  assert.deepEqual(rows.map((r) => r.symbol), ["MU"]);
});

test("işaretler: bilanço, teknik, bant ucu, haber", () => {
  const [row] = scanRows([
    holding("SNDK", [80, 85, 90, 95, 100, 105, 120], {
      earnings: { date: "2026-11-12", timing: "amc" },
      technical: { stance: "sell", headline: null },
      news: [{ headline: "x", source: null }],
    }),
  ]);
  const kinds = row!.flags.map((f) => f.kind);
  assert.deepEqual(kinds, ["earnings", "technical", "nearHigh", "news"]);
});

test("portföyün ağırlıklı değişimi", () => {
  const rows = scanRows([
    holding("A", [100, 100, 100, 100, 100, 100, 110], { quantity: 30, cost: 3000 }),
    holding("B", [100, 100, 100, 100, 100, 100, 90], { quantity: 10, cost: 1000 }),
  ]);
  const value = weightedChange(rows, "day")!;
  /* A 3.300, B 900 → ağırlık %78,6 / %21,4 → +10 × .786 − 10 × .214 */
  assert.ok(Math.abs(value - (10 * (3300 / 4200) - 10 * (900 / 4200))) < 1e-9);
});

const sample = () => {
  const rows = scanRows([holding("MU", [100, 100, 100, 100, 100, 100, 110])]);
  const input = scanInput(rows, "2026-11-10", "tr", day, { newsBySymbol: new Map(), technicalBySymbol: new Map() });
  return { rows, input };
};

test("girdide biçimlenmiş yüzdeler ve pencereler var", () => {
  const { input } = sample();
  const parsed = JSON.parse(input);
  assert.equal(parsed.positions[0].lastFiveSessions, "+%10,0");
  assert.ok(parsed.windows.includes("5 seans"));
});

test("çıktı denetimi: girdide olmayan sayı metni düşürür", () => {
  const { input } = sample();
  const bad = checkScan({ headline: "MU %12 yükseldi", summary: "x", themes: [], positions: [] }, input, ["MU"], "tr");
  assert.equal(bad.ok, false);
  const good = checkScan({ headline: "MU 5 seansta %10,0 yükseldi", summary: "Portföy güçlü.", themes: [], positions: [{ symbol: "mu", note: "Son seansta %10,00." }] }, input, ["MU"], "tr");
  assert.equal(good.ok, true);
  if (good.ok) assert.equal(good.text.notes.MU, "Son seansta %10,00.");
});

test("çıktı denetimi: tavsiye kalıbı üyede düşer, sahip planında geçer", () => {
  const { input } = sample();
  const out = { headline: "MU'yu satmalısın", summary: "Kârı almalısın.", themes: [], positions: [] };
  assert.equal(checkScan(out, input, ["MU"], "tr").ok, false);
  assert.equal(checkScan(out, input, ["MU"], "tr", { adviceAllowed: true }).ok, true);
});

test("plan seviyeleri yalnız listeden ve doğru yönde", () => {
  const rows = scanRows([
    holding("MU", [100, 100, 100, 100, 100, 100, 110], {
      levels: { stop: 95, entryLow: null, entryHigh: null, targets: [125], supports: [], resistances: [] },
    }),
  ]);
  const fmt = (v: number) => `$${v.toFixed(2)}`;
  const levels = planLevels(rows[0]!, fmt);
  assert.ok(levels.some((l) => l.label === "$95.00" && l.source === "stop"));
  assert.ok(levels.some((l) => l.label === "$125.00" && l.source === "target"));
  const input = JSON.stringify({ levels: levels.map((l) => l.label), note: "%10,0", window: "5 seans" });
  const [plan] = checkPlans(
    [{ symbol: "MU", action: "trim", takeProfit: "$125.00", stopLoss: "$130.00", rationale: "5 seansta %10,0 yükseldi." }],
    rows,
    (r) => planLevels(r, fmt),
    input,
  );
  assert.equal(plan!.takeProfit?.value, 125);
  assert.equal(plan!.stopLoss, null, "listede olmayan seviye düşer");
  const [wrongSide] = checkPlans(
    [{ symbol: "MU", action: "hold", takeProfit: "$95.00", stopLoss: null, rationale: "Ölçüler karışık." }],
    rows,
    (r) => planLevels(r, fmt),
    input,
  );
  assert.equal(wrongSide!.takeProfit, null, "kâr al kapanışın altında olamaz");
});
