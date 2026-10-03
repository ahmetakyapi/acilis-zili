import assert from "node:assert/strict";
import test from "node:test";
import { cagr, evaluate, sharesChangeYoY, type ScreenInput } from "../lib/screening";

/** Kuralların hepsini rahatça karşılayan bir büyüme hissesi. */
const strong: ScreenInput = {
  price: 120,
  marketCap: 50e9,
  avgVolume: 5e6,
  epsGrowthQ: 40,
  salesGrowthQ: 25,
  epsGrowth3Y: 30,
  epsTTM: 4.2,
  grossMargin: 60,
  operatingMargin: 25,
  netMargin: 20,
  currentRatio: 2.1,
  debtToEquity: 0.3,
  cash: 8e9,
  freeCashFlow: 3e9,
  high52: 125,
  low52: 70,
  return6m: 35,
  market6m: 10,
  sector6m: 15,
  sharesYoY: -1,
  funds: { holders: 4, added: 2, trimmed: 1 },
  insiderMspr: 10,
  buyShareNow: 80,
  buyShare3mAgo: 72,
  upside: 18,
  analysisScore: 75,
  earningsInDays: 40,
  forwardPE: 28,
};

const status = (input: ScreenInput, id: string) => evaluate(input).checks.find((c) => c.id === id)?.status;

test("a stock that meets every rule scores high and is a strong candidate", () => {
  const result = evaluate(strong);
  assert.equal(result.eliminated, false);
  assert.equal(result.band, "strong");
  assert.ok(result.score! >= 90, `score ${result.score}`);
  assert.equal(result.cons.length, 0);
  assert.deepEqual(result.suggestions, ["catalyst"]);
});

test("a micro cap is eliminated and capped no matter how good the rest is", () => {
  const result = evaluate({ ...strong, marketCap: 200e6 });
  assert.equal(result.eliminated, true);
  assert.equal(result.band, "eliminated");
  assert.ok(result.score! <= 45);
  assert.equal(result.cons[0], "marketCap");
});

test("thin liquidity eliminates; enough shares but tiny dollar volume only warns", () => {
  assert.equal(status({ ...strong, avgVolume: 300_000 }, "liquidity"), "fail");
  assert.equal(evaluate({ ...strong, avgVolume: 300_000 }).eliminated, true);
  assert.equal(status({ ...strong, price: 6, avgVolume: 600_000 }, "liquidity"), "warn");
});

test("a cash burner with under a year of runway is eliminated", () => {
  const burner = { ...strong, freeCashFlow: -2e9, cash: 1e9 };
  assert.equal(status(burner, "runway"), "fail");
  assert.equal(evaluate(burner).eliminated, true);
  assert.ok(evaluate(burner).suggestions.includes("burn"));
  // İki yıldan uzun pist: yalnızca dikkat.
  assert.equal(status({ ...strong, freeCashFlow: -1e9, cash: 3e9 }, "runway"), "warn");
});

test("a fallen stock is not cheap: far below the high fails and suggests caution", () => {
  const fallen = { ...strong, price: 50, high52: 125, low52: 45 };
  assert.equal(status(fallen, "nearHigh"), "fail");
  assert.ok(evaluate(fallen).suggestions.includes("fallen"));
});

test("profit growth without sales growth is flagged at its source", () => {
  const costCut = { ...strong, epsGrowthQ: 30, salesGrowthQ: 1 };
  assert.equal(status(costCut, "growthSource"), "warn");
  assert.ok(evaluate(costCut).suggestions.includes("growthSource"));
});

test("laggards behind sector and market fail strength checks", () => {
  const laggard = { ...strong, return6m: -5, market6m: 10, sector6m: 12 };
  assert.equal(status(laggard, "vsMarket"), "fail");
  assert.equal(status(laggard, "vsSector"), "fail");
  assert.ok(evaluate(laggard).suggestions.includes("laggard"));
});

