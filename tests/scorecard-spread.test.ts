import test from "node:test";
import assert from "node:assert/strict";
import { axisDistribution, medianOf, scoreCard, type ScoreSubject, type StoredMetrics } from "../lib/scorecard";

const EMPTY: StoredMetrics = {
  epsTTM: null,
  revenuePerShareTTM: null,
  revenueGrowthTTMYoy: null,
  epsGrowthTTMYoy: null,
  operatingMarginTTM: null,
  netProfitMarginTTM: null,
  roeTTM: null,
  debtToEquity: null,
  currentRatio: null,
  high52: null,
  low52: null,
};

const company = (symbol: string, growth: number | null, momentum: number | null): ScoreSubject => ({
  symbol,
  currency: "USD",
  metrics: { ...EMPTY, revenueGrowthTTMYoy: growth },
  price: null,
  momentum,
});

test("medianOf: tek ve çift uzunluk, boş dizi", () => {
  assert.equal(medianOf([]), null);
  assert.equal(medianOf([10, 20, 90]), 20);
  assert.equal(medianOf([10, 20, 40, 90]), 30);
});

test("axisDistribution: konunun çentiği scoreCard ile aynı sayı, sıralı", () => {
  const subject = company("AAA", 12, 5);
  const peers = [3, 7, 9, 15, 22, 30, 41].map((g, i) => company(`P${i}`, g, i * 2));
  const spread = axisDistribution(subject, peers, 4);
  const card = scoreCard(subject, peers, 4);
  const growth = spread.growth!;
  assert.equal(growth.length, 8);
  assert.deepEqual([...growth].sort((a, b) => a - b), growth);
  const own = card.find((axis) => axis.axis === "growth")!.percentile;
  assert.ok(growth.includes(own));
});

test("axisDistribution: ölçüsü olmayan şirket çentik almaz, eşik altı eksen hiç yok", () => {
  const subject = company("AAA", 12, null);
  const peers = [company("B", 5, null), company("C", null, null), company("D", 20, null), company("E", 8, null)];
  const spread = axisDistribution(subject, peers, 3);
  assert.equal(spread.growth!.length, 4);
  assert.equal(spread.momentum, undefined);
});
