import test from "node:test";
import assert from "node:assert/strict";
import { advisorInput, checkAdvisor, monthlyMeasures, REFERENCE_WEIGHTS } from "../lib/portfolio-advisor-model";
import { scanRows, type ScanHoldingInput } from "../lib/portfolio-scan-model";

/** Portföy danışmanı — saf hesap (lib/portfolio-advisor-model.ts). */

const holding = (symbol: string, closes: number[], quantity = 10): ScanHoldingInput => ({
  symbol,
  name: symbol,
  sector: null,
  quantity,
  cost: quantity * 100,
  bars: closes.map((close) => ({ close, high: close, low: close })),
  earnings: null,
  technical: null,
  news: [],
});
/* 23 kapanış: 22. eskiden (21 seans önce) sona. */
const series = (start: number, end: number) => [...Array.from({ length: 22 }, () => start), end];

test("aylık: ağırlıklı 21 seans getirisi, SPY karşılaştırması, katkı sırası", () => {
  const rows = scanRows([holding("A", series(100, 110), 30), holding("B", series(100, 90), 10)]);
  const m = monthlyMeasures(rows, series(100, 102));
  assert.ok(m.portfolio !== null && m.sp500 !== null);
  assert.equal(Math.round(m.sp500 * 10) / 10, 2);
  /* A 3.300 (%78,6), B 900 (%21,4): +10 × .786 − 10 × .214 */
  assert.ok(Math.abs(m.portfolio - (10 * (3300 / 4200) - 10 * (900 / 4200))) < 1e-9);
  assert.deepEqual(m.contributions.map((c) => c.symbol), ["A", "B"]);
  assert.ok(m.contributions[1]!.points < 0);
});

test("aylık: 21 seans yoksa SPY getirisi yok", () => {
  const rows = scanRows([holding("A", series(100, 110))]);
  assert.equal(monthlyMeasures(rows, [100, 101]).sp500, null);
});

test("girdide başvuru ağırlıkları var; model yalnız onları yazabilir", () => {
  const rows = scanRows([holding("A", series(100, 110))]);
  const input = advisorInput("daily", rows, null, null, "tr", "11 Kasım Çarşamba");
  const parsed = JSON.parse(input);
  assert.equal(parsed.referenceWeights.length, REFERENCE_WEIGHTS.length);
  const base = { summary: "Özet.", actions: [], risks: [], outlook: "" };
  assert.equal(checkAdvisor({ ...base, headline: "A'yı %25'e indir" }, input, ["A"]).ok, true);
  assert.equal(checkAdvisor({ ...base, headline: "A'yı %23'e indir" }, input, ["A"]).ok, false);
});

test("denetim: bilinmeyen sembol düşer, boş eylem atılır, en çok 5 eylem", () => {
  const rows = scanRows([holding("A", series(100, 110))]);
  const input = advisorInput("daily", rows, null, null, "tr", "x");
  const action = (symbol: string | null, title = "Başlık") => ({ kind: "trim" as const, symbol, title, detail: "Ayrıntı." });
  const out = {
    headline: "Başlık",
    summary: "Özet.",
    actions: [action("a"), action("ZZZ"), action(null, ""), action(null), action(null), action(null), action(null)],
    risks: [],
    outlook: "",
  };
  const checked = checkAdvisor(out, input, ["A"]);
  assert.equal(checked.ok, true);
  if (checked.ok) {
    assert.equal(checked.text.actions.length, 5);
    assert.equal(checked.text.actions[0]!.symbol, "A");
    assert.equal(checked.text.actions[1]!.symbol, null);
  }
});