test("missing data is excluded from the score, not counted as a failure", () => {
  const sparse = Object.fromEntries(Object.keys(strong).map((key) => [key, null])) as unknown as ScreenInput;
  const result = evaluate({ ...sparse, price: 100, marketCap: 10e9, epsGrowthQ: 20, salesGrowthQ: 15 });
  assert.equal(result.eliminated, false);
  assert.equal(result.score, 100);
  assert.ok(result.coverage < 30);
  // Kuralların yarısından azı ölçülebildi: bant hüküm vermiyor.
  assert.equal(result.band, "limited");
});

test("without any growth data the band is limited even with a decent score", () => {
  const noGrowth = { ...strong, epsGrowthQ: null, salesGrowthQ: null, epsGrowth3Y: null };
  assert.equal(evaluate(noGrowth).band, "limited");
});

test("banks skip the health rules instead of failing them", () => {
  const bank = { ...strong, financial: true, debtToEquity: 3.3, currentRatio: null, freeCashFlow: -5e9, cash: 1e9 };
  const result = evaluate(bank);
  assert.equal(result.checks.find((c) => c.id === "debt")?.status, "na");
  assert.equal(result.checks.find((c) => c.id === "runway")?.status, "na");
  assert.equal(result.eliminated, false);
  assert.ok(!result.suggestions.includes("burn"));
});

test("no fund holders is no signal, strong insider selling is a warning", () => {
  assert.equal(status({ ...strong, funds: { holders: 0, added: 0, trimmed: 0 } }, "funds"), "na");
  assert.equal(status({ ...strong, insiderMspr: -20 }, "insiders"), "na");
  assert.equal(status({ ...strong, insiderMspr: -80 }, "insiders"), "warn");
});

test("dilution above five percent a year fails", () => {
  assert.equal(status({ ...strong, sharesYoY: 8 }, "dilution"), "fail");
  assert.equal(status({ ...strong, sharesYoY: 3 }, "dilution"), "warn");
});

test("earnings within two weeks adds a suggestion", () => {
  assert.ok(evaluate({ ...strong, earningsInDays: 5 }).suggestions.includes("earningsSoon"));
});

test("three-year CAGR needs two positive ends", () => {
  assert.equal(Math.round(cagr(1.331, 1)!), 10);
  assert.equal(cagr(2, -1), null);
  assert.equal(cagr(-1, 2), null);
});

test("share count change compares against the filing about a year earlier", () => {
  const series = [
    { end: "2025-03-13", value: 1_000 },
    { end: "2025-06-18", value: 1_010 },
    { end: "2025-09-26", value: 1_020 },
    { end: "2026-06-17", value: 1_050 },
  ];
  const now = new Date("2026-10-01T00:00:00Z");
  assert.equal(Math.round(sharesChangeYoY(series, now)! * 10) / 10, 4);
  assert.equal(sharesChangeYoY([{ end: "2026-06-17", value: 1 }], now), null);
});

test("a share series that stopped years ago is no measure (Ford's 2011 cover series)", () => {
  const old = [
    { end: "2010-02-12", value: 3297 },
    { end: "2011-02-14", value: 3711 },
  ];
  assert.equal(sharesChangeYoY(old, new Date("2026-10-01T00:00:00Z")), null);
});

test("growth above the base-effect ceiling is a caution, not a full pass", () => {
  const result = evaluate({ ...strong, epsGrowthQ: 1061 });
  const check = result.checks.find((c) => c.id === "epsGrowthQ")!;
  assert.equal(check.status, "warn");
  assert.equal(check.baseEffect, true);
  assert.ok(result.suggestions.includes("baseEffect"));
  assert.ok(result.cons.includes("epsGrowthQ"));
  // Kâr büyümesi dikkatte olsa da satış desteği ölçüsü çalışmaya devam ediyor.
  assert.equal(result.checks.find((c) => c.id === "growthSource")?.status, "pass");
});
