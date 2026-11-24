import assert from "node:assert/strict";
import test from "node:test";
import { technicalStatus, technicalStatusText, type TechnicalStatusInput } from "../lib/technical-status";
import tr from "../lib/i18n/dictionaries/tr";
import en from "../lib/i18n/dictionaries/en";

/* Ana sayfa teknik panelinin "bugünkü durum" künyesi (lib/technical-status.ts). */

const base: TechnicalStatusInput = { price: 100, entryLow: null, entryHigh: null, stop: null, supports: [], resistances: [], rsi: 50 };
const at = (over: Partial<TechnicalStatusInput>) => technicalStatus({ ...base, ...over });

test("öncelik: bölge → stop → RSI → en yakın seviye", () => {
  assert.deepEqual(at({ entryLow: 98, entryHigh: 102, stop: 99, rsi: 80 }), { kind: "zone" });
  assert.deepEqual(at({ stop: 101 }), { kind: "stopBroken" });
  assert.deepEqual(at({ stop: 100 }), { kind: "stopBroken" });
  assert.equal(at({ stop: 98, rsi: 80 })?.kind, "stop");
  /* Stop uzaksa RSI konuşur. */
  assert.deepEqual(at({ stop: 90, rsi: 74.4 }), { kind: "overbought", rsi: 74.4 });
  assert.deepEqual(at({ rsi: 28 }), { kind: "oversold", rsi: 28 });
  assert.deepEqual(at({ supports: [96, 90], resistances: [101.5, 110] }), { kind: "resistance", pct: 1.5 });
  assert.deepEqual(at({ supports: [99, 90], resistances: [104] }), { kind: "support", pct: 1 });
  /* Seviyenin üstünde: "%0,0" değil "Destekte". */
  assert.deepEqual(at({ supports: [99.97] }), { kind: "atSupport" });
  assert.deepEqual(at({ resistances: [100.04] }), { kind: "atResistance" });
});

test("seviye yanlış tarafta ya da veri yoksa künye yok", () => {
  assert.equal(at({}), null);
  assert.equal(at({ price: null, stop: 90 }), null);
  /* "Destek" fiyatın üstünde kalmışsa (kırılmış) destek sayılmaz. */
  assert.equal(at({ supports: [105] }), null);
  assert.deepEqual(at({ supports: [105, 95] }), { kind: "support", pct: 5 });
  /* Ters yazılmış bölge de bölge. */
  assert.deepEqual(at({ entryLow: 102, entryHigh: 98 }), { kind: "zone" });
});

test("sözlük: iki dilde dolu, yer tutucular doğru", () => {
  const pct = (abs: number) => `%${abs.toFixed(1).replace(".", ",")}`;
  assert.equal(technicalStatusText({ kind: "stop", pct: 2.14 }, tr.technical.status, pct), "Stopa %2,1");
  assert.equal(technicalStatusText({ kind: "overbought", rsi: 74.4 }, tr.technical.status, pct), "Aşırı Alım · RSI 74");
  for (const copy of [tr.technical.status, en.technical.status]) {
    assert.deepEqual(Object.keys(copy).sort(), ["atResistance", "atSupport", "overbought", "oversold", "resistance", "stop", "stopBroken", "support", "zone"]);
    for (const key of ["stop", "resistance", "support"] as const) assert.ok(copy[key].includes("{pct}"));
    for (const key of ["overbought", "oversold"] as const) assert.ok(copy[key].includes("{rsi}"));
  }
});
