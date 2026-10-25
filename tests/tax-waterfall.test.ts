import test from "node:test";
import assert from "node:assert/strict";
import { BAND_LABEL_MIN, bracketBand, monthStarts, timeShare, waterfallOf } from "../lib/tax-waterfall";

/** Vergi hesaplayıcısının şelalesi, dilim bandı ve takvim ölçeği (lib/tax-waterfall.ts). */

const TARIFF = [
  { upTo: 190_000, ratePct: 15 },
  { upTo: 400_000, ratePct: 20 },
  { upTo: 1_000_000, ratePct: 27 },
  { upTo: 5_300_000, ratePct: 35 },
  { upTo: null, ratePct: 40 },
] as const;

test("şelale: kazançta sütunlar tek ölçekte ve bağlayıcılar aynı seviyede", () => {
  const w = waterfallOf({ costTl: 48_000, indexedCostTl: 60_000, proceedsTl: 100_000, gainTl: 40_000, baseTl: 40_000 });
  const by = Object.fromEntries(w.columns.map((c) => [c.key, c]));
  assert.equal(by.proceeds.span, 1);
  assert.equal(by.cost.span, 0.48);
  assert.equal(by.index.from, 0.48);
  assert.ok(Math.abs(by.index.span - 0.12) < 1e-9);
  assert.equal(by.gain.tone, "up");
  assert.equal(by.gain.from, 0.6);
  assert.ok(Math.abs(by.gain.span - 0.4) < 1e-9);
  assert.equal(by.base.span, 0.4);
  /* Endeksli maliyetin tepesi kazancın tabanı. */
  assert.equal(w.connectors[1].level, by.gain.from);
});

test("şelale: zararda kazanç sütunu aşağı yönlü, matrah sıfır", () => {
  const w = waterfallOf({ costTl: 100_000, indexedCostTl: 100_000, proceedsTl: 80_000, gainTl: -20_000, baseTl: 0 });
  const by = Object.fromEntries(w.columns.map((c) => [c.key, c]));
  assert.equal(by.gain.tone, "down");
  assert.equal(by.gain.from, 0.8);
  assert.ok(Math.abs(by.gain.span - 0.2) < 1e-9);
  assert.equal(by.base.span, 0);
  assert.equal(by.index.span, 0);
});

test("şelale: boş girdide NaN üretmez", () => {
  const w = waterfallOf({ costTl: 0, indexedCostTl: 0, proceedsTl: 0, gainTl: 0, baseTl: 0 });
  for (const column of w.columns) {
    assert.ok(Number.isFinite(column.from) && Number.isFinite(column.span));
  }
});

test("bant: ilk dilimde tek dilim, hayalet sonraki dilime kalan yol", () => {
  const band = bracketBand(TARIFF, 48_823.62)!;
  assert.equal(band.slices.length, 1);
  assert.equal(band.end, 190_000);
  assert.ok(Math.abs(band.slices[0].fill - 48_823.62 / 190_000) < 1e-9);
  assert.ok(Math.abs(band.toNext! - (190_000 - 48_823.62)) < 1e-6);
  assert.equal(band.nextRate, 20);
});

test("bant: dilim vergilerinin toplamı dilimli vergiye eşit", () => {
  const base = 600_000;
  const band = bracketBand(TARIFF, base)!;
  const total = band.slices.reduce((sum, slice) => sum + slice.tax, 0);
  /* 190k×%15 + 210k×%20 + 200k×%27 */
  assert.equal(total, 28_500 + 42_000 + 54_000);
  assert.equal(band.slices.at(-1)!.state, "current");
  const widths = band.slices.reduce((sum, slice) => sum + slice.width, 0);
  assert.ok(Math.abs(widths - 1) < 1e-9);
});

test("bant: dar dilimler tek etikette birleşir", () => {
  const band = bracketBand(TARIFF, 2_000_000)!;
  const narrow = band.slices.filter((slice) => !slice.labeled);
  assert.ok(narrow.every((slice) => slice.width < BAND_LABEL_MIN));
  assert.ok(band.merged);
  assert.equal(band.merged!.fromRate, 15);
  assert.equal(band.merged!.toRate, 27);
});

test("bant: en üst dilimde sonraki dilim yok, matrah bandın sonunda değil", () => {
  const band = bracketBand(TARIFF, 8_000_000)!;
  assert.equal(band.toNext, null);
  assert.equal(band.nextRate, null);
  assert.ok(band.slices.at(-1)!.fill < 1);
});

test("bant: sıfır matrahta bant yok", () => {
  assert.equal(bracketBand(TARIFF, 0), null);
});

test("takvim ölçeği: uçlar 0 ve 1, aylar sıralı", () => {
  assert.equal(timeShare("2026-01-01", "2026-01-01", "2027-07-31"), 0);
  assert.equal(timeShare("2027-07-31", "2026-01-01", "2027-07-31"), 1);
  assert.equal(timeShare("2030-01-01", "2026-01-01", "2027-07-31"), 1);
  const months = monthStarts("2026-01-01", "2027-07-31");
  assert.equal(months.length, 19);
  assert.equal(months[12], "2027-01-01");
});
